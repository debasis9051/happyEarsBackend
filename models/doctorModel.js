const { getDownloadURL } = require("firebase-admin/storage")
const admin = require("../firebaseAdmin")

class Doctor {

    static async get_doctor_list() {
        // console.log("getting doctor list")

        let q = admin.firestore().collection('doctors').orderBy("doctor_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async get_doctor_details(doctor_id) {
        // console.log("getting doctor signature")

        let q = admin.firestore().collection('doctors').doc(doctor_id)
        let doc = await q.get()
        return doc.data()
    }

    static async add_doctor(current_user_uid, current_user_name, body_data, file_data) {
        console.log('adding doctor')

        let filename = Date.now() + "_" + body_data.doctor_name.replace(" ", "_").toLowerCase()
        let ext = "." + file_data.originalname.split(".")[file_data.originalname.split(".").length - 1]

        let fileRef = admin.storage().bucket().file(`doctor_signatures/${filename + ext}`)

        await fileRef.save(file_data.buffer)
        let downloadUrl = await getDownloadURL(fileRef)

        let doctor_ref = await admin.firestore().collection('doctors').add({
            doctor_name: body_data.doctor_name,
            doctor_qualification: body_data.doctor_qualification,
            doctor_registration_number: body_data.doctor_registration_number,
            doctor_signature: downloadUrl, 

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return doctor_ref
    }
}

module.exports = Doctor;
