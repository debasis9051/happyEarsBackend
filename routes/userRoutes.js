/**
 * User routes
 * POST /create-user               — Authenticated (called on first sign-in)
 * POST /get-user-details          — Authenticated (called on every auth-state change)
 * POST /get-user-list              — Requires admin_panel access
 * POST /update-user-access         — Requires admin_panel access
 * POST /set-admin-status           — Requires admin_panel access (unified admin promotion/demotion)
 */
const express = require('express');
const userController = require('../controllers/userController');
const checkJwt = require('../checkJwt');

const userRoutes = express.Router();

userRoutes.post('/create-user', checkJwt([], { allowMissingUser: true }), userController.createUser);
userRoutes.post('/get-user-details', checkJwt([], { allowMissingUser: true }), userController.getUserDetails);
userRoutes.post('/get-user-list', checkJwt(["admin_panel"]), userController.getUserList); 
userRoutes.post('/update-user-access', checkJwt(["admin_panel"]), userController.updateUserAccess);
userRoutes.post('/set-admin-status', checkJwt(["admin_panel"]), userController.setAdminStatus);

module.exports = userRoutes;