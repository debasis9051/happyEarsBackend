/**
 * Doctor Model — Firestore data access for the `doctors` collection.
 * Doctor signature images are stored in Firebase Storage; the download URL is saved in Firestore.
 * All methods are wrapped by wrapStaticMethods for uniform error logging + re-throw.
 */
const { getDownloadURL } = require("firebase-admin/storage")
const admin = require("../firebaseAdmin");
const cache = require("../utils/cache");
const wrapStaticMethods = require("../wrapStaticMethods")

class Doctor {

    /** Returns all doctors ordered alphabetically by name. */
    static async getCachedDoctorList() {
        // console.log("getting doctor list")

        const cached = cache.get('doctor-list');
        if (cached) {
            return cached;
        }

        let q = admin.firestore().collection('doctors').orderBy("doctor_name").limit(100)
        let qs = await q.get()
        const result = qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        cache.set('doctor-list', result, 300);
        return result
    }

    /** Returns a single doctor document by Firestore document ID. */
    static async get_doctor_details(doctor_id) {
        // console.log("getting doctor signature")

        let q = admin.firestore().collection('doctors').doc(doctor_id)
        let doc = await q.get()
        return doc.data()
    }

    /**
     * Uploads a doctor's signature image to Firebase Storage and creates a Firestore document.
     * Filename is <timestamp>_<doctor_name_snake_case>.<ext>.
     */
    static async add_doctor(current_user_uid, current_user_name, body_data, file_data) {
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

module.exports = wrapStaticMethods(Doctor);
