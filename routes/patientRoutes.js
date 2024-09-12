const express = require('express');
const patientController = require('../controllers/patientController');
const checkJwt = require('../checkJwt');

const patientRoutes = express.Router();

patientRoutes.post('/get-patient-list', checkJwt(["patients"]), patientController.getPatientList);
patientRoutes.post('/configure-patient', checkJwt(["patients"]), patientController.configurePatient);

module.exports = patientRoutes;