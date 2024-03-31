const express = require('express');
const salespersonController = require('../controllers/salespersonController');
const checkJwt= require('../checkJwt');

const salespersonRoutes = express.Router();

salespersonRoutes.post('/get-salesperson-list', checkJwt, salespersonController.getSalespersonList);
salespersonRoutes.post('/save-salesperson', checkJwt, salespersonController.saveSalesperson);

salespersonRoutes.post('/custom-script', checkJwt, salespersonController.customScript);

module.exports = salespersonRoutes;