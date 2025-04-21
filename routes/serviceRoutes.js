const express = require('express');
const multer = require('multer')
const serviceController = require('../controllers/serviceController');
const checkJwt = require('../checkJwt');

const upload = multer()
const serviceRoutes = express.Router();

serviceRoutes.post('/get-service-list', checkJwt(["service"]), serviceController.getServiceList);
serviceRoutes.post('/create-service-request', checkJwt(["service"]), serviceController.createServiceRequest);
serviceRoutes.post('/complete-service-request', upload.single("uploaded_file"), checkJwt(["service"]), serviceController.completeServiceRequest);
serviceRoutes.post('/cancel-service-request', checkJwt(["service"]), serviceController.cancelServiceRequest);

module.exports = serviceRoutes;