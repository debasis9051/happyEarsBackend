const express = require('express');
const branchController = require('../controllers/branchController');
const checkJwt= require('../checkJwt');

const branchRoutes = express.Router();

branchRoutes.post('/get-branch-list', checkJwt, branchController.getBranchList);
branchRoutes.post('/save-branch', checkJwt, branchController.saveBranch);

module.exports = branchRoutes;