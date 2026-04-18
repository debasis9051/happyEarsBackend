/**
 * adminUidValidation.js - Middleware for Admin UID Verification
 * 
 * PHASE 3 of B+C Security Implementation
 * 
 * This middleware validates that a user's UID is in the authorized
 * admin list stored in Firestore (admin_uids_v1 document).
 * 
 * USAGE:
 *   @adminUidValidation()  // Decorator on controller methods
 *   OR manually apply in routes
 * 
 * SECURITY LAYERS:
 * 1. checkJwt() - Validates JWT token signature & expiration
 * 2. adminUidValidation() - Checks UID against database whitelist
 * 3. Business logic - Enforces additional rules
 */

const AdminUidModel = require('../models/adminUidModel');

/**
 * Middleware function to validate user UID against admin whitelist
 * 
 * Usage: 
 *   router.post('/api/endpoint', checkJwt(['admin_panel']), adminUidValidation(), controller)
 * 
 * @returns {Function} Express middleware function
 */
const adminUidValidation = () => {
    return async (req, res, next) => {
        try {
            // Get UID from JWT token (set by checkJwt middleware)
            const userUid = req.authUserUid;

            if (!userUid) {
                return res.status(401).json({
                    operation: 'error',
                    message: 'User UID not found in token',
                    error_code: 'MISSING_UID'
                });
            }

            // Check against database admin list
            const isAuthorized = await AdminUidModel.isAdminUid(userUid);

            if (!isAuthorized) {
                // Log unauthorized access attempt (for security monitoring)
                console.warn(`⚠️  Unauthorized admin access attempt: ${userUid}`);

                return res.status(403).json({
                    operation: 'error',
                    message: 'User UID not authorized for admin operations',
                    error_code: 'UNAUTHORIZED_UID',
                    details: {
                        attempted_uid: userUid,
                        authorization_check: 'FAILED',
                        resolution: 'Contact super admin to authorize this UID'
                    }
                });
            }

            // Attach admin verification info to request for logging
            req.admin = req.admin || {};
            req.admin.uid_validated = true;
            req.admin.uid = userUid;
            req.admin.validated_at = new Date().toISOString();

            // Proceed to next middleware/controller
            next();
        } catch (error) {
            console.error('Admin UID validation error:', error);

            return res.status(500).json({
                operation: 'error',
                message: 'Authorization validation failed',
                error_code: 'VALIDATION_ERROR',
                details: {
                    error: error.message
                }
            });
        }
    };
};

/**
 * Middleware factory - can be used as decorator or direct middleware
 * Returns the middleware function
 */
module.exports = adminUidValidation;
