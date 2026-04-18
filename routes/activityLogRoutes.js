const express = require('express');
const checkJwt = require('../checkJwt');
const activityLogController = require('../controllers/activityLogController');

const activityLogRoutes = express.Router();

activityLogRoutes.post('/get-activity-logs', checkJwt(['admin_panel']), activityLogController.getActivityLogs);
activityLogRoutes.post('/get-activity-log-retention', checkJwt(['admin_panel']), activityLogController.getActivityLogRetention);
activityLogRoutes.post('/delete-activity-logs', checkJwt(['admin_panel']), activityLogController.deleteActivityLogs);
activityLogRoutes.post('/delete-old-activity-logs', checkJwt(['admin_panel']), activityLogController.deleteOldActivityLogs);

module.exports = activityLogRoutes;
