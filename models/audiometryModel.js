const admin = require("../firebaseAdmin")

class Audiometry {

    static async get_audiometry_list() {
        // console.log("getting audiometry list")

        let q = admin.firestore().collection('audiometry').orderBy("patient_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({id: doc.id, ...(doc.data())}))
    }

    static async get_audiometry_report_by_audiometry_report_id(audiometry_report_id) {
        console.log("getting audiometry report by audiometry report id")

        let q = admin.firestore().collection('audiometry').doc(audiometry_report_id)
        let doc = await q.get()
        return doc.data()
    }

    static async add_audiometry_report(current_user_uid,current_user_name,body_data) {
        console.log('adding audiometry report')

        let audiometry_report_ref = await admin.firestore().collection('audiometry').add({
            patient_name: body_data.patient_name,
            patient_address: body_data.patient_address,
            contact_number: body_data.contact_number,
            remarks: body_data.remarks,
            left_ear_pta: body_data.left_ear_pta,
            right_ear_pta: body_data.right_ear_pta,

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return audiometry_report_ref
    }

    static async update_audiometry_report(body_data) {
        console.log('updating audiometry report')

        await admin.firestore().collection('audiometry').doc(body_data.audiometry_report_id).update({
            patient_name: body_data.patient_name,
            patient_address: body_data.patient_address,
            contact_number: body_data.contact_number,
            remarks: body_data.remarks,
            left_ear_pta: body_data.left_ear_pta,
            right_ear_pta: body_data.right_ear_pta,
        });
    }
}

module.exports = Audiometry;
