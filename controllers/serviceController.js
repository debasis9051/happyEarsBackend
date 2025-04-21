const Service = require('../models/serviceModel')

const serviceController = {
    getServiceList: async (req, res) => {
        try {
            let p_data = await Service.get_service_list()

            res.status(200).json({ operation: "success", message: "Service list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    createServiceRequest: async (req, res) => {
        try {
            let { service_id } = await Service.create_service_request(req.body.current_user_uid, req.body.current_user_name, req.body)

            return res.status(200).json({ operation: "success", message: `Service Request added successfully. Service ID: ${service_id}`, info: { service_id } });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    completeServiceRequest: async (req, res) => {
        try {
            await Service.complete_service_request(req.body, req.file)

            return res.status(200).json({ operation: "success", message: "Service Request completed successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    cancelServiceRequest: async (req, res) => {
        try {
            await Service.cancel_service_request(req.body)

            return res.status(200).json({ operation: "success", message: "Service Request cancelled successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = serviceController;

