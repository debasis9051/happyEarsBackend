const admin = require("../firebaseAdmin")

class Patient {

    static async get_patient_list() {
        // console.log("getting patient list")

        let q = admin.firestore().collection('patients').orderBy("patient_number")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async get_patient_count() {
        // console.log("get patient count")

        let q = admin.firestore().collection("patients").count()
        let qs = await q.get()
        return qs.data().count
    }

    static async get_max_patient_number() {
        // console.log("get max patient number")

        let q = admin.firestore().collection("patients").orderBy("patient_number","desc").limit(1)
        let qs = await q.get()
        return qs.docs[0].data().patient_number
    }

    static async get_patient_by_patient_number(patient_number) {
        console.log("getting patient by patient number")

        let q = admin.firestore().collection('patients').where("patient_number", "==", patient_number)
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async get_patient_by_patient_id(patient_id) {
        console.log("getting patient by patient id")

        let q = admin.firestore().collection('patients').doc(patient_id)
        let doc = await q.get()
        return doc.data()
    }

    static async add_patient(current_user_uid, current_user_name, body_data) {
        console.log('adding patient')

        let patient_ref = await admin.firestore().collection('patients').add({
            patient_name: body_data.patient_name,
            contact_number: body_data.contact_number,
            patient_number: body_data.patient_number,
            age: body_data.age,
            sex: body_data.sex,
            patient_address: body_data.patient_address,
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
            contact_number: body_data.contact_number,
            patient_number: body_data.patient_number,
            age: body_data.age,
            sex: body_data.sex,
            patient_address: body_data.patient_address,
            notes: body_data.notes,
            map_coordinates: body_data.map_coordinates,
        });
    }
}

module.exports = Patient;
