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

    getAuthenticatedUserList: async (req, res) => {
        try {
            let p_data = await User.get_authenticated_user_list()

            res.status(200).json({ operation: "success", message: "Auth Users list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = userController;
