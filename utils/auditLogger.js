const fs = require('fs');
const path = require('path');
const ActivityLog = require('../models/activityLogModel');

const auditDir = path.join(__dirname, '..', 'backups', 'audit');
const auditFilePath = path.join(auditDir, 'activity_audit.log');

const redactedKeys = new Set([
    'authorization',
    'token',
    'id_token',
    'admin_password',
    'action_password',
    'password',
    'private_key',
]);

const truncate = (value, maxLength = 300) => {
    if (typeof value !== 'string') {
        return value;
    }

    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength)}...[truncated]`;
};

const sanitizeValue = (value) => {
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    if (value && typeof value === 'object') {
        return Object.entries(value).reduce((acc, [key, entry]) => {
            const normalizedKey = key.toLowerCase();
            if (redactedKeys.has(normalizedKey)) {
                acc[key] = '[redacted]';
            } else {
                acc[key] = sanitizeValue(entry);
            }

            return acc;
        }, {});
    }

    if (typeof value === 'string') {
        return truncate(value);
    }

    return value;
};

const writeAuditEvent = (event) => {
    try {
        fs.mkdirSync(auditDir, { recursive: true });
        const safeEvent = sanitizeValue(event);
        fs.appendFileSync(auditFilePath, `${JSON.stringify(safeEvent)}\n`);

        ActivityLog.add(safeEvent).catch((error) => {
            console.error('Failed to write activity audit log to Firestore:', error.message);
        });
    } catch (error) {
        console.error('Failed to write activity audit log:', error.message);
    }
};

module.exports = {
    writeAuditEvent,
};