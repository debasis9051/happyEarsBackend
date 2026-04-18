/**
 * HappyEars Backend — Express server entry point.
 * Loads environment variables, configures CORS, registers middleware,
 * mounts all feature routes, and starts the HTTP server.
 */
const express = require('express');
const dotenv = require('dotenv');
dotenv.config()
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const checkJwt = require('./checkJwt');
const { sendServerError } = require('./utils/errorResponse');
const Report = require('./models/reportModel');
const admin = require("./firebaseAdmin")
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const pushRoutes = require("./routes/pushRoutes");
const cache = require('./utils/cache');
const { writeAuditEvent } = require('./utils/auditLogger');

const app = express();
// PORT is the standard Vercel/cloud env var; port (lowercase) is a fallback for local .env usage
const port = process.env.PORT || process.env.port || 4001;

// Allowed frontend origins are provided as a comma-separated env var (e.g. "https://app.example.com,http://localhost:3000")
const frontendOrigins = (process.env.frontend_origin || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

/**
 * Returns true when the given hostname falls within RFC-1918 private ranges.
 * Used so that local-network deployments (e.g. 192.168.x.x) are treated the
 * same as localhost for CORS purposes.
 */
const isPrivateNetworkHostname = (hostname) => {
    return (
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
};

/**
 * Returns true when the incoming request origin is a localhost/private-network
 * variant that matches one of the allowed frontend origins by protocol and port.
 * This allows both "localhost" and "127.0.0.1" to be treated as equivalent, and
 * also handles LAN/private-IP deployments.
 */
const isLocalVariantAllowed = (origin) => {
    try {
        const originUrl = new URL(origin);
        if (!['localhost', '127.0.0.1'].includes(originUrl.hostname) && !isPrivateNetworkHostname(originUrl.hostname)) {
            return false;
        }

        return frontendOrigins.some((allowedOrigin) => {
            try {
                const allowedUrl = new URL(allowedOrigin);

                // Private-network origin: match on protocol + port only (hostname can differ between devices)
                if (isPrivateNetworkHostname(originUrl.hostname) && allowedUrl.protocol === originUrl.protocol && allowedUrl.port === originUrl.port) {
                    return true;
                }

                // localhost/127.0.0.1: match on protocol + port
                return (
                    ['localhost', '127.0.0.1'].includes(allowedUrl.hostname) &&
                    allowedUrl.protocol === originUrl.protocol &&
                    allowedUrl.port === originUrl.port
                );
            } catch (err) {
                return false;
            }
        });
    } catch (err) {
        return false;
    }
};

// CORS configuration: only allow explicitly listed frontend origins (or local variants)
const corsOptions = {
    origin: (origin, callback) => {
        // Requests with no origin (e.g. same-origin, Postman, curl) are always allowed
        if (!origin) {
            return callback(null, true);
        }

        if (frontendOrigins.includes(origin) || isLocalVariantAllowed(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
};

app.use(cors(corsOptions));
// Explicitly handle pre-flight OPTIONS requests for all routes
app.options('*', cors(corsOptions));

// Security Headers Middleware — Defense-in-depth
app.use((req, res, next) => {
    // Prevent MIME-type sniffing (protects against malicious file uploads)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking attacks (protect if application is embedded in iframes)
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS protections in legacy browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy — limit referrer leakage to origins
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy for API endpoints (JSON responses only)
    // 'default-src none' means nothing is allowed by default; applications must explicitly request resources
    // 'frame-ancestors none' prevents the application from being embedded in iframes
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

    next();
});

app.use(express.json())
app.use(express.urlencoded({ extended: false }));

const hasSuspiciousPayload = (value) => {
    if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        return normalized.includes('<script') || normalized.includes('javascript:') || normalized.includes('onerror=') || normalized.includes('onload=');
    }

    if (Array.isArray(value)) {
        return value.some(hasSuspiciousPayload);
    }

    if (value && typeof value === 'object') {
        return Object.values(value).some(hasSuspiciousPayload);
    }

    return false;
};

const sanitizePayload = (value) => {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (Array.isArray(value)) {
        return value.map(sanitizePayload);
    }

    if (value && typeof value === 'object') {
        return Object.entries(value).reduce((acc, [key, entry]) => {
            acc[key] = sanitizePayload(entry);
            return acc;
        }, {});
    }

    return value;
};

app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return next();
    }

    req.body = sanitizePayload(req.body || {});

    if (hasSuspiciousPayload(req.body)) {
        return res.status(400).json({ operation: 'failed', message: 'Invalid input payload' });
    }

    return next();
});

const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 500,  // Increased from 180 to support 8-10 concurrent users with full list loads
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/get-') || req.path.startsWith('/push/'),  // Skip rate limit for read-only endpoints
    message: { operation: 'failed', message: 'Too many requests. Please try again shortly.' }
});

app.use(apiRateLimiter);

const shouldAuditRoute = (method, path) => {
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return false;
    }

    if (!path || !path.startsWith('/')) {
        return false;
    }

    if (
        path === '/' ||
        path === '/cache-invalidation-stream' ||
        path === '/get-activity-logs' ||
        path === '/get-activity-log-retention' ||
        path.startsWith('/push/')
    ) {
        return false;
    }

    return true;
};

const shouldNotifyOnRoute = (method, path) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && shouldAuditRoute(method, path);

const getMutationCachePrefixes = (path) => {
    const prefixMap = {
        '/add-product': ['product-list'],
        '/import-products': ['product-list'],
        '/update-product': ['product-list'],
        '/transfer-product': ['product-list'],
        '/return-product': ['product-list'],
        '/save-branch': ['branch-list'],
        '/save-doctor': ['doctor-list'],
        '/save-salesperson': ['salesperson-list'],
        '/save-invoice': ['invoice-list', 'product-list'],
        '/update-invoice': ['invoice-list'],
        '/save-patient': ['patient-list'],
        '/configure-patient': ['patient-list'],
        '/save-audiometry-report': ['audiometry-list'],
        '/update-audiometry-report': ['audiometry-list'],
        '/create-service-request': ['service-list'],
        '/complete-service-request': ['service-list'],
        '/cancel-service-request': ['service-list'],
        '/create-user': ['user-list'],
        '/update-user-access': ['user-list'],
    };

    if (prefixMap[path]) {
        return prefixMap[path];
    }

    if (/^\/invoice\/[^/]+$/.test(path)) {
        return ['invoice-list', 'product-list'];
    }

    if (/^\/products\/[^/]+$/.test(path)) {
        return ['product-list'];
    }

    return [];
};

const getBroadcastCacheKey = (path) => {
    const cacheKeyMap = {
        '/add-product': 'products',
        '/import-products': 'products',
        '/update-product': 'products',
        '/transfer-product': 'products',
        '/return-product': 'products',
        '/save-branch': 'branches',
        '/save-doctor': 'doctors',
        '/save-salesperson': 'salespersons',
        '/save-invoice': 'invoices',
        '/update-invoice': 'invoices',
        '/save-patient': 'patients',
        '/configure-patient': 'patients',
        '/save-audiometry-report': 'audiometry',
        '/update-audiometry-report': 'audiometry',
        '/create-service-request': 'services',
        '/complete-service-request': 'services',
        '/cancel-service-request': 'services',
    };

    if (cacheKeyMap[path]) {
        return cacheKeyMap[path];
    }

    if (/^\/invoice\/[^/]+$/.test(path)) {
        return 'invoices';
    }

    if (/^\/products\/[^/]+$/.test(path)) {
        return 'products';
    }

    return null;
};

const normalizeIp = (value) => {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const first = value.split(',')[0]?.trim();
    if (!first) {
        return null;
    }

    if (first.startsWith('::ffff:')) {
        return first.replace('::ffff:', '');
    }

    return first;
};

const getClientIpInfo = (req) => {
    const forwardedHeader = req.headers['x-forwarded-for'];
    const forwardedRaw = Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader;

    const publicIp = normalizeIp(forwardedRaw || '');
    const localIp = normalizeIp(req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '');

    return {
        ip_public: publicIp,
        ip_local: localIp,
        ip_effective: publicIp || localIp || null,
    };
};

app.use((req, res, next) => {
    if (!shouldAuditRoute(req.method, req.path) && !shouldNotifyOnRoute(req.method, req.path)) {
        return next();
    }

    const startedAt = Date.now();
    const originalJson = res.json.bind(res);

    res.json = (payload) => {
        const durationMs = Date.now() - startedAt;
        const isMutation = shouldNotifyOnRoute(req.method, req.path);
        const isSuccess = payload && payload.operation === 'success';

        if (shouldAuditRoute(req.method, req.path)) {
            const ipInfo = getClientIpInfo(req);
            writeAuditEvent({
                timestamp: new Date().toISOString(),
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                durationMs,
                operation: payload?.operation || null,
                message: payload?.message || null,
                actor_uid: req.authUserUid || req.body?.current_user_uid || null,
                actor_name: req.authUserName || req.body?.current_user_name || null,
                ip: ipInfo.ip_effective,
                ip_public: ipInfo.ip_public,
                ip_local: ipInfo.ip_local,
                user_agent: req.headers['user-agent'] || null,
                request_body: req.body || null,
            });
        }

        if (isMutation && isSuccess) {
            setImmediate(() => {
                // Keep push notifications for non-read-only successful mutations.
                pushRoutes.broadcastPushNotification('Data was updated. Open Happy Ears to sync latest changes.')
                    .catch(() => undefined);

                // Invalidate backend memory cache prefixes for affected collections.
                const prefixes = getMutationCachePrefixes(req.path);
                prefixes.forEach((prefix) => cache.invalidateMatching(prefix));

                // Invalidate memoized report summaries/details after relevant writes.
                Report.invalidate_cached_reports('report-');

                // Broadcast realtime cache invalidation to connected frontend clients.
                const cacheKey = getBroadcastCacheKey(req.path);
                if (cacheKey) {
                    cacheInvalidationBroadcaster.broadcast(cacheKey, req.method, {
                        endpoint: req.path,
                        userId: req.authUserUid || req.body?.current_user_uid,
                        timestamp: new Date().toISOString(),
                    });
                }
            });
        }

        return originalJson(payload);
    };

    next();
});

// Health-check endpoint
app.get('/', (req, res) => {
    res.send('Hello from HappyEars backend');
});

/**
 * Server-Sent Events (SSE) endpoint for real-time cache invalidation.
 * Clients connect here on page load to receive cache bust notifications.
 * When any user updates data, ALL connected clients are notified to refresh.
 * 
 * Usage (Frontend):
 *   const eventSource = new EventSource(`${backendOrigin}/cache-invalidation-stream?clientId=${userId}`)
 *   eventSource.onmessage = (event) => { const msg = JSON.parse(event.data); invalidateCaches([msg.cacheKey]); }
 */
const cacheInvalidationBroadcaster = require('./utils/cacheInvalidationBroadcaster');

app.get('/cache-invalidation-stream', checkJwt(), (req, res) => {
    const requestedClientId = typeof req.query.clientId === 'string' ? req.query.clientId.trim() : '';
    const safeClientId = requestedClientId || req.authUserUid || 'anonymous';
    const clientId = `${safeClientId}-${Date.now()}`;
    cacheInvalidationBroadcaster.subscribe(res, clientId);
});

// --- Feature routes ---
app.use(require("./routes/userRoutes"))
app.use(require("./routes/productRoutes"))
app.use(require("./routes/invoiceRoutes"))
app.use(require("./routes/branchRoutes"))
app.use(require("./routes/salespersonRoutes"))
app.use(require("./routes/doctorRoutes"))
app.use(require("./routes/audiometryRoutes"))
app.use(require("./routes/patientRoutes"))
app.use(require("./routes/serviceRoutes"))
app.use(require("./routes/reportRoutes"))
app.use(require("./routes/activityLogRoutes"))
app.use(require("./routes/cachePolicyRoutes"))
app.use(pushRoutes)

app.listen(port, () => {
    console.log("Server is running on " + port);
});

/**
 * Admin-only endpoint for running one-off database migration/backfill scripts.
 * Guarded by admin_panel access check. Scripts are written inline and toggled
 * by commenting/uncommenting the relevant block below.
 */
app.post('/custom-script', checkJwt(["admin_panel"]), async (req, res) => {
    try {
        const actorUid = req.authUserUid || req.body.current_user_uid;
        const actorName = req.authUserName || req.body.current_user_name || 'Unknown';
        const actionType = (req.body.action_type || '').toString().trim();
        const providedPassword = (req.body.action_password || '').toString();
        const dryRun = req.body.dry_run !== false;

        const writeAuditLog = (status, details = {}) => {
            try {
                const auditDir = path.join(__dirname, 'backups', 'audit');
                fs.mkdirSync(auditDir, { recursive: true });

                const now = new Date().toISOString();
                const entry = {
                    timestamp: now,
                    status,
                    action_type: actionType,
                    actor_uid: actorUid,
                    actor_name: actorName,
                    dry_run: dryRun,
                    ...details,
                };

                fs.appendFileSync(path.join(auditDir, 'backup_audit.log'), `${JSON.stringify(entry)}\n`);
            } catch (auditErr) {
                console.error('Failed to write backup audit log:', auditErr.message);
            }
        };

        if (actionType !== 'backup_database') {
            writeAuditLog('rejected', { reason: 'invalid_action_type' });
            return res.status(400).json({ operation: "failed", message: "Invalid action_type. Allowed: backup_database" });
        }

        const expectedBackupPassword = process.env.BACKUP_SCRIPT_PASSWORD || 'backup';
        if (providedPassword !== expectedBackupPassword) {
            writeAuditLog('rejected', { reason: 'invalid_password' });
            return res.status(403).json({ operation: "failed", message: "Invalid backup password" });
        }



        // Script: save product ids as an array in the invoice document seperately for easy querying later
        // const invoicesSnapshot = await admin.firestore().collection('invoices').get();
        // const batch = admin.firestore().batch();
        // invoicesSnapshot.forEach((doc) => {
        //     const invoiceData = doc.data();
        //     const productIds = invoiceData.line_items.map(item => item.product_id);
        //     const docRef = admin.firestore().collection('invoices').doc(doc.id);
        //     batch.update(docRef, { product_ids: productIds });
        // });
        // await batch.commit();
        // console.log('Script executed successfully: product_ids added to invoices');

        const backupResult = await backupAllCollections({ dryRun });
        
        // For dry-run: Return JSON response with counts
        if (dryRun) {
            writeAuditLog('success', {
                mode: 'dry-run',
                collection_count: backupResult.collectionCount,
                document_count: backupResult.documentCount,
            });

            return res.status(200).json({
                operation: "success",
                message: "Backup dry-run completed successfully",
                info: backupResult,
            });
        }

        // For apply mode: Send backup as file download
        writeAuditLog('success', {
            mode: 'apply',
            backup_file_name: backupResult.fileName,
            collection_count: backupResult.collectionCount,
            document_count: backupResult.documentCount,
            backup_timestamp: backupResult.backupTimestamp,
        });

        const fileName = backupResult.fileName;
        const backupJSON = backupResult.backupJSON;

        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', JSON.stringify(backupJSON, null, 2).length);

        // Send backup as attachment (downloads to user's browser)
        return res.send(JSON.stringify(backupJSON, null, 2));

    } catch (error) {
        console.error(error);
        try {
            const auditDir = path.join(__dirname, 'backups', 'audit');
            fs.mkdirSync(auditDir, { recursive: true });
            fs.appendFileSync(
                path.join(auditDir, 'backup_audit.log'),
                `${JSON.stringify({ timestamp: new Date().toISOString(), status: 'failed', action_type: req.body?.action_type || null, actor_uid: req.authUserUid || null, error: error.message })}\n`
            );
        } catch (auditErr) {
            console.error('Failed to write failure audit log:', auditErr.message);
        }
        return sendServerError(res, error);
    }
});

async function backupAllCollections({ dryRun = true } = {}) {
    const db = admin.firestore();
    const collections = await db.listCollections();
    const backup = {};
    let documentCount = 0;

    for (const col of collections) {
        const colName = col.id;
        console.log(`Backing up collection: ${colName}`);

        const snap = await col.get();
        documentCount += snap.size;

        if (dryRun) {
            continue;
        }

        backup[colName] = {};

        for (const doc of snap.docs) {
            backup[colName][doc.id] = doc.data();

            // Optionally fetch subcollections too
            const subcollections = await doc.ref.listCollections();
            if (subcollections.length > 0) {
                backup[colName][doc.id]._subcollections = {};

                for (const sub of subcollections) {
                    const subSnap = await sub.get();
                    backup[colName][doc.id]._subcollections[sub.id] = {};
                    for (const subDoc of subSnap.docs) {
                        backup[colName][doc.id]._subcollections[sub.id][subDoc.id] = subDoc.data();
                    }
                }
            }
        }
    }

    if (dryRun) {
        return {
            mode: 'dry-run',
            filePath: null,
            collectionCount: collections.length,
            documentCount,
        };
    }

    // For apply mode: Return backup JSON without writing to disk
    const fileName = `firestore_backup_${moment().format("YYYYMMDD_HHmmss")}.json`;
    console.log(`✅ Backup prepared → ${fileName} (downloading to admin PC)`);

    return {
        mode: 'apply',
        fileName,
        backupJSON: backup,
        backupTimestamp: new Date().toISOString(),
        collectionCount: collections.length,
        documentCount,
    };
}
