const express = require('express');
const checkJwt = require('../checkJwt');
const invoiceController = require('../controllers/invoiceController');

const invoiceRoutes = express.Router();

invoiceRoutes.post('/get-invoice-list', checkJwt(["sales_report"]), invoiceController.getInvoiceList);
invoiceRoutes.post('/get-invoice-number', checkJwt(["generate_invoice"]), invoiceController.getInvoiceNumber);
invoiceRoutes.post('/save-invoice', checkJwt(["generate_invoice"]), invoiceController.saveInvoice);
invoiceRoutes.post('/update-invoice', checkJwt(["sales_report"]), invoiceController.updateInvoice);

invoiceRoutes.post('/invoice/:invoice_id', checkJwt(["inventory"]), invoiceController.deleteInvoice);
invoiceRoutes.post('/invoice/product/:product_id', checkJwt(["inventory"]), invoiceController.getProductAssociatedInvoice);

module.exports = invoiceRoutes;