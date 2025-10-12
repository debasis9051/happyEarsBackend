const { getDownloadURL } = require("firebase-admin/storage")
const admin = require("../firebaseAdmin")
const wrapStaticMethods = require("../wrapStaticMethods")
const ExifParser = require("exif-parser")

class Service {
    static async get_service_list() {
        // console.log("getting service list")

        let q = admin.firestore().collection('service').orderBy("created_at")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async get_patient_service_request_history_by_id(patient_id) {
        // console.log("getting service request history by id")

        let q = admin.firestore().collection('service').where("patient_id", "==", patient_id)
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
}

module.exports = wrapStaticMethods(Service);
