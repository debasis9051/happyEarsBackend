/**
 * Safe Error Logger — Logs only essential fields from error objects.
 * 
 * Prevents stack traces, file paths, and sensitive data from being logged,
 * reducing risk if server logs are exfiltrated.
 * 
 * Usage:
 *   const { safeError } = require('../utils/safeLogger');
 *   catch (error) {
 *       safeError('Operation context', error);
 *       return sendServerError(res, error);
 *   }
 */

const safeError = (context, error) => {
    try {
        const safeLog = {
            context: String(context || 'Unknown error'),
            message: String(error?.message || 'Unknown error message'),
            code: error?.code || null,
            timestamp: new Date().toISOString(),
            // Deliberately omit: error.stack, error.details, error.statusCode, etc.
        };

        console.error('[SAFE_ERROR]', JSON.stringify(safeLog));
    } catch (loggingError) {
        // If safe logging fails, fall back to minimal output
        console.error('[FALLBACK_ERROR]', String(error?.message || 'Logging failed'));
    }
};

const safeWarn = (context, message) => {
    try {
        const safeLog = {
            context: String(context || 'Unknown warning'),
            message: String(message || 'No message'),
            timestamp: new Date().toISOString(),
        };

        console.warn('[SAFE_WARN]', JSON.stringify(safeLog));
    } catch (loggingError) {
        console.warn('[FALLBACK_WARN]', String(message || 'Logging failed'));
    }
};

module.exports = {
    safeError,
    safeWarn,
};
