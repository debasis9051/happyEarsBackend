const wrapStaticMethods = require("../wrapStaticMethods");
const admin = require("../firebaseAdmin")

class User {
    static async create(user_uid, user_name, user_email, user_photo) {
        console.log('creating user')

        const userRef = admin.firestore().collection('users').doc(user_uid);
        const existingUser = await userRef.get();

        if (existingUser.exists) {
            throw new Error(`User with UID "${user_uid}" already exists.`);
        }

        await userRef.set({
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

        let s = await admin.firestore().collection('users').doc(user_uid).get()

        if (s.exists) {
            return s.data()
        } else {
            return null
        }
    }

    static async get_user_list() {
        // console.log("getting user list")

        let q = admin.firestore().collection('users').orderBy("user_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async update_user_access(body_data) {
        console.log('updating user access triggered by', body_data.current_user_name, body_data.current_user_uid)

        await admin.firestore().collection('users').doc(body_data.user_id).update({
            auth_access: body_data.user_access
        });
    }
}

module.exports = wrapStaticMethods(User);