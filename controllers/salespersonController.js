const Salesperson = require('../models/salespersonModel')

const salespersonController = {
    getSalespersonList: async (req, res) => {
        try {
            let p_data = await Salesperson.get_salesperson_list()

            res.status(200).json({ operation: "success", message: "Salesperson list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    saveSalesperson: async (req, res) => {
        try {
            await Salesperson.add_salesperson(req.body.current_user_uid, req.body.current_user_name, req.body)

            return res.status(200).json({ operation: "success", message: "Salesperson saved successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    testRoute: async (req, res) => {
        try {
            await Salesperson.test()

            return res.status(200).json({ operation: "success", message: "Script executed successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = salespersonController;

