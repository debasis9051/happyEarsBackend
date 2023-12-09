const express = require('express');
const userController = require('../controllers/userController');

const userRoutes = express.Router();

userRoutes.post('/signup', userController.signup);
userRoutes.post('/logout', userController.logout);

module.exports = userRoutes;