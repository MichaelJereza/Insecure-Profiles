var express = require('express');
const db = require('../database');
var router = express.Router();
var md5 = require('md5');
var {checkSessionAuth, checkCSRF} = require('../util/auth');
var exec = require('child_process').exec;
var csrf = require('../util/csrfTokens');

router.get('/register', function(req, res, next) {

  res.render('register', {csrf: csrf.generateToken()});

})

router.get('/login', function(req, res, next) {

  res.render('login', {failed: false, csrf: csrf.generateToken()});

});

router.get('/', function(req, res, next) {
  db.get("SELECT * FROM user WHERE id=? AND session=?", [req.session.userId, req.sessionID], (err, row) => {
    if(row) {
      res.redirect('/home');
    } else {
      res.redirect('/login');
    }
  })
})

router.get('/home', checkSessionAuth, function(req, res, next) {

  db.get("SELECT name FROM user WHERE id=?", [req.session.userId], (err, row) => {

    if(row) {

      db.all('SELECT message, name, message.id FROM message INNER JOIN user ON message.author=user.id WHERE recipient=?', [req.session.userId], (error, messages) => {
      
        db.all('SELECT id, email FROM user', (error2, users) => {

          res.render('landing', {username: row.name, author: req.session.userId, messages: messages, recipients: users, csrf: csrf.generateToken()});
        
        });

      });

    }

  })

})

router.post('/login', checkCSRF, function(req, res, next) {

  var reqEmail = req.body.email;
  var reqPassword = md5(req.body.password);

  // Login injection point
  db.get(`SELECT * FROM user WHERE email='${reqEmail}' AND password='${reqPassword}'`, (err, row) => {
    
    console.log("Logging in...");
    if(err) {
      console.log(err);
    }

    if(row) {

      // Insecure Admin Cookie
      if(row.admin === 1) {
        res.cookie('admin', true);
      }

      db.run("UPDATE user SET session=? WHERE id=?", [req.sessionID, row.id], (error, update) => {

        req.session.userId = row.id;
        req.session.save(()=> {
          res.redirect(302, '/home');
        })

      })
  
    } else {
      res.render('login', {failed: true, csrf: csrf.generateToken()});
    }
    
  })
 
})

router.get('/logout', function(req, res, next) {
  req.session.destroy((err) => {
    res.clearCookie('admin')
    res.redirect('/')
  })
})

// TODO
// - Make the login cookie insecure
// - Outline the proper remediations for all of the above

router.post('/register', checkCSRF, function(req, res, next) {
  
  var reqEmail = req.body.email;

  if(req.body.email.length === 0 || req.body.password.length === 0) {
    res.render('register', {failed: true});
    return;
  }

  db.get("SELECT * FROM user WHERE email=?", [reqEmail], (err, row) => {
    
    if(!row) {

      db.run("INSERT INTO user (name, email, password) VALUES(?, ?, ?)", [req.body.name, reqEmail, md5(req.body.password)], (error, newRow) => {
        
        res.redirect('/login');
      })

    } else {
      res.render('register', {failed: true});
    }

  })

})

// CSRF Vulnerable
router.post('/comment', checkSessionAuth, function(req, res ,next) {

  db.run('INSERT INTO comment (comment, author, uid) VALUES(?, ?, ?)', [req.body.comment, req.session.userId, req.body.uid], (err, row) => {
    if(!err) {
      res.redirect('back');
    }
  })

})

// IDOR in author field
router.post('/message', checkSessionAuth, checkCSRF, function(req, res, next) {

  db.run('INSERT INTO message (message, author, recipient) VALUES(?, ?, ?)', [req.body.message, req.body.author, req.body.recipient], (err, row) => {
    if(!err) {
      res.redirect('back');
    }
  })

})

router.get('/profile', checkSessionAuth, function(req, res, next) {
  db.get('SELECT * FROM user WHERE id=?', [req.session.userId], (err, row) => {
    if(row) {
      db.all('SELECT comment, name, comment.id FROM comment INNER JOIN user ON comment.author=user.id WHERE uid=?', [req.session.userId], (error, comments) => {

        res.render('profile', {
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
router.get('/delete/comment/:cid', function(req, res, next) {

  db.run('DELETE FROM comment WHERE id=?', [req.params.cid], (err, row) => {
    res.redirect('back');
  })

})

router.get('/profile/:uid', function(req, res, next) {
  db.get('SELECT * FROM user WHERE id=?', [req.params.uid], (err, row) => {
    if(row) {
      db.all('SELECT comment, name, comment.id FROM comment INNER JOIN user ON comment.author=user.id WHERE uid=?', [req.params.uid], (error, comments) => {

        res.render('profile', {
          cid: row.id,
          username: row.name,
          email: row.email,
          password: row.password,
          session: row.session,
          uid: req.params.uid,
          comments: comments,
          admin: row.session === req.sessionID || req.cookies.admin === "true"
        })
      })
    } else  {
      res.status(404).send('User does not exist!');
    }
  })
})

// XSS
router.get('/get/:search', function(req, res, next) {
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

router.post('/post/:search', function(req, res, next) {
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
router.get('/debug/:file', checkSessionAuth, function(req, res, next) {

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

})

// Catch all 404
router.get('/*', function(req, res, next) {
  res.status(404).send("Resource doesn't exist!")
})

module.exports = router;
