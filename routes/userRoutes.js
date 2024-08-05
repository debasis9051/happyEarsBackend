const express = require('express');
const userController = require('../controllers/userController');
const checkJwt = require('../checkJwt');

const userRoutes = express.Router();

userRoutes.post('/create-user', userController.createUser);
userRoutes.post('/get-user-details', userController.getUserDetails);
userRoutes.post('/get-user-list', checkJwt(["admin_panel"]), userController.getUserList); 
userRoutes.post('/update-user-access', checkJwt(["admin_panel"]), userController.updateUserAccess); 

module.exports = userRoutes;