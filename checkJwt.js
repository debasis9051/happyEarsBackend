const User = require('./models/userModel');
const admin = require('./firebaseAdmin');
const { sendServerError } = require('./utils/errorResponse');

/**
 * checkJwt — Route-level authorization middleware factory.
 *
 * @param {string[]} pages  List of page/feature keys that are allowed to call this route.
 *                          The requesting user must have at least one of these keys set to
 *                          `true` in their `auth_access` Firestore record.
 *
 * Passes control to `next()` if the user has access, otherwise responds with
 * a 200 "failed" response (business-logic rejection) or 500 on unexpected errors.
 *
 * Note: An empty pages array (`checkJwt([])`) always grants access to any authenticated
 * user regardless of their specific permissions — use this only for public-but-auth-required endpoints.
 */
const extractBearerToken = (req) => {
    const authHeader = req.headers?.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }
    // EventSource cannot set custom headers, so allow short-lived token in query for SSE endpoint.
    if (typeof req.query?.token === 'string' && req.query.token.trim()) {
        return req.query.token.trim();
    }
    return null;
}

const checkJwt = (pages = [], options = {}) => {
    const { allowMissingUser = false } = options;
    return async (req, res, next) => {
        try {
            const idToken = extractBearerToken(req);
            if (!idToken) {
                return res.status(401).json({ operation: "failed", message: "Missing authorization token" });
            }

            const decoded = await admin.auth().verifyIdToken(idToken);
            const authenticatedUid = decoded.uid;
            req.authUserUid = authenticatedUid;
            req.authUserName = decoded.name || null;
            req.body = req.body || {};
            req.body.current_user_uid = authenticatedUid;
            if (!req.body.current_user_name && req.authUserName) {
                req.body.current_user_name = req.authUserName;
            }

            const claimedUid = req.body?.current_user_uid || req.body?.user_uid;
            if (claimedUid && claimedUid !== authenticatedUid) {
                return res.status(403).json({ operation: "failed", message: "Authenticated user does not match request identity" });
            }

            const userData = await User.get(authenticatedUid);

            // User doesn't exist in Firestore — deny access
            if (!userData && !allowMissingUser) {
                return res.status(401).json({ operation: "failed", message: "This User does not have authentication for this api" });
            }

            if (!userData && allowMissingUser) {
                return next();
            }

            const auth_access = userData.auth_access;
            req.authAccess = auth_access || {};

            // Allow if the user has at least one of the required page permissions, or if no pages are required
            if (pages.length === 0 || pages.find(p => auth_access?.[p] === true)) {
                next()
            }
            else {
                return res.status(403).json({ operation: "failed", message: "This User does not have authentication for this api" });
            }
        } catch (error) {
            console.error(error);

            // Firebase token verification failures should be surfaced as 401,
            // not generic 500 errors, so the client can re-authenticate.
            const firebaseAuthErrorCodes = new Set([
                'auth/argument-error',
                'auth/id-token-expired',
                'auth/id-token-revoked',
                'auth/invalid-id-token',
                'auth/project-not-found',
                'auth/tenant-id-mismatch',
                'auth/user-disabled',
            ]);

            if (firebaseAuthErrorCodes.has(error?.code)) {
                return res.status(401).json({ operation: "failed", message: "Invalid or expired authorization token" });
            }

            return sendServerError(res, error, 'Authentication Error');
        }
    }
}

module.exports = checkJwt;