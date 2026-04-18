/**
 * patientController — Handles Patient record CRUD and associated document lookup.
 */
const Patient = require('../models/patientModel')
const { sendServerError } = require('../utils/errorResponse')
const { setCacheControl } = require('../utils/cacheHeaders')
const { safeError } = require('../utils/safeLogger')

const patientController = {
    _ownerScopeUid: (req) => (req.authAccess?.admin_panel ? null : req.authUserUid),
    // Legacy unbounded endpoint kept as reference only.
    // Do NOT enable in production; this can spike Firestore reads.
    // getPatientList: async (req, res) => {
    //     try {
    //         const ownerUid = patientController._ownerScopeUid(req)
    //         let p_data = await Patient.get_patient_list(ownerUid)
    //
    //         setCacheControl(res, 'private', 300);
    //         res.status(200).json({ operation: "success", message: "Patient list fetched successfully", info: p_data });
    //     } catch (error) {
    //         console.error(error);
    //         return sendServerError(res, error);
    //     }
    // },

    /**
     * Returns the next sequential patient number (max existing + 1).
     * Requires patients access.
     * Body: { current_user_uid, current_user_name }
     */
    getPatientNumber: async (req, res) => {
        try {
            let c = await Patient.get_max_patient_number()

            res.status(200).json({ operation: "success", message: "Patient number fetched successfully", info: c + 1 });
        } catch (error) {
            safeError('patientController.getPatientNumber', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns a single patient's details by their Firestore document ID.
     * No specific access-page required (checkJwt([]) — any authenticated user).
     * Body: { patient_id }
     */
    getPatientDetailsById: async (req, res) => {
        try {
            const ownerUid = patientController._ownerScopeUid(req)
            let p_data = await Patient.get_patient_by_patient_id(req.body.patient_id, ownerUid)

            if (!p_data) {
                return res.status(404).json({ operation: "failed", message: "No such Patient" });
            }

            res.status(200).json({ operation: "success", message: "Patient details fetched successfully", info: p_data });
        } catch (error) {
            safeError('patientController.getPatientDetailsById', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns all audiometry reports and invoices linked to a patient.
     * Requires patients access.
     * Body: { current_user_uid, current_user_name, patient_id }
     */
    getPatientDocsById: async (req, res) => {
        try {
            const ownerUid = patientController._ownerScopeUid(req)
            let p_data = await Patient.get_patient_docs_by_patient_id(req.body.patient_id, ownerUid)

            res.status(200).json({ operation: "success", message: "Patient associated docs fetched successfully", info: p_data });
        } catch (error) {
            safeError('patientController.getPatientDocsById', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Creates a new patient or updates an existing one (determined by presence of patient_id).
     * Validates that the patient_number is unique across all patients (excluding the patient being edited).
     * Requires patients access.
     * Body: { current_user_uid, current_user_name, patient_name, contact_number, patient_number,
     *         age, sex, patient_address, notes, map_coordinates, patient_id? }
     */
    configurePatient: async (req, res) => {
        try {
            const ownerUid = patientController._ownerScopeUid(req)
            let t = await Patient.get_patient_by_patient_number(req.body.patient_number)
            if (t.length > 0 && (!req.body.patient_id || t[0].id != req.body.patient_id)) {
                return res.status(409).json({ operation: "failed", message: "Patient against given Patient Number already exists" });
            }

            let patientRef
            if (req.body.patient_id) {
                const existing = await Patient.get_patient_by_patient_id(req.body.patient_id, ownerUid)
                if (!existing) {
                    return res.status(404).json({ operation: "failed", message: "No such Patient" });
                }
                await Patient.update_patient(req.body)
            }
            else {
                patientRef = await Patient.add_patient(req.authUserUid, req.authUserName || req.body.current_user_name, req.body)
            }

            return res.status(200).json({ operation: "success", message: `Patient ${req.body.patient_id ? "updated" : "added"} successfully`, info: { patient_name: req.body.patient_name, patient_id: req.body.patient_id || patientRef.id } });

        } catch (error) {
            safeError('patientController.configurePatient', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns a cursor-paginated page of patients (newest first).
     * Body: { current_user_uid, current_user_name, limit?, cursor? }
     * Response info: { items, nextCursor, hasMore }
     */
    getPatientListPaged: async (req, res) => {
        try {
            const ownerUid = patientController._ownerScopeUid(req)
            const parsedLimit = parseInt(req.body.limit)
            const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25
            const limit = Math.min(safeLimit, 50)  // hard cap: max 50 docs per page
            const cursorDocId = req.body.cursor || null
            const result = await Patient.get_patient_list_paged(limit, cursorDocId, ownerUid)
            setCacheControl(res, 'private', 60)
            res.status(200).json({ operation: "success", message: "Patient list page fetched successfully", info: result })
        } catch (error) {
            safeError('patientController.getPatientListPaged', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns lightweight patient rows for a provided list of ids.
     * Body: { patient_ids: string[], current_user_uid, current_user_name }
     */
    getPatientsBriefByIds: async (req, res) => {
        try {
            const ownerUid = patientController._ownerScopeUid(req)
            const patientIds = Array.isArray(req.body.patient_ids) ? req.body.patient_ids : []
            const result = await Patient.get_patients_brief_by_ids(patientIds, ownerUid)

            setCacheControl(res, 'private', 60)
            return res.status(200).json({ operation: 'success', message: 'Patient brief list fetched successfully', info: result })
        } catch (error) {
            console.error(error)
            return sendServerError(res, error)
        }
    },

    /**
     * Searches patient brief records by name/contact/patient number.
     * Body: { search_term: string, limit?: number, current_user_uid, current_user_name }
     */
    searchPatientsBrief: async (req, res) => {
        try {
            const ownerUid = patientController._ownerScopeUid(req)
            const searchTerm = (req.body.search_term || '').toString()
            const parsedLimit = parseInt(req.body.limit)
            const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25
            const limit = Math.min(safeLimit, 100)
            const result = await Patient.search_patients_brief(searchTerm, limit, ownerUid)

            setCacheControl(res, 'private', 30)
            return res.status(200).json({ operation: 'success', message: 'Patient search fetched successfully', info: result })
        } catch (error) {
            safeError('patientController.getPatientsBriefByIds', error)
            return sendServerError(res, error)
        }
    },
};

module.exports = patientController;

