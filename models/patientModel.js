/**
 * Patient Model — Firestore data access for the `patients` collection.
 * All methods are wrapped by wrapStaticMethods for uniform error logging + re-throw.
 * List queries are cached with 5-minute TTL to reduce Firestore quota consumption.
 */
const wrapStaticMethods = require("../wrapStaticMethods")
const admin = require("../firebaseAdmin")
const cache = require("../utils/cache")

class Patient {

    static _toBriefPatient(doc) {
        const data = doc.data()
        return {
            id: doc.id,
            patient_name: data.patient_name || '',
            patient_number: data.patient_number || '',
            contact_number: data.contact_number || '',
            age: data.age ?? null,
            sex: data.sex || '',
        }
    }

    /** Returns the total count of patient documents. */
    static async get_patient_count() {
        // console.log("get patient count")

        let q = admin.firestore().collection("patients").count()
        let qs = await q.get()
        return qs.data().count
    }

    /** Returns the highest existing patient_number, used to derive the next sequential number. */
    static async get_max_patient_number() {
        // console.log("get max patient number")

        let q = admin.firestore().collection("patients").orderBy("patient_number", "desc").limit(1)
        let qs = await q.get()
        return qs.docs[0].data().patient_number
    }

    /** Returns all patients matching the given patient_number (should be max 1). */
    static async get_patient_by_patient_number(patient_number) {
        let q = admin.firestore().collection('patients').where("patient_number", "==", patient_number)
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    /** Returns a single patient document by Firestore document ID. */
    static async get_patient_by_patient_id(patient_id, ownerUid = null) {
        let q = admin.firestore().collection('patients').doc(patient_id)
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

    /**
     * Returns all audiometry reports and invoices associated with a patient.
     * Used to populate the patient's document history view.
     */
    static async get_patient_docs_by_patient_id(patient_id, ownerUid = null) {
        let q1 = admin.firestore().collection('audiometry').where("patient_id", "==", patient_id)
        let audiometry_qs = await q1.get()
        let audiometry_docs = audiometry_qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        if (ownerUid) {
            audiometry_docs = audiometry_docs.filter(x => x.added_by_user_uid === ownerUid)
        }
        
        let q2 = admin.firestore().collection('invoices').where("patient_id", "==", patient_id)
        let invoice_qs = await q2.get()
        let invoice_docs = invoice_qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        if (ownerUid) {
            invoice_docs = invoice_docs.filter(x => x.added_by_user_uid === ownerUid)
        }

        // console.log(audiometry_docs, invoice_docs);
        
        return {audiometry: audiometry_docs, invoices: invoice_docs}
    }

    /** Creates a new patient document and returns its reference. */
    static async add_patient(current_user_uid, current_user_name, body_data) {
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

    /** Updates an existing patient document's editable fields. */
    static async update_patient(body_data) {
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

    /**
     * Returns a paginated page of patients ordered by creation date (newest first).
    * @param {number} limit        - Documents per page (max 50, default 25)
     * @param {string|null} cursorDocId - Firestore doc ID of the last item from the previous page
     * @returns {{ items: object[], nextCursor: string|null, hasMore: boolean }}
     */
    static async get_patient_list_paged(limit = 25, cursorDocId = null, ownerUid = null) {
        let q = admin.firestore().collection('patients')
        if (ownerUid) {
            q = q.where('added_by_user_uid', '==', ownerUid)
        }
        q = q.orderBy('created_at', 'desc').limit(limit)
        if (cursorDocId) {
            const cursorDoc = await admin.firestore().collection('patients').doc(cursorDocId).get()
            if (cursorDoc.exists) q = q.startAfter(cursorDoc)
        }
        const qs = await q.get()
        const items = qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        return {
            items,
            nextCursor: qs.docs.length === limit ? qs.docs[qs.docs.length - 1].id : null,
            hasMore: qs.docs.length === limit,
        }
    }

    static async get_patients_brief_by_ids(patientIds = [], ownerUid = null) {
        const uniqueIds = Array.from(new Set((patientIds || []).filter(Boolean)))
        if (!uniqueIds.length) {
            return []
        }

        const chunks = []
        for (let i = 0; i < uniqueIds.length; i += 30) {
            chunks.push(uniqueIds.slice(i, i + 30))
        }

        const snapshotList = await Promise.all(
            chunks.map((idChunk) =>
                admin.firestore()
                    .collection('patients')
                    .where(admin.firestore.FieldPath.documentId(), 'in', idChunk)
                    .get()
            )
        )

        return snapshotList
            .flatMap((qs) => qs.docs)
            .filter((doc) => {
                if (!ownerUid) return true
                const data = doc.data()
                return data.added_by_user_uid === ownerUid
            })
            .map(Patient._toBriefPatient)
    }

    static async search_patients_brief(searchTerm = '', limit = 25, ownerUid = null) {
        const normalized = (searchTerm || '').toString().trim().toLowerCase()
        if (!normalized) {
            return []
        }

        // Keep this intentionally bounded to avoid scanning the full collection on each key stroke.
        let q = admin.firestore().collection('patients')
        if (ownerUid) {
            q = q.where('added_by_user_uid', '==', ownerUid)
        }
        q = q.orderBy('created_at', 'desc').limit(250)

        const qs = await q.get()

        return qs.docs
            .filter((doc) => {
                const data = doc.data()
                const patientName = (data.patient_name || '').toString().toLowerCase()
                const patientNumber = (data.patient_number || '').toString().toLowerCase()
                const contactNumber = (data.contact_number || '').toString().toLowerCase()

                return (
                    patientName.includes(normalized) ||
                    patientNumber.includes(normalized) ||
                    contactNumber.includes(normalized)
                )
            })
            .slice(0, Math.max(1, Math.min(limit || 25, 100)))
            .map(Patient._toBriefPatient)
    }
}

module.exports = wrapStaticMethods(Patient);
