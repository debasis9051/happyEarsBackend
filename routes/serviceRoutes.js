/**
 * Service routes
 * POST /get-service-list                   — Requires service access
 * POST /get-patient-service-reports-by-id  — Requires patients access
 * POST /create-service-request             — Requires service access
 * POST /complete-service-request           — Requires service access; accepts multipart/form-data (up to 3 files)
 * POST /cancel-service-request             — Requires service access; accepts multipart/form-data (1 file)
 */
const express = require('express');
const multer = require('multer')
const serviceController = require('../controllers/serviceController');
const checkJwt = require('../checkJwt');

const upload = multer()
const serviceRoutes = express.Router();

serviceRoutes.post('/get-service-list', checkJwt(["service"]), serviceController.getServiceList);
serviceRoutes.post('/get-service-list-paged', checkJwt(["service"]), serviceController.getServiceListPaged);
serviceRoutes.post('/get-patient-service-reports-by-id', checkJwt(["patients"]), serviceController.getPatientServiceReportsById);
serviceRoutes.post('/create-service-request', checkJwt(["service"]), serviceController.createServiceRequest);
serviceRoutes.post('/complete-service-request', upload.array("uploaded_files", 3), checkJwt(["service"]), serviceController.completeServiceRequest);
serviceRoutes.post('/cancel-service-request', upload.single("uploaded_file"), checkJwt(["service"]), serviceController.cancelServiceRequest);

module.exports = serviceRoutes;