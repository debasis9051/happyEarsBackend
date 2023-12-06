const express = require('express');
const userController = require('../controllers/userController');

const userRoutes = express.Router();

userRoutes.post('/signup', userController.signup);
userRoutes.post('/logout', userController.logout);
userRoutes.post('/get-current-user', userController.getCurrentUser);

module.exports = userRoutes;