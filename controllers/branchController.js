/**
 * branchController — Handles Branch management.
 */
const Branch = require('../models/branchModel')
const cache = require('../utils/cache')
const { sendServerError } = require('../utils/errorResponse')
const { setCacheControl } = require('../utils/cacheHeaders')
const { safeError } = require('../utils/safeLogger')

const branchController = {
    /**
     * Returns all branches ordered by name.
     * Requires generate_invoice, inventory, or sales_report access.
     * Body: { current_user_uid, current_user_name }
     */
    getBranchList: async (req, res) => {
        try {
            let p_data = await Branch.get_branch_list()

            setCacheControl(res, 'private', 300);
            res.status(200).json({ operation: "success", message: "Branch list fetched successfully", info: p_data });
        } catch (error) {
            safeError('branchController.getBranchList', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Adds a new branch.
     * Requires admin_panel access.
     * Body: { current_user_uid, current_user_name, branch_name, branch_invoice_code }
     */
    saveBranch: async (req, res) => {
        try {
            await Branch.add_branch(req.body.current_user_uid, req.body.current_user_name, req.body)
            cache.invalidate('branch-list')

            return res.status(200).json({ operation: "success", message: "Branch saved successfully" });

        } catch (error) {
            safeError('branchController.saveBranch', error);
            return sendServerError(res, error);
        }
    },
};

module.exports = branchController;

