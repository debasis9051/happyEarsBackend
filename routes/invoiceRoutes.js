const express = require('express');
const multer = require('multer')
const checkJwt= require('../checkJwt');
const invoiceController = require('../controllers/invoiceController');

const invoiceRoutes = express.Router();

invoiceRoutes.post('/get-invoice-list', checkJwt, invoiceController.getInvoiceList);
invoiceRoutes.post('/get-invoice-number', checkJwt, invoiceController.getInvoiceNumber);
invoiceRoutes.post('/save-invoice', checkJwt, invoiceController.saveInvoice);
invoiceRoutes.post('/update-invoice', checkJwt, invoiceController.updateInvoice);

module.exports = invoiceRoutes;