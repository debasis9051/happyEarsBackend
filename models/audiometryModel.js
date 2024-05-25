const admin = require("../firebaseAdmin")

class Audiometry {

    static async get_audiometry_list() {
        // console.log("getting audiometry list")

        let q = admin.firestore().collection('audiometry').orderBy("patient_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async get_audiometry_report_by_audiometry_report_id(audiometry_report_id) {
        console.log("getting audiometry report by audiometry report id")

        let q = admin.firestore().collection('audiometry').doc(audiometry_report_id)
        let doc = await q.get()
        return doc.data()
    }

    static async add_audiometry_report(current_user_uid, current_user_name, body_data) {
        console.log('adding audiometry report')

        let audiometry_report_ref = await admin.firestore().collection('audiometry').add({
            trial_mode: body_data.trial_mode,

            patient_name: body_data.patient_name,
            contact_number: body_data.contact_number,
            age: body_data.age,
            sex: body_data.sex,
            patient_address: body_data.patient_address,

            recommended_machine: body_data.recommended_machine,
            client_chosen_machine: body_data.client_chosen_machine,
            remarks: body_data.remarks,

            referred_by: body_data.referred_by,
            audiometer: body_data.audiometer,
            complaint: body_data.complaint,

            ac_left_ear_pta: body_data.ac_left_ear_pta,
            ac_right_ear_pta: body_data.ac_right_ear_pta,

            bc_input: body_data.bc_input,
            bc_left_ear_pta: body_data.bc_left_ear_pta,
            bc_right_ear_pta: body_data.bc_right_ear_pta,

            tuning_fork: body_data.tuning_fork,
            rinne: body_data.rinne,
            weber: body_data.weber,
            doctor_id: body_data.doctor_id,

            provisional_diagnosis: body_data.provisional_diagnosis,
            recommendations: body_data.recommendations,

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
            contact_number: body_data.contact_number,
            age: body_data.age,
            sex: body_data.sex,
            patient_address: body_data.patient_address,

            recommended_machine: body_data.recommended_machine,
            client_chosen_machine: body_data.client_chosen_machine,
            remarks: body_data.remarks,

            referred_by: body_data.referred_by,
            audiometer: body_data.audiometer,
            complaint: body_data.complaint,

            ac_left_ear_pta: body_data.ac_left_ear_pta,
            ac_right_ear_pta: body_data.ac_right_ear_pta,

            bc_input: body_data.bc_input,
            bc_left_ear_pta: body_data.bc_left_ear_pta,
            bc_right_ear_pta: body_data.bc_right_ear_pta,

            tuning_fork: body_data.tuning_fork,
            rinne: body_data.rinne,
            weber: body_data.weber,

            provisional_diagnosis: body_data.provisional_diagnosis,
            recommendations: body_data.recommendations,
        });
    }
}

module.exports = Audiometry;
