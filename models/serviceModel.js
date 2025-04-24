const { getDownloadURL } = require("firebase-admin/storage")
const admin = require("../firebaseAdmin")

class Service {
    static async get_service_list() {
        // console.log("getting service list")

        let q = admin.firestore().collection('service').orderBy("created_at")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async create_service_request(current_user_uid, current_user_name, body_data) {
        console.log('creating service request')

        // Change this to be dependent on unix time so it is unique always
        let service_id = Date.now();

        let service_ref = await admin.firestore().collection('service').add({
            service_id: service_id,
            patient_id: body_data.patient_id,
            problem_description: body_data.problem_description,
            outcome_details: null,
            technician: null,
            status: "PENDING",
            file_reference: null,
            closed_at: null,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return { service_ref, service_id }
    }

    static async complete_service_request(body_data, file_data) {
        console.log('completing service request')

        let filename = Date.now() + "_" + body_data.service_unique_id.replace(" ", "_").toLowerCase()
        let ext = "." + file_data.originalname.split(".")[file_data.originalname.split(".").length - 1]

        let fileRef = admin.storage().bucket().file(`service_files/${filename + ext}`)

        await fileRef.save(file_data.buffer)
        let downloadUrl = await getDownloadURL(fileRef)

        let service_ref = await admin.firestore().collection('service').doc(body_data.service_unique_id).update({
            status: "COMPLETED",
            outcome_details: body_data.outcome_details,
            technician: body_data.technician,
            file_reference: downloadUrl,
            closed_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { service_ref }
    }

    static async cancel_service_request(body_data) {
        console.log('canceling service request')

        let service_ref = await admin.firestore().collection('service').doc(body_data.service_unique_id).update({
            status: "CANCELLED",
            outcome_details: body_data.outcome_details,
            closed_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { service_ref }
    }


}

module.exports = Service;
