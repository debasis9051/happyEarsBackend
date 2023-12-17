// const admin = require('firebase-admin')
// const serviceAccount = require("../happy-ears-service-config.json");

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount)
// });

const admin = require("../firebaseAdmin")

class User {
    static async create(user_uid, user_name, user_email, user_photo) {
        console.log('creating user')

        await admin.firestore().collection('users').doc(user_uid).set({
            user_name: user_name,
            user_email: user_email,
            user_photo: user_photo,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    static async get(user_uid) {
        console.log("getting user")

        return admin.firestore().collection('users').doc(user_uid).get()
        .then((s) =>{
            if(s.exists){
                return s.data()
            }else{
                return null
            }
        })
        .catch((err) =>{
            console.log(err)
        })
    }
}

module.exports = User;
