const admin = require("../firebaseAdmin")

class Patient {

    static async get_patient_list() {
        // console.log("getting patient list")

        let q = admin.firestore().collection('patients').orderBy("patient_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async add_patient(current_user_uid, current_user_name, body_data) {
        console.log('adding patient')

        let patient_ref = await admin.firestore().collection('patients').add({
            patient_name: body_data.patient_name,
            notes: body_data.notes,
            map_coordinates: body_data.map_coordinates,

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return patient_ref
    }

    static async update_patient(body_data) {
        console.log('updating patient')

        await admin.firestore().collection('patients').doc(body_data.patient_id).update({
            patient_name: body_data.patient_name,
            notes: body_data.notes,
            map_coordinates: body_data.map_coordinates,
        });
    }
}

module.exports = Patient;
