/**
 * Audiometry routes
 * POST /get-audiometry-list-paged  — Requires audiometry access
 * POST /get-audiometry-report-by-id — Requires generate_invoice access
 * POST /save-audiometry-report     — Requires audiometry access
 * POST /update-audiometry-report   — Requires audiometry access
 */
const express = require('express');
const audiometryController = require('../controllers/audiometryController');
const checkJwt = require('../checkJwt');

const audiometryRoutes = express.Router();

// Legacy unbounded endpoint kept commented for reference only.
// audiometryRoutes.post('/get-audiometry-list', checkJwt(["audiometry"]), audiometryController.getAudiometryList);
audiometryRoutes.post('/get-audiometry-list-paged', checkJwt(["audiometry"]), audiometryController.getAudiometryListPaged);
audiometryRoutes.post('/get-audiometry-report-by-id', checkJwt(["generate_invoice"]), audiometryController.getAudiometryReportById);
audiometryRoutes.post('/save-audiometry-report', checkJwt(["audiometry"]), audiometryController.saveAudiometryReport);
audiometryRoutes.post('/update-audiometry-report', checkJwt(["audiometry"]), audiometryController.updateAudiometryReport);

module.exports = audiometryRoutes;