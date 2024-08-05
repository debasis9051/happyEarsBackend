const express = require('express');
const audiometryController = require('../controllers/audiometryController');
const checkJwt= require('../checkJwt');

const audiometryRoutes = express.Router();

audiometryRoutes.post('/get-audiometry-list', checkJwt(["audiometry"]), audiometryController.getAudiometryList);
audiometryRoutes.post('/save-audiometry-report', checkJwt(["audiometry"]), audiometryController.saveAudiometryReport);
audiometryRoutes.post('/update-audiometry-report', checkJwt(["audiometry"]), audiometryController.updateAudiometryReport);

module.exports = audiometryRoutes;