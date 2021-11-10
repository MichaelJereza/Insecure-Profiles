var {db} = require('../database');

const base64 = {
    decode: s => Buffer.from(s, 'base64'),
    encode: b => Buffer.from(b).toString('base64')
};

async function getObject(session) {
    return new Promise(function(resolve,reject){
        db.get(`SELECT * FROM user WHERE session=?`, [session], (err, row) => {

            if(err) {
                reject(err);
            }

            let userObject = {
                "name": row.name,
                "bg": row.backgroundUrl
            }       
    
            if(row.admin === 1) {
                userObject.admin = true;
            }
            
            resolve(userObject);
        });
    });
    
}

function serialize(jsonObject) {
    let jsonString = JSON.stringify(jsonObject);

    return base64.encode(jsonString)
}

function deserialize(serializedObject) {

    try {
        let jsonString = base64.decode(serializedObject);
        let jsonObject = eval("(" + jsonString + ")");

        return jsonObject
    } catch(error) {
        console.error("Deserialization error:");
        console.error(error);
        
        return null;
    }

    

}

module.exports = {getObject, serialize, deserialize}