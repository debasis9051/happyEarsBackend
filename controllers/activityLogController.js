const ActivityLog = require('../models/activityLogModel');
const { sendServerError } = require('../utils/errorResponse');

const activityLogController = {
    getActivityLogs: async (req, res) => {
        try {
            const result = await ActivityLog.list({
                limit: req.body.limit,
                cursor: req.body.cursor,
                actor_uid: req.body.actor_uid,
                method: req.body.method,
                path_contains: req.body.path_contains,
            });

            return res.status(200).json({
                operation: 'success',
                message: 'Activity logs fetched successfully',
                info: result,
            });
        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },

    getActivityLogRetention: async (req, res) => {
        try {
            const result = await ActivityLog.getRetentionSummary({
                days: req.body.days,
            });

            return res.status(200).json({
                operation: 'success',
                message: 'Activity log retention summary fetched successfully',
                info: result,
            });
        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },

    deleteActivityLogs: async (req, res) => {
        try {
            const ids = Array.isArray(req.body.ids) ? req.body.ids : [];

            if (ids.length === 0) {
                return res.status(400).json({
                    operation: 'failed',
                    message: 'Select at least one activity log to delete',
                });
            }

            const result = await ActivityLog.deleteByIds(ids);

            return res.status(200).json({
                operation: 'success',
                message: `${result.deletedCount} activity log(s) deleted successfully`,
                info: result,
            });
        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },

    deleteOldActivityLogs: async (req, res) => {
        try {
            const result = await ActivityLog.deleteOlderThan({
                days: req.body.days,
            });

            return res.status(200).json({
                operation: 'success',
                message: `${result.deletedCount} activity log(s) older than ${result.days} days deleted successfully`,
                info: result,
            });
        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },
};

module.exports = activityLogController;
