const Doctor = require('../models/doctorModel')

const doctorController = {
    getDoctorList: async (req, res) => {
        try {
            let p_data = await Doctor.get_doctor_list()

            res.status(200).json({ operation: "success", message: "Doctor list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    saveDoctor: async (req, res) => {
        try {
            await Doctor.add_doctor(req.body.current_user_uid, req.body.current_user_name, req.body, req.file)
 
            return res.status(200).json({ operation: "success", message: "Doctor saved successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    getDoctorSignature: async (req, res) => {
        try {
            let p_data = await Doctor.get_doctor_signature(req.body.doctor_id)

            res.status(200).json({ operation: "success", message: "Doctor signature fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = doctorController;

