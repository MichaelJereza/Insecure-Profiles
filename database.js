const DBSOURCE = "db.sqlite"
var sqlite3 = require('sqlite3');
var md5 = require('md5')

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
      // Cannot open database
      console.error(err.message)
      throw err
    }else{
        console.log('Connected to the SQLite database.')
        db.run(`CREATE TABLE user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name text, 
            email text UNIQUE, 
            password text,
            session text,
            CONSTRAINT email_unique UNIQUE (email),
            CONSTRAINT session_unique UNIQUE (session)
            )`,
        (err) => {
            if (err) {
                // Table already created
            }else{
                // Table just created, creating some rows
                var insert = 'INSERT INTO user (name, email, password) VALUES (?,?,?)'
                db.run(insert, ["admin","admin@example.com",md5("admin123456")])
                db.run(insert, ["user","user@example.com",md5("user123456")])
                db.run(insert, ["user","test@test",md5("password")])
            }
        });  
    }
});

module.exports = db