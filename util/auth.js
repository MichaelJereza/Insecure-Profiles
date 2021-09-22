const db = require('../database');
const csrf = require('./csrfTokens');

function checkSessionAuth(req, res, next) {
    db.get("SELECT * FROM user WHERE id=? AND session=?", [req.session.userId, req.sessionID], (err, row) => {
      if(row) {
        console.log("Authenticated session");
        next();
      } else {
        console.log(`Failed authorization session: ${req.sessionID}`)
        res.status(401).send("Session not authorized");
      }
    })
}

function checkCSRF(req, res, next) {
  if(csrf.verifyToken(req.body.csrf)) {
    next();
  } else {
    res.status(400).send("Invalid CSRF");
  }
}

module.exports = {checkSessionAuth, checkCSRF};