var express = require('express');
const db = require('../database');
var router = express.Router();
var md5 = require('md5');
var checkSessionAuth = require('../util/auth');
var exec = require('child_process').exec;

router.get(['/', '/register'], function(req, res, next) {

  res.render('register');

})

router.get('/login', function(req, res, next) {
  res.render('login', {failed: false});
});

router.get('/postlogin', checkSessionAuth, function(req, res, next) {

  db.get("SELECT name FROM user WHERE id=?", [req.session.userId], (err, row) => {

    if(row) {
      res.status(200).send(`Success! Logged in as ${row.name}`);
    }

  })

})

router.post('/login', function(req, res, next) {

  var reqEmail = req.body.email;
  var reqPassword = md5(req.body.password);

  // Login injection point
  db.get(`SELECT * FROM user WHERE email='${reqEmail}' AND password='${reqPassword}'`, (err, row) => {
    
    console.log("Logging in...");
    if(err) {
      console.log(err);
    }

    if(row) {

      db.run("UPDATE user SET session=? WHERE id=?", [req.sessionID, row.id], (error, update) => {

        req.session.userId = row.id;
        req.session.save(()=> {
          res.redirect(302, '/postlogin');
        })

      })
  
    } else {
      res.render('login', {failed: true});
    }
    
  })
 
})

// TODO
// - Make the login cookie insecure
// - Outline the proper remediations for all of the above


router.post('/register', function(req, res, next) {
  
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

router.post('/comment', checkSessionAuth, function(req, res ,next) {

  db.run('INSERT INTO comment (comment, author, uid) VALUES(?, ?, ?)', [req.body.comment, req.session.userId, req.body.uid], (err, row) => {
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

// IDOR Can delete comments regardless of ownership
router.get('/delete/comment/:cid', function(req, res, next) {

  db.run('DELETE FROM comment WHERE id=?', [req.params.cid], (err, row) => {
    res.redirect('back');
  })

})

router.get('/profile/:uid', function(req, res, next) {
  db.get('SELECT * FROM user WHERE id=?', [req.params.uid], (err, row) => {
    if(row) {
      db.all('SELECT comment, name FROM comment INNER JOIN user ON comment.author=user.id WHERE uid=?', [req.params.uid], (error, comments) => {

        res.render('profile', {
          cid: row.id,
          username: row.name,
          email: row.email,
          password: row.password,
          session: row.session,
          uid: req.params.uid,
          comments: comments
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

module.exports = router;
