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

    configurePatient: async (req, res) => {
        try {
            if(req.body.patient_id){
                await Patient.update_patient(req.body)
            }
            else{
                await Patient.add_patient(req.body.current_user_uid, req.body.current_user_name, req.body)
            }

            return res.status(200).json({ operation: "success", message: `Patient ${req.body.patient_id?"updated":"added"} successfully` });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = patientController;

