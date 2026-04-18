/**
 * userController — Handles User management operations.
 * Manages user creation, detail retrieval, user listing, and access-level updates.
 */
const User = require('../models/userModel');
const AdminUid = require('../models/adminUidModel');
const { sendServerError } = require('../utils/errorResponse');
const { setCacheControl } = require('../utils/cacheHeaders');
const { safeError } = require('../utils/safeLogger');

const ALLOWED_ACCESS_KEYS = [
    'admin_panel',
    'audiometry',
    'generate_invoice',
    'inventory',
    'sales_report',
    'patients',
    'service',
];

const userController = {
    /**
     * Creates a new user document in Firestore if they don't already exist.
     * Called on first sign-in from the frontend Firebase auth flow.
     * Body: { user_uid, user_name, user_email, user_photo }
     */
    createUser: async (req, res) => {
        try {
            const userUid = req.authUserUid;
            if (!userUid) {
                return res.status(401).json({ operation: "failed", message: "Missing authenticated user context" });
            }

            let t = await User.get(userUid)
            if(t == null){
                await User.create(userUid, req.body.user_name, req.body.user_email, req.body.user_photo)
                res.status(200).json({ operation: "success", message: "create user success" });
            }
            else{
                res.status(200).json({ operation: "success", message: "user already exists" });
            }
        } catch (error) {
            safeError('userController.createUser', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Fetches a user's details by UID.
     * Returns operation:"success" + info if found, or operation:"success" + no info if
     * the user record does not exist yet (new user, handled by frontend).
     * Body: { user_uid }
     */
    getUserDetails: async (req, res) => {
        try {
            const userUid = req.authUserUid;

            if (!userUid) {
                return res.status(400).json({ operation: "failed", message: "Missing required field: user_uid" });
            }

            let t = await User.get(userUid)
            
            if(t){
                res.status(200).json({ operation: "success", message: "get user success", info: t });
            }
            else if(t === null){
                res.status(200).json({ operation: "success", message: "no such user" });
            }
            else{
                res.status(503).json({ operation: "failed", message: 'Server is down currently, Try again Later' });
            }
        } catch (error) {
            safeError('userController.getUserDetails', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns all registered user documents, ordered by name.
     * Requires admin_panel access (enforced via checkJwt in routes).
     * Body: { current_user_uid, current_user_name }
     */
    getUserList: async (req, res) => {
        try {
            let p_data = await User.get_user_list()

            setCacheControl(res, 'private', 300);
            res.status(200).json({ operation: "success", message: "User list fetched successfully", info: p_data });
        } catch (error) {
            safeError('userController.getUserList', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Overwrites the auth_access map for a given user.
     * Validates the target user exists before updating.
     * Requires admin_panel access (enforced via checkJwt in routes).
     * Body: { current_user_uid, current_user_name, user_id, user_access }
     */
    updateUserAccess: async (req, res) => {
        try {
            const configuredPassword = (process.env.ADMIN_ROLE_UPDATE_PASSWORD || '').toString();
            const providedPassword = (req.body.admin_password || '').toString();
            const targetUserId = (req.body.user_id || '').toString().trim();
            const requestedAccess = req.body.user_access;

            if (!configuredPassword) {
                return res.status(500).json({
                    operation: "failed",
                    message: "Admin role update password is not configured on server",
                });
            }

            if (providedPassword !== configuredPassword) {
                return res.status(403).json({
                    operation: "failed",
                    message: "Invalid admin password for role update",
                });
            }

            if (!targetUserId) {
                return res.status(400).json({
                    operation: 'failed',
                    message: 'Missing required field: user_id',
                });
            }

            if (!requestedAccess || typeof requestedAccess !== 'object' || Array.isArray(requestedAccess)) {
                return res.status(400).json({
                    operation: 'failed',
                    message: 'Invalid required field: user_access',
                });
            }

            const unknownKeys = Object.keys(requestedAccess).filter((key) => !ALLOWED_ACCESS_KEYS.includes(key));
            if (unknownKeys.length > 0) {
                return res.status(400).json({
                    operation: 'failed',
                    message: `Unknown permission keys: ${unknownKeys.join(', ')}`,
                });
            }

            const sanitizedAccess = ALLOWED_ACCESS_KEYS.reduce((acc, key) => {
                acc[key] = Boolean(requestedAccess[key]);
                return acc;
            }, {});

            let t = await User.get(targetUserId)
            if (!t) {
                return res.status(404).json({ operation: "failed", message: "No such User exists" });
            }

            if (targetUserId === req.authUserUid && !sanitizedAccess.admin_panel) {
                return res.status(400).json({
                    operation: 'failed',
                    message: 'You cannot remove your own admin_panel access',
                });
            }

            const targetIsAdmin = Boolean(t.auth_access?.admin_panel);
            if (targetIsAdmin && !sanitizedAccess.admin_panel) {
                const adminCount = await User.get_admin_user_count();
                if (adminCount <= 1) {
                    return res.status(400).json({
                        operation: 'failed',
                        message: 'At least one admin_panel user is required',
                    });
                }
            }

            await User.update_user_access({
                ...req.body,
                user_id: targetUserId,
                user_access: sanitizedAccess,
            })

            return res.status(200).json({ operation: "success", message: "User access updated successfully" });

        } catch (error) {
            safeError('userController.updateUserAccess', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Unified endpoint to set admin status for a user.
     * Atomically combines both admin_panel permission update + admin UID list management.
     * 
     * Either promotes a user to admin (true), or removes admin status (false).
     * Both actions happen in a single atomic operation.
     * 
     * Request body:
     *   - user_id: string (UID of user to modify)
     *   - is_admin: boolean (true = add admin status, false = remove)
     *   - admin_password: string (password from ADMIN_ROLE_UPDATE_PASSWORD env var)
     */
    setAdminStatus: async (req, res) => {
        try {
            const configuredPassword = (process.env.ADMIN_ROLE_UPDATE_PASSWORD || '').toString();
            const providedPassword = (req.body.admin_password || '').toString();
            const targetUserId = (req.body.user_id || '').toString().trim();
            const isAdmin = req.body.is_admin;
            const incomingUserAccess = req.body.user_access || {};

            // Validate password is configured
            if (!configuredPassword) {
                return res.status(500).json({
                    operation: "failed",
                    message: "Admin role update password is not configured on server",
                });
            }

            // Validate password matches
            if (providedPassword !== configuredPassword) {
                return res.status(403).json({
                    operation: "failed",
                    message: "Invalid admin password for admin status update",
                });
            }

            // Validate required fields
            if (!targetUserId) {
                return res.status(400).json({
                    operation: 'failed',
                    message: 'Missing required field: user_id',
                });
            }

            if (typeof isAdmin !== 'boolean') {
                return res.status(400).json({
                    operation: 'failed',
                    message: 'Invalid required field: is_admin (must be boolean)',
                });
            }

            // Check if user exists
            let targetUser = await User.get(targetUserId);
            if (!targetUser) {
                return res.status(404).json({
                    operation: "failed",
                    message: "No such User exists",
                });
            }

            // Prevent removing admin status from yourself
            if (targetUserId === req.authUserUid && !isAdmin) {
                return res.status(400).json({
                    operation: 'failed',
                    message: 'You cannot remove your own admin status',
                });
            }

            // If removing admin status, check we're not removing the last admin
            const targetIsCurrentlyAdmin = Boolean(targetUser.auth_access?.admin_panel);
            if (targetIsCurrentlyAdmin && !isAdmin) {
                const adminCount = await User.get_admin_user_count();
                if (adminCount <= 1) {
                    return res.status(400).json({
                        operation: 'failed',
                        message: 'At least one admin is required. Cannot remove the last admin.',
                    });
                }
            }

            // Get current user info for audit trail
            const currentUserName = req.authUserName || 'system';

            // Update admin status atomically:
            // 1. Update user auth_access.admin_panel
            // 2. Add/remove from admin_uids_v1 list
            if (isAdmin) {
                // PROMOTE to admin
                // Step 1: Update auth_access with feature access from frontend
                const sanitizedAccess = ALLOWED_ACCESS_KEYS.reduce((acc, key) => {
                    acc[key] = key === 'admin_panel' ? true : Boolean(incomingUserAccess[key]);
                    return acc;
                }, {});

                await User.update_user_access({
                    user_id: targetUserId,
                    user_access: sanitizedAccess,
                });

                // Step 2: Add to admin UID list
                try {
                    await AdminUid.addAdminUid(targetUserId, req.authUserUid, currentUserName);
                } catch (adminUidError) {
                    // If add fails and it's because already there, that's okay
                    if (!adminUidError.message.includes('already authorized')) {
                        throw adminUidError;
                    }
                }

                return res.status(200).json({
                    operation: "success",
                    message: `User ${targetUserId} promoted to admin successfully with selected feature access`,
                    data: {
                        user_id: targetUserId,
                        is_admin: true,
                        admin_panel: true,
                        feature_access: sanitizedAccess,
                        timestamp: new Date().toISOString(),
                    },
                });
            } else {
                // DEMOTE from admin
                // Step 1: Remove from admin UID list first (this validates last admin)
                try {
                    await AdminUid.removeAdminUid(targetUserId, req.authUserUid, currentUserName);
                } catch (adminUidError) {
                    // If remove fails and it's because last admin, propagate that error
                    if (adminUidError.message.includes('At least one admin')) {
                        return res.status(400).json({
                            operation: 'failed',
                            message: adminUidError.message,
                        });
                    }
                    // If not in list, that's okay, continue to update auth_access
                    if (!adminUidError.message.includes('not currently authorized')) {
                        throw adminUidError;
                    }
                }

                // Step 2: Update auth_access - turn OFF admin_panel AND all feature access
                const sanitizedAccess = ALLOWED_ACCESS_KEYS.reduce((acc, key) => {
                    acc[key] = false;
                    return acc;
                }, {});

                await User.update_user_access({
                    user_id: targetUserId,
                    user_access: sanitizedAccess,
                });

                return res.status(200).json({
                    operation: "success",
                    message: `User ${targetUserId} demoted from admin successfully`,
                    data: {
                        user_id: targetUserId,
                        is_admin: false,
                        admin_panel: false,
                        all_access_removed: true,
                        timestamp: new Date().toISOString(),
                    },
                });
            }

        } catch (error) {
            safeError('userController.setAdminStatus', error);
            return sendServerError(res, error);
        }
    },
};

module.exports = userController;
