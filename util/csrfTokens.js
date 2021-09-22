const Tokens = require("csrf");

let tokens = new Tokens();

var secret = tokens.secretSync();

function getSecret() {
    return secret;
}

function generateToken() {
    return tokens.create(secret);
}

function verifyToken(token) {
    return tokens.verify(secret, token);
}

module.exports = {getSecret, generateToken, verifyToken};