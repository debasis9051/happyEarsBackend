const express = require('express');
const audiometryController = require('../controllers/audiometryController');
const checkJwt= require('../checkJwt');

const audiometryRoutes = express.Router();

audiometryRoutes.post('/get-audiometry-list', checkJwt, audiometryController.getAudiometryList);
audiometryRoutes.post('/save-audiometry-report', checkJwt, audiometryController.saveAudiometryReport);
// audiometryRoutes.post('/update-audiometry-report', checkJwt, audiometryController.updateAudiometryReport);

module.exports = audiometryRoutes;