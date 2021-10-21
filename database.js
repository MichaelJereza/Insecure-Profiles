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
            admin INTEGER DEFAULT 0,
            backgroundUrl text,
            CONSTRAINT email_unique UNIQUE (email)
            )`,
        (err) => {
            if (err) {
                // Table already created
            }else{
                // Table just created, creating some rows
                var insert = 'INSERT INTO user (name, email, password, admin) VALUES (?,?,?,?)'
                db.run(insert, ["admin","admin@example.com",md5("admin123456"),1])
                db.run(insert, ["user","user@example.com",md5("user123456"),0])
                db.run(insert, ["user","test@test",md5("password"),0])
            }
        });
        
        db.run(`CREATE TABLE comment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comment text,
            author INTEGER NOT NULL,
            uid INTEGER NOT NULL,
            FOREIGN KEY (author) REFERENCES user(id),
            FOREIGN KEY (uid) REFERENCES user(id)
            )`,
        (err) => {
            if(err) {
                // Table already created
            }
        });
        
        db.run(`CREATE TABLE message (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message text,
            author INTEGER NOT NULL,
            recipient INTEGER NOT NULL,
            FOREIGN KEY (author) REFERENCES user(id),
            FOREIGN KEY (recipient) REFERENCES user(id)
            )`,
        (err) => {
            if(err) {
                // Table already created
            }
        });
    }
});

module.exports = db