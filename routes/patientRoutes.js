const express = require('express');
const patientController = require('../controllers/patientController');
const checkJwt = require('../checkJwt');

const patientRoutes = express.Router();

patientRoutes.post('/get-patient-list', checkJwt(["audiometry", "patients"]), patientController.getPatientList);
patientRoutes.post('/get-patient-number', checkJwt(["patients"]), patientController.getPatientNumber);
patientRoutes.post('/get-patient-details-by-id', checkJwt([]), patientController.getPatientDetailsById);
patientRoutes.post('/get-patient-docs-by-id', checkJwt(["patients"]), patientController.getPatientDocsById);
patientRoutes.post('/configure-patient', checkJwt(["patients"]), patientController.configurePatient);

module.exports = patientRoutes;