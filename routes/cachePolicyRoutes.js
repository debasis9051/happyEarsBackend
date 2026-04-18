const express = require('express');
const checkJwt = require('../checkJwt');
const cachePolicyController = require('../controllers/cachePolicyController');

const cachePolicyRoutes = express.Router();

/**
 * CACHE POLICY ENDPOINTS
 * =====================
 * 
 * GET /get-cache-policy-settings
 * - PUBLIC: Get current cache policy
 * - Returns: TTL values, source (db or default)
 * 
 * POST /save-cache-policy-settings
 * - PROTECTED: Requires admin_panel claim + UID whitelist
 * - Security: JWT + UID validation (Phase 3)
 * 
 * GET /admin-uids
 * - PROTECTED: View authorized admin list
 * 
 * POST /admin-uids/add
 * - SUPER ADMIN: Add new admin UID
 * 
 * POST /admin-uids/remove
 * - SUPER ADMIN: Remove admin UID
 */

// PUBLIC: Get cache policy settings
cachePolicyRoutes.get('/get-cache-policy-settings', 
    cachePolicyController.getCachePolicySettings
);

// PROTECTED: Save cache policy settings
// Layer 1: JWT validation (requires admin_panel claim)
// Layer 2: UID validation (checks database whitelist) - in controller
cachePolicyRoutes.post('/save-cache-policy-settings',
    checkJwt(['admin_panel']),
    cachePolicyController.saveCachePolicySettings
);

// PROTECTED: Get admin UID list
cachePolicyRoutes.get('/admin-uids',
    checkJwt(['admin_panel']),
    cachePolicyController.getAdminUidList
);

// SUPER ADMIN: Add admin UID
cachePolicyRoutes.post('/admin-uids/add',
    checkJwt(['super_admin']),
    cachePolicyController.addAdminUid
);

// SUPER ADMIN: Remove admin UID
cachePolicyRoutes.post('/admin-uids/remove',
    checkJwt(['super_admin']),
    cachePolicyController.removeAdminUid
);

module.exports = cachePolicyRoutes;
