const Branch = require('../models/branchModel')

const branchController = {
    getBranchList: async (req, res) => {
        try {
            let p_data = await Branch.get_branch_list()

            res.status(200).json({ operation: "success", message: "Branch list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    saveBranch: async (req, res) => {
        try {
            await Branch.add_branch(req.body.current_user_uid, req.body.current_user_name, req.body)

            return res.status(200).json({ operation: "success", message: "Branch saved successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = branchController;

