const admin = require("../firebaseAdmin")

class User {
    static async create(user_uid, user_name, user_email, user_photo) {
        console.log('creating user')

        await admin.firestore().collection('users').doc(user_uid).set({
            user_name: user_name,
            user_email: user_email,
            user_photo: user_photo,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            auth_access: {
                admin_panel: false,
                audiometry: false,
                generate_invoice: false,
                inventory: false,
                sales_report: false,
            }
        });
    }

    static async get(user_uid) {
        // console.log("getting user")

        return admin.firestore().collection('users').doc(user_uid).get()
            .then((s) => {
                if (s.exists) {
                    return s.data()
                } else {
                    return null
                }
            })
            .catch((err) => {
                console.log(err)
            })
    }

    static async get_user_list() {
        // console.log("getting user list")

        let q = admin.firestore().collection('users').orderBy("user_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async update_user_access(body_data) {
        console.log('updating user access triggered by',body_data.current_user_name, body_data.current_user_uid)

        await admin.firestore().collection('users').doc(body_data.user_id).update({
            auth_access: body_data.user_access
        });
    }
}

module.exports = User;
