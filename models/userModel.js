const admin = require("../firebaseAdmin")

class User {
    static async create(user_uid, user_name, user_email, user_photo) {
        console.log('creating user')

        await admin.firestore().collection('users').doc(user_uid).set({
            user_name: user_name,
            user_email: user_email,
            user_photo: user_photo,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            authenticated: false
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

    static async get_authenticated_user_list() {
        // console.log("getting authenticated user list")

        let q = admin.firestore().collection('users').where("authenticated","==",true)
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }
}

module.exports = User;
