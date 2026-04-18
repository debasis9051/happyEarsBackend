const admin = require('../firebaseAdmin');
const wrapStaticMethods = require('../wrapStaticMethods');

const COLLECTION = 'app_settings';
const DOC_ID = 'cache_policy_v1';

const DEFAULT_POLICY = {
    reference_data_ttl_seconds: 600,
    dashboard_reports_ttl_seconds: 180,
    monthly_report_ttl_seconds: 300,
    paged_records_ttl_seconds: 60,
    notify_on_stale_data: true,
};

const INVALIDATION_KEYS = {
    invoices: [
        'invoices',
        'invoices:monthly',
        'dashboard:summary',
        'dashboard:attention',
    ],
    products: [
        'products',
        'inventory:list',
        'dashboard:summary',
        'dashboard:attention',
    ],
    services: [
        'services',
        'dashboard:summary',
        'dashboard:attention',
    ],
    patients: ['patients'],
    reference_data: ['branches', 'doctors', 'salespersons', 'users'],
};

const toIntInRange = (value, fallback, min, max) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const sanitizePolicy = (incoming = {}) => {
    return {
        reference_data_ttl_seconds: toIntInRange(incoming.reference_data_ttl_seconds, DEFAULT_POLICY.reference_data_ttl_seconds, 60, 3600),
        dashboard_reports_ttl_seconds: toIntInRange(incoming.dashboard_reports_ttl_seconds, DEFAULT_POLICY.dashboard_reports_ttl_seconds, 30, 900),
        monthly_report_ttl_seconds: toIntInRange(incoming.monthly_report_ttl_seconds, DEFAULT_POLICY.monthly_report_ttl_seconds, 60, 1800),
        paged_records_ttl_seconds: toIntInRange(incoming.paged_records_ttl_seconds, DEFAULT_POLICY.paged_records_ttl_seconds, 30, 600),
        notify_on_stale_data: typeof incoming.notify_on_stale_data === 'boolean' ? incoming.notify_on_stale_data : DEFAULT_POLICY.notify_on_stale_data,
    };
};

class CachePolicy {
    static defaultPolicy() {
        return { ...DEFAULT_POLICY };
    }

    static invalidationKeys() {
        return JSON.parse(JSON.stringify(INVALIDATION_KEYS));
    }

    static async get_policy() {
        const docRef = admin.firestore().collection(COLLECTION).doc(DOC_ID);
        const snap = await docRef.get();
        if (!snap.exists) {
            return {
                ...DEFAULT_POLICY,
                invalidation_keys: CachePolicy.invalidationKeys(),
                source: 'default',
                updated_at: null,
                updated_by_uid: null,
                updated_by_name: null,
            };
        }

        const data = snap.data() || {};
        return {
            ...sanitizePolicy(data),
            invalidation_keys: CachePolicy.invalidationKeys(),
            source: 'db',
            updated_at: data.updated_at || null,
            updated_by_uid: data.updated_by_uid || null,
            updated_by_name: data.updated_by_name || null,
        };
    }

    static async save_policy(payload, actorUid, actorName) {
        const policy = sanitizePolicy(payload);
        const docRef = admin.firestore().collection(COLLECTION).doc(DOC_ID);

        await docRef.set({
            ...policy,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by_uid: actorUid || null,
            updated_by_name: actorName || null,
        }, { merge: true });

        return {
            ...policy,
            invalidation_keys: CachePolicy.invalidationKeys(),
            source: 'db',
            updated_at: new Date().toISOString(),
            updated_by_uid: actorUid || null,
            updated_by_name: actorName || null,
        };
    }
}

module.exports = wrapStaticMethods(CachePolicy);
