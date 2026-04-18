/**
 * Patient routes
 * POST /get-patient-list-paged     — Requires audiometry or patients access
 * POST /get-patient-number         — Requires patients access
 * POST /get-patient-details-by-id  — No specific page required (any authenticated user)
 * POST /get-patient-docs-by-id     — Requires patients access
 * POST /configure-patient          — Create or update patient; requires patients access
 */
const express = require('express');
const patientController = require('../controllers/patientController');
const checkJwt = require('../checkJwt');

const patientRoutes = express.Router();

// Legacy unbounded endpoint kept commented for reference only.
// patientRoutes.post('/get-patient-list', checkJwt(["audiometry", "patients"]), patientController.getPatientList);
patientRoutes.post('/get-patient-list-paged', checkJwt(["audiometry", "patients"]), patientController.getPatientListPaged);
patientRoutes.post('/get-patient-number', checkJwt(["patients"]), patientController.getPatientNumber);
patientRoutes.post('/get-patient-details-by-id', checkJwt([]), patientController.getPatientDetailsById);
patientRoutes.post('/get-patient-docs-by-id', checkJwt(["patients"]), patientController.getPatientDocsById);
patientRoutes.post('/get-patients-brief-by-ids', checkJwt(["audiometry", "patients", "generate_invoice", "sales_report", "service"]), patientController.getPatientsBriefByIds);
patientRoutes.post('/search-patients-brief', checkJwt(["audiometry", "patients", "generate_invoice", "sales_report", "service"]), patientController.searchPatientsBrief);
patientRoutes.post('/configure-patient', checkJwt(["patients"]), patientController.configurePatient);

module.exports = patientRoutes;