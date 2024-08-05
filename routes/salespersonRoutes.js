const express = require('express');
const salespersonController = require('../controllers/salespersonController');
const checkJwt = require('../checkJwt');

const salespersonRoutes = express.Router();

salespersonRoutes.post('/get-salesperson-list', checkJwt(["generate_invoice", "sales_report"]), salespersonController.getSalespersonList);
salespersonRoutes.post('/save-salesperson', checkJwt(["admin_panel"]), salespersonController.saveSalesperson);

module.exports = salespersonRoutes;