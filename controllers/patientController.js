const Patient = require('../models/patientModel')

const patientController = {
    getPatientList: async (req, res) => {
        try {
            let p_data = await Patient.get_patient_list()

            res.status(200).json({ operation: "success", message: "Patient list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    getPatientNumber: async (req, res) => {
        try {
            let c = await Patient.get_max_patient_number()

            res.status(200).json({ operation: "success", message: "Patient number fetched successfully", info: c + 1 });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    getPatientDetailsById: async (req, res) => {
        try {
            let p_data = await Patient.get_patient_by_patient_id(req.body.patient_id)

            res.status(200).json({ operation: "success", message: "Patient details fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    getPatientDocsById: async (req, res) => {
        try {
            let p_data = await Patient.get_patient_docs_by_patient_id(req.body.patient_id)

            res.status(200).json({ operation: "success", message: "Patient associated docs fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    configurePatient: async (req, res) => {
        try {
            let t = await Patient.get_patient_by_patient_number(req.body.patient_number)
            if (t.length > 0 && (!req.body.patient_id || t[0].id != req.body.patient_id)) {
                return res.status(200).json({ operation: "failed", message: "Patient against given Patient Number already exists" });
            }

            let patientRef
            if (req.body.patient_id) {
                await Patient.update_patient(req.body)
            }
            else {
                patientRef = await Patient.add_patient(req.body.current_user_uid, req.body.current_user_name, req.body)
            }

            return res.status(200).json({ operation: "success", message: `Patient ${req.body.patient_id ? "updated" : "added"} successfully`, info: { patient_name: req.body.patient_name, patient_id: req.body.patient_id || patientRef.id } });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = patientController;

