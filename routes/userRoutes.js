const express = require('express');
const userController = require('../controllers/userController');

const userRoutes = express.Router();

userRoutes.post('/create-user', userController.createUser);

module.exports = userRoutes;