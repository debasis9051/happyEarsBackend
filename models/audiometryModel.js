/**
 * Audiometry Model — Firestore data access for the `audiometry` collection.
 * All methods are wrapped by wrapStaticMethods for uniform error logging + re-throw.
 * List queries are cached with 5-minute TTL to reduce Firestore quota consumption.
 */
const wrapStaticMethods = require("../wrapStaticMethods")
const admin = require("../firebaseAdmin")
const cache = require("../utils/cache")

class Audiometry {

    /** Returns a single audiometry report by its Firestore document ID, or undefined if not found. */
    static async get_audiometry_report_by_audiometry_report_id(audiometry_report_id, ownerUid = null) {
        console.log("getting audiometry report by audiometry report id")

        let q = admin.firestore().collection('audiometry').doc(audiometry_report_id)
        let doc = await q.get()
        if (!doc.exists) {
            return null
        }
        const data = doc.data()
        if (ownerUid && data.added_by_user_uid !== ownerUid) {
            return null
        }
        return data
    }

    /** Creates a new audiometry report document and returns its reference. */
    static async add_audiometry_report(current_user_uid, current_user_name, body_data) {
        console.log('adding audiometry report')

        let audiometry_report_ref = await admin.firestore().collection('audiometry').add({
            trial_mode: body_data.trial_mode,

            branch_id: body_data.branch_id,
            date: new Date(body_data.date),

            patient_id: body_data.patient_id,

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

    /** Updates editable fields on an existing audiometry report. */
    static async update_audiometry_report(body_data) {
        console.log('updating audiometry report')

        await admin.firestore().collection('audiometry').doc(body_data.audiometry_report_id).update({
            date: new Date(body_data.date),

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

    /**
     * Returns a paginated page of audiometry reports ordered by date (newest first).
    * @param {number} limit        - Documents per page (max 50, default 25)
     * @param {string|null} cursorDocId - Firestore doc ID of the last item from the previous page
     * @param {string|null} ownerUid    - Filter by user UID (non-admins)
     * @param {string|null} branchId    - Optional branch filter for server-side per-branch pagination
     * @returns {{ items: object[], nextCursor: string|null, hasMore: boolean }}
     */
    static async get_audiometry_list_paged(limit = 25, cursorDocId = null, ownerUid = null, branchId = null) {
        let q = admin.firestore().collection('audiometry')
        if (ownerUid) {
            q = q.where('added_by_user_uid', '==', ownerUid)
        }
        if (branchId) {
            q = q.where('branch_id', '==', branchId)
        }
        q = q.orderBy('date', 'desc').limit(limit)
        if (cursorDocId) {
            const cursorDoc = await admin.firestore().collection('audiometry').doc(cursorDocId).get()
            if (cursorDoc.exists) q = q.startAfter(cursorDoc)
        }

        try {
            const qs = await q.get()
            const items = qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
            return {
                items,
                nextCursor: qs.docs.length === limit ? qs.docs[qs.docs.length - 1].id : null,
                hasMore: qs.docs.length === limit,
            }
        } catch (error) {
            const indexStillBuilding = Number(error?.code) === 9 &&
                typeof error?.details === 'string' &&
                error.details.toLowerCase().includes('index is currently building')

            // Temporary compatibility path while branch/date index is provisioning.
            if (!indexStillBuilding || !branchId) {
                throw error
            }

            let fallback = admin.firestore().collection('audiometry')
            if (ownerUid) {
                fallback = fallback.where('added_by_user_uid', '==', ownerUid)
            }

            const overfetchLimit = Math.max(limit * 5, 100)
            fallback = fallback.orderBy('date', 'desc').limit(overfetchLimit)
            if (cursorDocId) {
                const cursorDoc = await admin.firestore().collection('audiometry').doc(cursorDocId).get()
                if (cursorDoc.exists) fallback = fallback.startAfter(cursorDoc)
            }

            const fallbackSnapshot = await fallback.get()
            const filteredDocs = fallbackSnapshot.docs.filter((doc) => doc.data()?.branch_id === branchId)
            const slicedDocs = filteredDocs.slice(0, limit)
            const items = slicedDocs.map((doc) => ({ id: doc.id, ...(doc.data()) }))

            return {
                items,
                nextCursor: slicedDocs.length ? slicedDocs[slicedDocs.length - 1].id : null,
                hasMore: fallbackSnapshot.docs.length === overfetchLimit,
            }
        }
    }
}

module.exports = wrapStaticMethods(Audiometry);