const User = require('../models/userModel');
const admin = require('firebase-admin')
const serviceAccount = require("../happy-ears-service-config.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const userController = {
    signup: async (req, res) => {
        try {

            res.status(402).json({ operation: "success", message: "signup success" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
    logout: async (req, res) => {
        try {

            res.status(402).json({ operation: "success", message: "log out success" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    }
};

module.exports = userController;
