const express = require('express');
const checkJwt = require('../checkJwt');
const reportController = require('../controllers/reportController');

const reportRoutes = express.Router();

const reportAccess = ['sales_report', 'service', 'patients', 'inventory', 'generate_invoice', 'admin_panel'];

reportRoutes.post('/reports/dashboard-summary', checkJwt(reportAccess), reportController.getDashboardSummary);
reportRoutes.post('/reports/attention-queue-detail', checkJwt(reportAccess), reportController.getAttentionQueueDetail);
reportRoutes.post('/reports/module-overview', checkJwt(reportAccess), reportController.getModuleOverview);

module.exports = reportRoutes;