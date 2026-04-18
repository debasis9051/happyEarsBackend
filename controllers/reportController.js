const Report = require('../models/reportModel');
const { sendServerError } = require('../utils/errorResponse');
const { setCacheControl } = require('../utils/cacheHeaders');
const { safeError } = require('../utils/safeLogger');

const reportController = {
    getDashboardSummary: async (req, res) => {
        try {
            const info = await Report.get_dashboard_summary({
                authAccess: req.authAccess,
                authUserUid: req.authUserUid,
            });

            setCacheControl(res, 'private', 30);
            return res.status(200).json({
                operation: 'success',
                message: 'Dashboard summary fetched successfully',
                info,
            });
        } catch (error) {
            safeError('reportController.getDashboardSummary', error);
            return sendServerError(res, error);
        }
    },

    getAttentionQueueDetail: async (req, res) => {
        try {
            const parsedLimit = parseInt(req.body.limit, 10);
            const info = await Report.get_attention_queue_detail({
                authAccess: req.authAccess,
                authUserUid: req.authUserUid,
                limit: Math.min(Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25, 50), // hard cap: max 50
            });

            setCacheControl(res, 'private', 30);
            return res.status(200).json({
                operation: 'success',
                message: 'Attention queue detail fetched successfully',
                info,
            });
        } catch (error) {
            safeError('reportController.getAttentionQueueDetail', error);
            return sendServerError(res, error);
        }
    },

    getModuleOverview: async (req, res) => {
        try {
            const info = await Report.get_module_overview({
                authAccess: req.authAccess,
                authUserUid: req.authUserUid,
            });

            setCacheControl(res, 'private', 60);
            return res.status(200).json({
                operation: 'success',
                message: 'Module overview fetched successfully',
                info,
            });
        } catch (error) {
            safeError('reportController.getModuleOverview', error);
            return sendServerError(res, error);
        }
    },
};

module.exports = reportController;