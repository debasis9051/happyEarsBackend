/**
 * Invoice routes
 * POST /get-invoice-list-paged          — Requires sales_report access
 * POST /get-invoices-for-month-report   — Requires sales_report access; full-month fetch for Reports tab
 * POST /get-invoice-number              — Requires generate_invoice access
 * POST /save-invoice                    — Requires generate_invoice access
 * POST /update-invoice                  — Requires sales_report access
 * POST /invoice/:invoice_id             — Delete invoice; requires inventory access
 * POST /invoice/product/:product_id     — Get product-associated invoice; requires inventory access
 */
const express = require('express');
const checkJwt = require('../checkJwt');
const invoiceController = require('../controllers/invoiceController');

const invoiceRoutes = express.Router();

// Legacy unbounded endpoint kept commented for reference only.
// invoiceRoutes.post('/get-invoice-list', checkJwt(["sales_report"]), invoiceController.getInvoiceList);
invoiceRoutes.post('/get-invoice-list-paged', checkJwt(["sales_report"]), invoiceController.getInvoiceListPaged);
invoiceRoutes.post('/get-invoices-for-month-report', checkJwt(["sales_report"]), invoiceController.getInvoicesForMonthReport);
invoiceRoutes.post('/get-invoice-number', checkJwt(["generate_invoice"]), invoiceController.getInvoiceNumber);
invoiceRoutes.post('/save-invoice', checkJwt(["generate_invoice"]), invoiceController.saveInvoice);
invoiceRoutes.post('/update-invoice', checkJwt(["sales_report"]), invoiceController.updateInvoice);

invoiceRoutes.post('/invoice/:invoice_id', checkJwt(["inventory"]), invoiceController.deleteInvoice);
invoiceRoutes.post('/invoice/product/:product_id', checkJwt(["inventory"]), invoiceController.getProductAssociatedInvoice);

module.exports = invoiceRoutes;