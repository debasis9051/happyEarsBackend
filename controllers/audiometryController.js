/**
 * audiometryController — Handles Audiometry report CRUD.
 */
const Audiometry = require('../models/audiometryModel')
const { sendServerError } = require('../utils/errorResponse')
const { setCacheControl } = require('../utils/cacheHeaders')
const { safeError } = require('../utils/safeLogger')

const audiometryController = {
    _ownerScopeUid: (req) => (req.authAccess?.admin_panel ? null : req.authUserUid),
    // Legacy unbounded endpoint kept commented for future reference only.
    // Do NOT enable in production: this can spike Firestore reads on large collections.
    // getAudiometryList: async (req, res) => {
    //     try {
    //         const ownerUid = audiometryController._ownerScopeUid(req)
    //         let p_data = await Audiometry.get_audiometry_list(ownerUid)
    //
    //         setCacheControl(res, 'private', 300);
    //         res.status(200).json({ operation: "success", message: "Audiometry list fetched successfully", info: p_data });
    //     } catch (error) {
    //         console.error(error);
    //         return sendServerError(res, error);
    //     }
    // },

    /**
     * Returns a single audiometry report by its document ID.
     * Requires generate_invoice access (used when printing invoice with audiometry data).
     * Body: { current_user_uid, current_user_name, audiometry_report_id }
     */
    getAudiometryReportById: async (req, res) => {
        try {
            const ownerUid = audiometryController._ownerScopeUid(req)
            let p_data = await Audiometry.get_audiometry_report_by_audiometry_report_id(req.body.audiometry_report_id, ownerUid)

            if(p_data){
                res.status(200).json({ operation: "success", message: "Audiometry Report by ID fetched successfully", info: p_data });
            }
            else{
                res.status(404).json({ operation: "failed", message: "No such Audiometry Report" });
            }
        } catch (error) {
            safeError('audiometryController.getAudiometryReportById', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Saves a new audiometry report for a patient.
     * Requires audiometry access.
     * Body: { current_user_uid, current_user_name, ...all audiometry fields }
     */
    saveAudiometryReport: async (req, res) => {
        try {
            await Audiometry.add_audiometry_report(req.authUserUid, req.authUserName || req.body.current_user_name, req.body)

            return res.status(200).json({ operation: "success", message: "Audiometry Report saved successfully" });

        } catch (error) {
            safeError('audiometryController.saveAudiometryReport', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Updates editable fields on an existing audiometry report.
     * Validates that the report exists before updating.
     * Requires audiometry access.
     * Body: { current_user_uid, current_user_name, audiometry_report_id, ...updatable fields }
     */
    updateAudiometryReport: async (req, res) => {
        try {
            const ownerUid = audiometryController._ownerScopeUid(req)
            let t = await Audiometry.get_audiometry_report_by_audiometry_report_id(req.body.audiometry_report_id, ownerUid)
            if (!t) {
                return res.status(404).json({ operation: "failed", message: "No such Audiometry report exists" });
            }

            await Audiometry.update_audiometry_report(req.body)

            return res.status(200).json({ operation: "success", message: "Audiometry report updated successfully" });

        } catch (error) {
            safeError('audiometryController.updateAudiometryReport', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns a cursor-paginated page of audiometry reports (newest first).
     * Body: { current_user_uid, current_user_name, limit?, cursor?, branch_id? }
     * Response info: { items, nextCursor, hasMore }
     */
    getAudiometryListPaged: async (req, res) => {
        try {
            const ownerUid = audiometryController._ownerScopeUid(req)
            const parsedLimit = parseInt(req.body.limit)
            const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25
            const limit = Math.min(safeLimit, 50)  // hard cap: max 50 docs per page
            const cursorDocId = req.body.cursor || null
            const branchId = req.body.branch_id || null
            const result = await Audiometry.get_audiometry_list_paged(limit, cursorDocId, ownerUid, branchId)
            setCacheControl(res, 'private', 60)
            res.status(200).json({ operation: "success", message: "Audiometry list page fetched successfully", info: result })
        } catch (error) {
            safeError('audiometryController.getAudiometryListPaged', error);
            return sendServerError(res, error);
        }
    },
};

module.exports = audiometryController;

