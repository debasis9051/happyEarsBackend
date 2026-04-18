/**
 * doctorController — Handles Doctor management including signature upload to Firebase Storage.
 */
const Doctor = require('../models/doctorModel')
const cache = require('../utils/cache')
const { sendServerError } = require('../utils/errorResponse')
const { setCacheControl } = require('../utils/cacheHeaders')
const { safeError } = require('../utils/safeLogger')

const doctorController = {
    /**
     * Returns all doctors ordered by name.
     * Requires audiometry access.
     * Body: { current_user_uid, current_user_name }
     */
    getDoctorList: async (req, res) => {
        try {
            let p_data = await Doctor.getCachedDoctorList()

            setCacheControl(res, 'private', 300);
            res.status(200).json({ operation: "success", message: "Doctor list fetched successfully", info: p_data });
        } catch (error) {
            safeError('doctorController.getDoctorList', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Adds a new doctor with their uploaded signature image stored in Firebase Storage.
     * Requires admin_panel access; uses multer to parse the uploaded signature file.
     * Body (multipart): { current_user_uid, current_user_name, doctor_name,
     *                    doctor_qualification, doctor_registration_number, doctor_signature_file }
     */
    saveDoctor: async (req, res) => {
        try {
            await Doctor.add_doctor(req.body.current_user_uid, req.body.current_user_name, req.body, req.file)
            cache.invalidate('doctor-list')
 
            return res.status(200).json({ operation: "success", message: "Doctor saved successfully" });

        } catch (error) {
            safeError('doctorController.saveDoctor', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns details for a single doctor by ID.
     * Requires audiometry access (used when generating audiometry reports).
     * Body: { current_user_uid, current_user_name, doctor_id }
     */
    getDoctorDetails: async (req, res) => {
        try {
            let p_data = await Doctor.get_doctor_details(req.body.doctor_id)

            res.status(200).json({ operation: "success", message: "Doctor details fetched successfully", info: p_data });
        } catch (error) {
            safeError('doctorController.getDoctorDetails', error);
            return sendServerError(res, error);
        }
    },
};

module.exports = doctorController;

