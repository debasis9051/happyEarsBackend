const User = require('../models/userModel');

const userController = {
    createUser: async (req, res) => {
        try {
            let t = await User.get(req.body.user_uid)
            if(t == null){
                await User.create(req.body.user_uid, req.body.user_name, req.body.user_email, req.body.user_photo)            
                res.status(200).json({ operation: "success", message: "create user success" });
            }
            else{
                res.status(200).json({ operation: "success", message: "user already exists" });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    getUserDetails: async (req, res) => {
        try {
            let t = await User.get(req.body.user_uid)
            if(t){
                res.status(200).json({ operation: "success", message: "get user success", info: t });
            }
            else{
                res.status(200).json({ operation: "failed", message: "no such user" });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    getUserList: async (req, res) => {
        try {
            let p_data = await User.get_user_list()

            res.status(200).json({ operation: "success", message: "User list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    updateUserAccess: async (req, res) => {
        try {
            let t = await User.get(req.body.user_id)
            if (!t) {
                return res.status(200).json({ operation: "failed", message: "No such User exists" });
            }

            await User.update_user_access(req.body)

            return res.status(200).json({ operation: "success", message: "User access updated successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = userController;
