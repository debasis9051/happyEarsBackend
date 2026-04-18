/**
 * serviceController — Handles Service request lifecycle (create, complete, cancel).
 */
const Service = require('../models/serviceModel')
const { sendServerError } = require('../utils/errorResponse')
const { setCacheControl } = require('../utils/cacheHeaders')
const { safeError } = require('../utils/safeLogger')

const serviceController = {
    _ownerScopeUid: (req) => (req.authAccess?.admin_panel ? null : req.authUserUid),
    /**
     * Returns all service requests ordered by creation date.
     * Requires service access.
     * Body: { current_user_uid, current_user_name }
     */
    getServiceList: async (req, res) => {
        try {
            const ownerUid = serviceController._ownerScopeUid(req)
            let p_data = await Service.get_service_list(ownerUid)

            setCacheControl(res, 'private', 300);
            res.status(200).json({ operation: "success", message: "Service list fetched successfully", info: p_data });
        } catch (error) {
            safeError('serviceController.getServiceList', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns all service reports associated with a specific patient.
     * Requires patients access.
     * Body: { current_user_uid, current_user_name, patient_id }
     */
    getPatientServiceReportsById: async (req, res) => {
        try {
            const ownerUid = serviceController._ownerScopeUid(req)
            let p_data = await Service.get_patient_service_reports_by_id(req.body.patient_id, ownerUid)

            res.status(200).json({ operation: "success", message: "Service Reports fetched successfully", info: p_data });
        } catch (error) {
            safeError('serviceController.getPatientServiceReportsById', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Creates a new service request in PENDING status.
     * Returns the generated numeric service_id in the response.
     * Requires service access.
     * Body: { current_user_uid, current_user_name, patient_id, problem_description }
     */
    createServiceRequest: async (req, res) => {
        try {
            let { service_id } = await Service.create_service_request(req.authUserUid, req.authUserName || req.body.current_user_name, req.body)

            return res.status(200).json({ operation: "success", message: `Service Request added successfully. Service ID: ${service_id}`, info: { service_id } });
        } catch (error) {
            safeError('serviceController.createServiceRequest', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Marks a service request as COMPLETED and uploads up to 3 evidence files to Firebase Storage.
     * Extracts EXIF timestamps from JPEG images when available.
     * Requires service access; uses multer to parse the uploaded files.
     * Body (multipart): { current_user_uid, current_user_name, service_unique_id,
     *                    technician, service_type, outcome_details, uploaded_files }
     */
    completeServiceRequest: async (req, res) => {
        try {
            const ownerUid = serviceController._ownerScopeUid(req)
            const existing = await Service.get_service_by_id(req.body.service_unique_id, ownerUid)
            if (!existing) {
                return res.status(404).json({ operation: "failed", message: "No such Service Request" });
            }
            await Service.complete_service_request(req.body, req.files)

            return res.status(200).json({ operation: "success", message: "Service Request completed successfully" });
        } catch (error) {
            safeError('serviceController.completeServiceRequest', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Marks a service request as CANCELLED and uploads a single cancellation evidence file.
     * Requires service access; uses multer to parse the uploaded file.
     * Body (multipart): { current_user_uid, current_user_name, service_unique_id,
     *                    outcome_details, uploaded_file }
     */
    cancelServiceRequest: async (req, res) => {
        try {
            const ownerUid = serviceController._ownerScopeUid(req)
            const existing = await Service.get_service_by_id(req.body.service_unique_id, ownerUid)
            if (!existing) {
                return res.status(404).json({ operation: "failed", message: "No such Service Request" });
            }
            await Service.cancel_service_request(req.body, req.file)

            return res.status(200).json({ operation: "success", message: "Service Request cancelled successfully" });
        } catch (error) {
            safeError('serviceController.cancelServiceRequest', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns a cursor-paginated page of service requests (newest first).
     * Body: { current_user_uid, current_user_name, limit?, cursor? }
     * Response info: { items, nextCursor, hasMore }
     */
    getServiceListPaged: async (req, res) => {
        try {
            const ownerUid = serviceController._ownerScopeUid(req)
            const parsedLimit = parseInt(req.body.limit)
            const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25
            const limit = Math.min(safeLimit, 50)  // hard cap: max 50 docs per page
            const cursorDocId = req.body.cursor || null
            const result = await Service.get_service_list_paged(limit, cursorDocId, ownerUid)
            setCacheControl(res, 'private', 60)
            res.status(200).json({ operation: "success", message: "Service list page fetched successfully", info: result })
        } catch (error) {
            safeError('serviceController.getServiceListPaged', error);
            return sendServerError(res, error);
        }
    },
};

module.exports = serviceController;

