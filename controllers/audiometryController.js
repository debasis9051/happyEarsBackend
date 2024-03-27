const Audiometry = require('../models/audiometryModel')

const audiometryController = {
    getAudiometryList: async (req, res) => {
        try {
            let p_data = await Audiometry.get_audiometry_list()

            res.status(200).json({ operation: "success", message: "Audiometry list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    saveAudiometryReport: async (req, res) => {
        try {
            await Audiometry.add_audiometry_report(req.body.current_user_uid, req.body.current_user_name, req.body)

            return res.status(200).json({ operation: "success", message: "Audiometry Report saved successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = audiometryController;

