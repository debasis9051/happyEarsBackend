/**
 * Centralized backend error response helper.
 *
 * Keeps controller catch blocks consistent without changing business logic.
 *
 * - Firestore quota exhaustion => 503 Service Unavailable
 * - Everything else => 500 Internal Server Error
 */
const isFirestoreQuotaExceeded = (error) => {
    const code = error?.code;
    const message = String(error?.message || '');
    const details = String(error?.details || '');

    return (
        code === 8 ||
        message.includes('RESOURCE_EXHAUSTED') ||
        details.includes('Quota exceeded')
    );
};

const sendServerError = (res, error, fallbackMessage = 'Internal Server Error') => {
    if (isFirestoreQuotaExceeded(error)) {
        return res.status(503).json({ operation: 'failed', message: 'Database quota exceeded. Please try again later.' });
    }

    return res.status(500).json({ operation: 'failed', message: fallbackMessage });
};

module.exports = {
    sendServerError,
    isFirestoreQuotaExceeded,
};
