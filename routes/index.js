var express = require('express');
const db = require('../database');
var router = express.Router();
var md5 = require('md5');
var {checkSessionAuth, checkCSRF} = require('../util/auth');
var exec = require('child_process').exec;
var csrf = require('../util/csrfTokens');
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var serializer = require('../util/customSerialization');

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/files/')
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname.toLowerCase()}`) //Appending extension
  }
})
const upload = multer({ storage: storage });

router.get('/register', async function(req, res, next) {

  res.render('register', {
    csrf: csrf.generateToken()
  });

})

router.get('/login', async function(req, res, next) {

  res.render('login', {
    failed: false, 
    csrf: csrf.generateToken()
  });

});

router.get('/', async function(req, res, next) {
  db.get("SELECT * FROM user WHERE id=? AND session=?", [req.session.userId, req.sessionID], (err, row) => {
    if(row) {
      res.redirect('/home');
    } else {
      res.redirect('/login');
    }
  })
})

router.get('/home', checkSessionAuth, async function(req, res, next) {

  db.get("SELECT name, backgroundUrl FROM user WHERE id=?", [req.session.userId], (err, row) => {

    if(row) {

      db.all('SELECT message, name, message.id, message.author FROM message INNER JOIN user ON message.author=user.id WHERE recipient=?', [req.session.userId], (error, messages) => {
      
        db.all('SELECT id, email FROM user', (error2, users) => {

          let userObject = serializer.deserialize(req.cookies.you);

          res.render('landing', {
            bgUrl: row.backgroundUrl ? row.backgroundUrl : false,
            username: userObject?.name, 
            author: req.session.userId, 
            messages: messages, 
            recipients: users, 
            csrf: csrf.generateToken()
          });
        
        });

      });

    }

  })

})

router.post('/login', checkCSRF, async function(req, res, next) {

  var reqEmail = req.body.email;
  var reqPassword = md5(req.body.password);

  // Login SQLi injection point
  db.get(`SELECT * FROM user WHERE email='${reqEmail}' AND password='${reqPassword}'`, (err, row) => {
    
    console.log("Logging in...");
    if(err) {
      console.log(err);
    }

    if(row) {

      db.run("UPDATE user SET session=? WHERE id=?", [req.sessionID, row.id], async (error, update) => {

        let userObject = await serializer.getObject(req.sessionID)

        let serializedObject = serializer.serialize(userObject);
        res.cookie('you', serializedObject);

        req.session.userId = row.id;
        req.session.save(()=> {
          res.redirect(302, '/home');
        })

      })
  
    } else {
      res.render('login', {
        failed: true, 
        csrf: csrf.generateToken()
      });
    }
    
  })
 
})

router.get('/logout', async function(req, res, next) {
  req.session.destroy((err) => {
    res.clearCookie('you')
    res.redirect('/')
  })
})

router.post('/register', checkCSRF, async function(req, res, next) {
  
  var reqEmail = req.body.email;

  if(req.body.email.length === 0 || req.body.password.length === 0) {
    res.render('register', {
      failed: true
    });
    return;
  }

  db.get("SELECT * FROM user WHERE email=?", [reqEmail], (err, row) => {
    
    if(!row) {

      db.run("INSERT INTO user (name, email, password) VALUES(?, ?, ?)", [req.body.name, reqEmail, md5(req.body.password)], (error, newRow) => {

        res.redirect('/login');

        insertWelcomeMessage(req.body.name, reqEmail);

      })

    } else {
      res.render('register', {
        failed: true, 
        csrf: csrf.generateToken()
      });
    }

  })

})

async function insertWelcomeMessage(name, email) {
  
  const message = `Welcome to the site, ${name}!`;

  db.run("INSERT INTO message (message, author, recipient) VALUES(?, (SELECT id FROM user WHERE name='admin'), (SELECT id FROM user WHERE email=?))",[message, email], (err, row)=>{

  })

}

// CSRF Vulnerable
router.post('/comment', checkSessionAuth, function(req, res ,next) {

  db.run('INSERT INTO comment (comment, author, uid) VALUES(?, ?, ?)', [req.body.comment, req.session.userId, req.body.uid], (err, row) => {
    if(!err) {
      res.redirect('back');
    }
  })

})

// IDOR in author field
router.post('/message', checkSessionAuth, checkCSRF, async function(req, res, next) {

  db.run('INSERT INTO message (message, author, recipient) VALUES(?, ?, ?)', [req.body.message, req.body.author, req.body.recipient], (err, row) => {
    if(!err) {
      res.redirect('back');
    }
  })

})

router.get('/profile', checkSessionAuth, async function(req, res, next) {
  db.get('SELECT * FROM user WHERE id=?', [req.session.userId], (err, row) => {
    if(row) {
      db.all('SELECT comment, name, comment.id FROM comment INNER JOIN user ON comment.author=user.id WHERE uid=?', [req.session.userId], (error, comments) => {

        res.render('profile', {
          bgUrl: row.backgroundUrl ? row.backgroundUrl : false,
          username: row.name,
          email: row.email,
          password: row.password,
          session: row.session,
          uid: req.session.userId,
          comments: comments,
          admin: true
        })
      })
    }
  })
})

// MFLAC Can delete comments regardless of ownership
router.get('/delete/comment/:cid', async function(req, res, next) {

  db.run('DELETE FROM comment WHERE id=?', [req.params.cid], (err, row) => {
    res.redirect('back');
  })

})

// MFLAC Remediation
router.get('/delete/message/:cid', checkSessionAuth, async function(req, res, next) {

  db.run('DELETE FROM message WHERE id=? and recipient=?', [req.params.cid, req.session.userId], (err, row) => {
    res.redirect('back');
  })

})

router.get('/profile/:uid', async function(req, res, next) {
  db.get('SELECT * FROM user WHERE id=?', [req.params.uid], (err, row) => {
    if(row) {
      db.all('SELECT comment, name, comment.id, comment.author FROM comment INNER JOIN user ON comment.author=user.id WHERE uid=?', [req.params.uid], (error, comments) => {

        let userObject = serializer.deserialize(req.cookies.you);

        res.render('profile', {
          bgUrl: row.backgroundUrl ? row.backgroundUrl : false,
          cid: row.id,
          username: row.name,
          email: row.email,
          password: row.password,
          session: row.session,
          uid: req.params.uid,
          comments: comments,
          admin: row.session === req.sessionID || userObject?.admin
        })
      })
    } else  {
      res.status(404).send('User does not exist!');
    }
  })
})

// XSS
router.get('/get/:search', async function(req, res, next) {
  var parameters = {
    urlParam: req.params.search,
    queryParam: req.query,
    bodyParam: req.body
  }

  res.render('xss', {
    urlParam: parameters.urlParam, 
    queryParam: parameters.queryParam.xss, 
    bodyParam: ""
  })
})

router.post('/post/:search', async function(req, res, next) {
  var parameters = {
    urlParam: req.params.search,
    queryParam: req.query,
    bodyParam: req.body
  }

  res.render('xss', {
    urlParam: parameters.urlParam, 
    queryParam: parameters.queryParam.xss, 
    bodyParam: parameters.bodyParam.xss
  })
})

// Command injection
router.get('/debug/:file', checkSessionAuth, async function(req, res, next) {

  let userObject = serializer.deserialize(req.cookies.you)

  if(userObject?.admin) {
    var command = `cat ${req.params.file}`;

    exec(command,
      function (error, stdout, stderr) {
  
        if(stderr) {
          console.log('stderr: ' + stderr);
        }
  
        if (error !== null) {
            console.log('exec error: ' + error);
        }
  
        res.status(200).send(stdout);
    });
  } else {
    res.status(401).send('Forbidden')
  }

 

})

// File upload form
router.get('/upload', checkSessionAuth, async function(req, res, next) {

  let userObject = serializer.deserialize(req.cookies.you);

  res.render('upload', {
    bgUrl: userObject?.bg,
  })
})

// Unvalidated file upload
// TODO Add CSRF
const allowedFiletypes = /jpeg|jpg|png|gif/;
router.post('/upload', checkSessionAuth, upload.single('filecontent'), async function(req, res, next) {

  let validExtension = allowedFiletypes.test(req.file.originalname.toLowerCase());

  let userObject = serializer.deserialize(req.cookies.you);

  if(!validExtension) {
  
    fs.unlinkSync(req.file.path);
    res.render('upload', {
      bgUrl: userObject?.bg,
      uploadFail: true
    })
  } else {
  
    res.render('upload', {
      bgUrl: userObject?.bg,
      uploadComplete: true,
      uploadLocation: `files/${req.file.filename}`,
      uploadName: req.file.filename
    })
  }
})

// Set background
router.post('/background', checkSessionAuth, async function(req, res, next) {

  db.run("UPDATE user SET backgroundUrl=? WHERE session=?", [req.body.backgroundUrl, req.sessionID], async (error, update) => {

    let userObject = await serializer.getObject(req.sessionID);    

    res.cookie('you', serializer.serialize(userObject));
    res.status(202).redirect('/');

  });

})

// Catch all 404
router.get('/*', async function(req, res, next) {
  res.status(404).send("Resource doesn't exist!")
})

module.exports = router;
