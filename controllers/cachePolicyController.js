const CachePolicy = require('../models/cachePolicyModel');
const AdminUidModel = require('../models/adminUidModel');
const { sendServerError } = require('../utils/errorResponse');
const { setCacheControl } = require('../utils/cacheHeaders');
const adminUidValidation = require('../middleware/adminUidValidation');

const cachePolicyController = {
    /**
     * GET /api/get-cache-policy-settings
     * PUBLIC endpoint - no authentication required
     * Returns current cache policy settings
     */
    getCachePolicySettings: async (req, res) => {
        try {
            const info = await CachePolicy.get_policy();
            setCacheControl(res, 'private', 60);
            return res.status(200).json({
                operation: 'success',
                message: 'Cache policy settings fetched successfully',
                info,
            });
        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },

    /**
     * POST /api/save-cache-policy-settings
     * PROTECTED endpoint - requires admin authentication + UID validation
     * 
     * SECURITY LAYERS:
     * 1. JWT validation (checkJwt middleware applied in routes)
     * 2. UID whitelist check (adminUidValidation middleware - Phase 3)
     * 3. Input validation (sanitizePolicy in CachePolicy model)
     * 4. Audit trail (updated_by_uid, updated_by_name, updated_at)
     */
    saveCachePolicySettings: [
        // Layer 2: Admin UID validation (checks database whitelist)
        adminUidValidation(),
        // Layer 3: Business logic
        async (req, res) => {
            try {
                const userUid = req.user.uid;
                const userName = req.user.name || 'Unknown User';
                
                // Validate input exists
                if (!req.body || typeof req.body !== 'object') {
                    return res.status(400).json({
                        operation: 'error',
                        message: 'Invalid policy data'
                    });
                }

                // Save to Firestore with audit trail
                const info = await CachePolicy.save_policy(
                    req.body,
                    userUid,
                    userName
                );

                // Log successful change (AUDIT TRAIL)
                console.log(`✅ ADMIN UPDATE: Cache policy changed by ${userName} (${userUid})`, {
                    timestamp: new Date().toISOString(),
                    policy_changes: req.body
                });

                setCacheControl(res, 'no-store', 0);
                return res.status(200).json({
                    operation: 'success',
                    message: 'Cache policy settings saved successfully',
                    info,
                });
            } catch (error) {
                // Log error attempts
                console.error(`❌ Error saving cache policy for ${req.user?.uid}:`, error);
                return sendServerError(res, error);
            }
        }
    ],

    /**
     * GET /api/admin-uids
     * PROTECTED endpoint - view current admin UID list
     * Requires admin authentication + UID validation
     */
    getAdminUidList: [
        adminUidValidation(),
        async (req, res) => {
            try {
                const adminList = await AdminUidModel.getAdminUidList();
                const history = await AdminUidModel.getAuditHistory();

                return res.status(200).json({
                    operation: 'success',
                    admin_uids: adminList.uids,
                    total_admins: adminList.total_admins,
                    source: adminList.source,
                    audit_trail: history
                });
            } catch (error) {
                console.error('Error getting admin UID list:', error);
                return sendServerError(res, error);
            }
        }
    ],

    /**
     * POST /api/admin-uids/add
     * PROTECTED endpoint - add new admin (Super Admin only)
     * Requires super_admin JWT claim + UID validation
     */
    addAdminUid: [
        adminUidValidation(),
        async (req, res) => {
            try {
                const { uid_to_add } = req.body;
                const currentUserUid = req.user.uid;
                const currentUserName = req.user.name || 'Unknown User';

                if (!uid_to_add || typeof uid_to_add !== 'string') {
                    return res.status(400).json({
                        operation: 'error',
                        message: 'uid_to_add is required and must be a string'
                    });
                }

                const updatedList = await AdminUidModel.addAdminUid(
                    uid_to_add,
                    currentUserUid,
                    currentUserName
                );

                // AUDIT LOG
                console.log(`✅ ADMIN ADDED: ${uid_to_add} by ${currentUserName} (${currentUserUid})`, {
                    timestamp: new Date().toISOString()
                });

                return res.status(200).json({
                    operation: 'success',
                    message: `Added ${uid_to_add} to admin list`,
                    updated_admin_uids: updatedList,
                    total_admins: updatedList.length
                });
            } catch (error) {
                console.error('Error adding admin UID:', error);
                return res.status(400).json({
                    operation: 'error',
                    message: error.message
                });
            }
        }
    ],

    /**
     * POST /api/admin-uids/remove
     * PROTECTED endpoint - remove admin (Super Admin only)
     * Requires super_admin JWT claim + UID validation
     */
    removeAdminUid: [
        adminUidValidation(),
        async (req, res) => {
            try {
                const { uid_to_remove } = req.body;
                const currentUserUid = req.user.uid;
                const currentUserName = req.user.name || 'Unknown User';

                if (!uid_to_remove || typeof uid_to_remove !== 'string') {
                    return res.status(400).json({
                        operation: 'error',
                        message: 'uid_to_remove is required and must be a string'
                    });
                }

                const updatedList = await AdminUidModel.removeAdminUid(
                    uid_to_remove,
                    currentUserUid,
                    currentUserName
                );

                // AUDIT LOG
                console.log(`⚠️  ADMIN REMOVED: ${uid_to_remove} by ${currentUserName} (${currentUserUid})`, {
                    timestamp: new Date().toISOString()
                });

                return res.status(200).json({
                    operation: 'success',
                    message: `Removed ${uid_to_remove} from admin list`,
                    updated_admin_uids: updatedList,
                    total_admins: updatedList.length
                });
            } catch (error) {
                console.error('Error removing admin UID:', error);
                return res.status(400).json({
                    operation: 'error',
                    message: error.message
                });
            }
        }
    ]
};

module.exports = cachePolicyController;
