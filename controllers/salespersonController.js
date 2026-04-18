/**
 * salespersonController — Handles Salesperson management.
 */
const Salesperson = require('../models/salespersonModel')
const cache = require('../utils/cache')
const { sendServerError } = require('../utils/errorResponse')
const { setCacheControl } = require('../utils/cacheHeaders')
const { safeError } = require('../utils/safeLogger')

const salespersonController = {
    /**
     * Returns all salespersons ordered by name.
     * Requires generate_invoice or sales_report access.
     * Body: { current_user_uid, current_user_name }
     */
    getSalespersonList: async (req, res) => {
        try {
            let p_data = await Salesperson.get_salesperson_list()

            setCacheControl(res, 'private', 300);
            res.status(200).json({ operation: "success", message: "Salesperson list fetched successfully", info: p_data });
        } catch (error) {
            safeError('salespersonController.getSalespersonList', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Adds a new salesperson.
     * Requires admin_panel access.
     * Body: { current_user_uid, current_user_name, salesperson_name }
     */
    saveSalesperson: async (req, res) => {
        try {
            await Salesperson.add_salesperson(req.body.current_user_uid, req.body.current_user_name, req.body)
            cache.invalidate('salesperson-list')

            return res.status(200).json({ operation: "success", message: "Salesperson saved successfully" });

        } catch (error) {
            safeError('salespersonController.saveSalesperson', error);
            return sendServerError(res, error);
        }
    },
};

module.exports = salespersonController;

