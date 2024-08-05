const express = require('express');
const branchController = require('../controllers/branchController');
const checkJwt= require('../checkJwt');

const branchRoutes = express.Router();

branchRoutes.post('/get-branch-list', checkJwt(["generate_invoice","inventory","sales_report"]), branchController.getBranchList);
branchRoutes.post('/save-branch', checkJwt(["admin_panel"]), branchController.saveBranch);

module.exports = branchRoutes;