const admin = require("../firebaseAdmin")

class Audiometry {

    static async get_audiometry_list() {
        // console.log("getting audiometry list")

        let q = admin.firestore().collection('audiometry').orderBy("patient_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({id: doc.id, ...(doc.data())}))
    }

    static async add_audiometry_report(current_user_uid,current_user_name,body_data) {
        console.log('adding audiometry report')

        let audiometry_ref = await admin.firestore().collection('audiometry').add({
            // audiometry_name: body_data.audiometry_name,
            // audiometry_invoice_code: body_data.audiometry_invoice_code, 

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return audiometry_ref
    }
}

module.exports = Audiometry;
