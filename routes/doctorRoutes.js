const express = require('express');
const multer = require('multer')
const checkJwt= require('../checkJwt');
const doctorController = require('../controllers/doctorController');

const upload = multer()
const doctorRoutes = express.Router();

doctorRoutes.post('/get-doctor-list', checkJwt, doctorController.getDoctorList);
doctorRoutes.post('/save-doctor', upload.single("doctor_signature_file"), checkJwt, doctorController.saveDoctor);

module.exports = doctorRoutes;