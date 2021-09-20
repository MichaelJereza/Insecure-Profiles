var express = require('express');
const db = require('../database');
var router = express.Router();
var md5 = require('md5');
var checkSessionAuth = require('../util/auth');

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

  db.get("SELECT * FROM user WHERE email=? AND password=?", [reqEmail, reqPassword], (err, row) => {
    
    console.log("Logging in...");

    if(row) {

      console.log("Found user:")
      console.log(row);
      console.log(`for session ${req.sessionID}`)

      db.run("UPDATE user SET session=? WHERE id=?", [req.sessionID, row.id], (error, update) => {

        console.log("Updated")
        console.log(update);

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

router.post('/register', function(req, res, next) {
  
  var reqEmail = req.body.email;

  if(req.body.email.length === 0 || req.body.password.length === 0) {
    res.render('register', {failed: true});
    return;
  }

  db.get("SELECT * FROM user WHERE email=?", [reqEmail], (err, row) => {
    
    if(!row) {

      db.run("INSERT INTO user (name, email, password) VALUES(?, ?, ?)", [req.body.name, reqEmail, md5(req.body.password)], (error, newRow) => {
        
        console.log("Inserted")
        console.log(newRow)
        console.log(error)
        
        res.redirect('/login');
      })

    } else {
      res.render('register', {failed: true});
    }

  })

})

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

module.exports = router;
