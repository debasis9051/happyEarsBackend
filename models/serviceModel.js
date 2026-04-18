/**
 * Service Model — Firestore data access for the `service` collection.
 * Completed/cancelled requests also upload evidence files to Firebase Storage.
 * All methods are wrapped by wrapStaticMethods for uniform error logging + re-throw.
 * List queries are cached with 5-minute TTL to reduce Firestore quota consumption.
 */
const { getDownloadURL } = require("firebase-admin/storage")
const admin = require("../firebaseAdmin")
const wrapStaticMethods = require("../wrapStaticMethods")
const ExifParser = require("exif-parser")
const cache = require("../utils/cache")

class Service {
    /** Returns all service requests ordered by creation date (ascending). Cached for 5 mins. */
    static async get_service_list(ownerUid = null) {
        // console.log("getting service list")

        // Check cache first
        const cacheKey = ownerUid ? `service-list:${ownerUid}` : 'service-list';
        const cached = cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        let q = admin.firestore().collection('service')
        if (ownerUid) {
            q = q.where('added_by_user_uid', '==', ownerUid)
        }
        q = q.orderBy("created_at").limit(250)
        let qs = await q.get()
        const result = qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        
        // Cache for 5 minutes
        cache.set(cacheKey, result, 300);
        return result;
    }

    /** Returns all service documents linked to a specific patient_id. Capped at 100 per patient. */
    static async get_patient_service_reports_by_id(patient_id, ownerUid = null) {
        // console.log("getting service reports by id")

        let q = admin.firestore().collection('service').where("patient_id", "==", patient_id).limit(100)
        let qs = await q.get()
        let result = qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        if (ownerUid) {
            result = result.filter(x => x.added_by_user_uid === ownerUid)
        }
        return result
    }

    /** Returns a single service request by Firestore document ID, optionally owner-scoped. */
    static async get_service_by_id(service_id, ownerUid = null) {
        const doc = await admin.firestore().collection('service').doc(service_id).get()
        if (!doc.exists) {
            return null
        }
        const data = doc.data()
        if (ownerUid && data.added_by_user_uid !== ownerUid) {
            return null
        }
        return { id: doc.id, ...data }
    }

    /**
     * Creates a new PENDING service request.
     * service_id is a Unix timestamp (ms) used as a human-readable identifier.
     * Returns both the Firestore doc ref and the numeric service_id.
     */
    static async create_service_request(current_user_uid, current_user_name, body_data) {
        console.log('creating service request')

        // Change this to be dependent on unix time so it is unique always
        let service_id = Date.now();

        let service_ref = await admin.firestore().collection('service').add({
            service_id: service_id,
            patient_id: body_data.patient_id,
            problem_description: body_data.problem_description,
            technician: null,
            service_type: null,
            outcome_details: null,
            status: "PENDING",
            file_references: null,
            closed_at: null,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return { service_ref, service_id }
    }

    /**
     * Marks a service request as COMPLETED.
     * Uploads each evidence file to Firebase Storage under service_files/<service_unique_id>/.
     * Extracts EXIF DateTimeOriginal from JPEG files when available.
     * Updates the Firestore document with status, technician, service_type, outcome, and file references.
     */
    static async complete_service_request(body_data, files_data) {
        console.log('completing service request');

        const fileInfos = await Promise.all(files_data.map(async (file) => {
            // --- Sanitize original name ---
            const sanitize = (name) => name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

            const ext = '.' + String(file.originalname).split('.').pop().toLowerCase();
            const baseOriginal = sanitize(String(file.originalname).replace(/\.[^/.]+$/, ''));

            // --- Generate unique filename ---
            const uniqueId = crypto.randomUUID();
            const filename = `${body_data.service_unique_id}_${uniqueId}_${baseOriginal}${ext}`;

            const storagePath = `service_files/${body_data.service_unique_id}/${filename}`;
            const fileRef = admin.storage().bucket().file(storagePath);
            await fileRef.save(file.buffer);
            const downloadUrl = await getDownloadURL(fileRef);

            // --- Extract EXIF timestamp if available ---
            let takenAt = null;
            try {
                // Only attempt EXIF parsing for JPEG files
                if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
                    const parser = ExifParser.create(file.buffer);
                    const exifData = parser.parse();

                    if (exifData.tags?.DateTimeOriginal) {
                        takenAt = new Date(exifData.tags.DateTimeOriginal * 1000).toISOString();
                    }
                } else {
                    console.warn(`Skipping EXIF for ${file.originalname} (type: ${file.mimetype})`);
                }
            } catch (err) {
                console.warn(`Failed to parse EXIF for ${file.originalname}:`, err.message);
            }

            return {
                downloadUrl,
                originalName: file.originalname,
                size: file.size,
                type: file.mimetype,
                takenAt,
                storagePath, // optional, but useful for cleanup/deletion
            };
        }));


        // Update the service document in Firestore
        const service_ref = await admin.firestore().collection('service')
            .doc(body_data.service_unique_id)
            .update({
                status: "COMPLETED",
                technician: body_data.technician,
                service_type: body_data.service_type,
                outcome_details: body_data.outcome_details,
                file_references: fileInfos,
                closed_at: admin.firestore.FieldValue.serverTimestamp(),
            });

        return { service_ref };
    }

    /**
     * Marks a service request as CANCELLED.
     * Uploads a single evidence file and updates the Firestore document with status and outcome details.
     */
    static async cancel_service_request(body_data, file_data) {
        console.log('canceling service request')

        // --- Sanitize original name ---
        const sanitize = (name) => name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

        const ext = '.' + String(file_data.originalname).split('.').pop().toLowerCase();
        const baseOriginal = sanitize(String(file_data.originalname).replace(/\.[^/.]+$/, ''));

        // --- Generate unique filename ---
        const uniqueId = crypto.randomUUID();
        const filename = `${body_data.service_unique_id}_${uniqueId}_${baseOriginal}${ext}`;

        const storagePath = `service_files/${body_data.service_unique_id}/${filename}`;
        const fileRef = admin.storage().bucket().file(storagePath);
        await fileRef.save(file_data.buffer);
        const downloadUrl = await getDownloadURL(fileRef);

        // --- Extract EXIF timestamp if available ---
        let takenAt = null;
        try {
            // Only attempt EXIF parsing for JPEG files
            if (file_data.mimetype === 'image/jpeg' || file_data.mimetype === 'image/jpg') {
                const parser = ExifParser.create(file_data.buffer);
                const exifData = parser.parse();

                if (exifData.tags?.DateTimeOriginal) {
                    takenAt = new Date(exifData.tags.DateTimeOriginal * 1000).toISOString();
                }
            } else {
                console.warn(`Skipping EXIF for ${file_data.originalname} (type: ${file_data.mimetype})`);
            }
        } catch (err) {
            console.warn(`Failed to parse EXIF for ${file_data.originalname}:`, err.message);
        }

        const fileInfo = {
            downloadUrl,
            originalName: file_data.originalname,
            size: file_data.size,
            type: file_data.mimetype,
            takenAt,
            storagePath, // optional, but useful for cleanup/deletion
        };

        let service_ref = await admin.firestore().collection('service').doc(body_data.service_unique_id).update({
            status: "CANCELLED",
            outcome_details: body_data.outcome_details,
            file_references: [fileInfo],
            closed_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { service_ref }
    }

    /**
     * Returns a paginated page of service requests ordered by creation date (newest first).
    * @param {number} limit        - Documents per page (max 50, default 25)
     * @param {string|null} cursorDocId - Firestore doc ID of the last item from the previous page
     * @returns {{ items: object[], nextCursor: string|null, hasMore: boolean }}
     */
    static async get_service_list_paged(limit = 25, cursorDocId = null, ownerUid = null) {
        let q = admin.firestore().collection('service')
        if (ownerUid) {
            q = q.where('added_by_user_uid', '==', ownerUid)
        }
        q = q.orderBy('created_at').limit(limit)
        if (cursorDocId) {
            const cursorDoc = await admin.firestore().collection('service').doc(cursorDocId).get()
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
}

module.exports = wrapStaticMethods(Service);
