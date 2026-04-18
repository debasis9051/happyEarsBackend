const admin = require('../firebaseAdmin');
const wrapStaticMethods = require('../wrapStaticMethods');
const CachePolicy = require('./cachePolicyModel');

const REPORT_CACHE_TTL_SECONDS = 30;
const reportMemo = new Map();
let reportTtlMemo = { value: REPORT_CACHE_TTL_SECONDS, expiresAt: 0 };

const getConfiguredReportTtlSeconds = async () => {
    const now = Date.now();
    if (reportTtlMemo.expiresAt > now) {
        return reportTtlMemo.value;
    }

    try {
        const policy = await CachePolicy.get_policy();
        const configured = Number.parseInt(policy?.dashboard_reports_ttl_seconds, 10);
        const safe = Number.isFinite(configured) ? Math.min(900, Math.max(30, configured)) : REPORT_CACHE_TTL_SECONDS;
        reportTtlMemo = { value: safe, expiresAt: now + (60 * 1000) }; // refresh setting every 60s
        return safe;
    } catch (_) {
        reportTtlMemo = { value: REPORT_CACHE_TTL_SECONDS, expiresAt: now + (60 * 1000) };
        return REPORT_CACHE_TTL_SECONDS;
    }
};

const getMemo = (key) => {
    const entry = reportMemo.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        reportMemo.delete(key);
        return null;
    }

    return entry.value;
};

const setMemo = (key, value, ttlSeconds = REPORT_CACHE_TTL_SECONDS) => {
    reportMemo.set(key, {
        value,
        expiresAt: Date.now() + (ttlSeconds * 1000),
    });
};

const getDayRange = (baseDate = new Date()) => {
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(baseDate);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

const toIsoOrNull = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

class Report {
    static invalidate_cached_reports(prefix = '') {
        const safePrefix = typeof prefix === 'string' ? prefix : '';
        Array.from(reportMemo.keys()).forEach((key) => {
            if (!safePrefix || key.startsWith(safePrefix)) {
                reportMemo.delete(key);
            }
        });
    }

    static _ownerScopeUid(authAccess = {}, authUserUid = null) {
        if (authAccess?.admin_panel) {
            return null;
        }

        const safeUid = typeof authUserUid === 'string' ? authUserUid.trim() : '';
        if (!safeUid) {
            throw new Error('Missing authenticated user context for owner-scoped report query');
        }

        return safeUid;
    }

    static _withOwnerScope(query, ownerUid) {
        return ownerUid ? query.where('added_by_user_uid', '==', ownerUid) : query;
    }

    static async _count(query) {
        // Firestore aggregate count is preferred, but some environments/runtime
        // combinations can throw at runtime. Fallback keeps reports stable.
        if (typeof query.count === 'function') {
            try {
                const snapshot = await query.count().get();
                return snapshot.data().count || 0;
            } catch (error) {
                const message = String(error?.message || '');
                const code = error?.code;
                const canFallback =
                    code === 'invalid-argument' ||
                    code === 'failed-precondition' ||
                    message.includes('count is not a function') ||
                    message.includes('Aggregate') ||
                    message.includes('index');

                if (!canFallback) {
                    throw error;
                }
            }
        }

        const snapshot = await query.get();
        return snapshot.size || 0;
    }

    static _isMissingIndexError(error) {
        const message = String(error?.message || '');
        return error?.code === 9 || error?.code === 'failed-precondition' || /requires an index/i.test(message);
    }

    static async _countOwnerDateRange(collectionName, dateField, start, end, ownerUid) {
        const baseQuery = admin.firestore()
            .collection(collectionName)
            .where(dateField, '>=', start)
            .where(dateField, '<=', end);

        if (!ownerUid) {
            return Report._count(baseQuery);
        }

        try {
            return await Report._count(baseQuery.where('added_by_user_uid', '==', ownerUid));
        } catch (error) {
            if (!Report._isMissingIndexError(error)) {
                throw error;
            }

            const snapshot = await baseQuery.get();
            return snapshot.docs.filter((doc) => doc.data().added_by_user_uid === ownerUid).length;
        }
    }

    static async _getOwnerDateRangeItems({ collectionName, dateField, start, end, ownerUid, limit = 10, mapItem }) {
        const baseQuery = admin.firestore()
            .collection(collectionName)
            .where(dateField, '>=', start)
            .where(dateField, '<=', end)
            .orderBy(dateField, 'desc');

        if (!ownerUid) {
            const snapshot = await baseQuery.limit(limit).get();
            return snapshot.docs.map((doc) => mapItem(doc)).slice(0, limit);
        }

        try {
            const snapshot = await baseQuery.where('added_by_user_uid', '==', ownerUid).limit(limit).get();
            return snapshot.docs.map((doc) => mapItem(doc)).slice(0, limit);
        } catch (error) {
            if (!Report._isMissingIndexError(error)) {
                throw error;
            }

            const snapshot = await baseQuery.limit(limit * 5).get();
            return snapshot.docs
                .filter((doc) => doc.data().added_by_user_uid === ownerUid)
                .slice(0, limit)
                .map((doc) => mapItem(doc));
        }
    }

    static async get_dashboard_summary({ authAccess, authUserUid }) {
        const ownerUid = Report._ownerScopeUid(authAccess, authUserUid);
        const cacheKey = ownerUid ? `report-summary:${ownerUid}` : 'report-summary:admin';
        const cached = getMemo(cacheKey);
        if (cached) {
            return cached;
        }

        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);

        const todayRange = getDayRange(now);
        const yesterdayRange = getDayRange(yesterday);

        const pendingServiceQuery = Report._withOwnerScope(
            admin.firestore().collection('service').where('status', '==', 'PENDING'),
            ownerUid
        );
        const completedServiceQuery = Report._withOwnerScope(
            admin.firestore().collection('service').where('status', '==', 'COMPLETED'),
            ownerUid
        );
        const outOfStockQuery = admin.firestore().collection('products').where('instock', '==', false);
        const inStockQuery = admin.firestore().collection('products').where('instock', '==', true);
        const [
            pendingServiceRequests,
            completedServiceRequests,
            outOfStockProducts,
            inStockProducts,
            newPatientsToday,
            invoicesToday,
            invoicesYesterday,
        ] = await Promise.all([
            Report._count(pendingServiceQuery),
            Report._count(completedServiceQuery),
            Report._count(outOfStockQuery),
            Report._count(inStockQuery),
            Report._countOwnerDateRange('patients', 'created_at', todayRange.start, todayRange.end, ownerUid),
            Report._countOwnerDateRange('invoices', 'date', todayRange.start, todayRange.end, ownerUid),
            Report._countOwnerDateRange('invoices', 'date', yesterdayRange.start, yesterdayRange.end, ownerUid),
        ]);

        const result = {
            generated_at: new Date().toISOString(),
            scope: {
                is_admin: !ownerUid,
                owner_uid: ownerUid,
            },
            summary: {
                pending_service_requests: pendingServiceRequests,
                completed_service_requests: completedServiceRequests,
                out_of_stock_products: outOfStockProducts,
                in_stock_products: inStockProducts,
                invoices_today: invoicesToday,
                invoices_yesterday: invoicesYesterday,
                new_patients_today: newPatientsToday,
            },
            attention_queue: {
                pending_service_requests: {
                    count: pendingServiceRequests,
                    severity: pendingServiceRequests > 0 ? 'warning' : 'success',
                    helper: pendingServiceRequests > 0 ? 'Review service queue to avoid delays.' : 'Service queue is clear.',
                },
                out_of_stock_products: {
                    count: outOfStockProducts,
                    severity: outOfStockProducts > 0 ? 'error' : 'success',
                    helper: outOfStockProducts > 0 ? 'Restock or transfer items to prevent invoice failures.' : 'Inventory levels look healthy.',
                },
                invoice_trend: {
                    today_count: invoicesToday,
                    yesterday_count: invoicesYesterday,
                    severity: invoicesToday >= invoicesYesterday ? 'info' : 'warning',
                    helper: invoicesToday >= invoicesYesterday
                        ? 'Sales momentum is stable or improving.'
                        : 'Monitor sales pace and follow up on pending leads.',
                },
            },
        };

        const ttlSeconds = await getConfiguredReportTtlSeconds();
        setMemo(cacheKey, result, ttlSeconds);
        return result;
    }

    static async get_attention_queue_detail({ authAccess, authUserUid, limit = 25 }) {
        const ownerUid = Report._ownerScopeUid(authAccess, authUserUid);
        const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 10;
        const cacheKey = ownerUid
            ? `report-attention:${ownerUid}:${safeLimit}`
            : `report-attention:admin:${safeLimit}`;
        const cached = getMemo(cacheKey);
        if (cached) {
            return cached;
        }

        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const todayRange = getDayRange(now);
        const yesterdayRange = getDayRange(yesterday);

        const pendingServiceQuery = Report._withOwnerScope(
            admin.firestore().collection('service').where('status', '==', 'PENDING').limit(safeLimit),
            ownerUid
        );
        const outOfStockProductsQuery = admin.firestore().collection('products').where('instock', '==', false).limit(safeLimit);
        const [
            summary,
            pendingServicesSnapshot,
            outOfStockProductsSnapshot,
            todayInvoices,
        ] = await Promise.all([
            Report.get_dashboard_summary({ authAccess, authUserUid }),
            pendingServiceQuery.get(),
            outOfStockProductsQuery.get(),
            Report._getOwnerDateRangeItems({
                collectionName: 'invoices',
                dateField: 'date',
                start: todayRange.start,
                end: todayRange.end,
                ownerUid,
                limit: safeLimit,
                mapItem: (doc) => ({ id: doc.id, ...doc.data() }),
            }),
        ]);

        const pendingServices = pendingServicesSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (new Date(toIsoOrNull(b.created_at) || 0)) - (new Date(toIsoOrNull(a.created_at) || 0)))
            .slice(0, safeLimit)
            .map((item) => ({
                id: item.id,
                service_id: item.service_id || null,
                patient_id: item.patient_id || null,
                problem_description: item.problem_description || null,
                created_at: toIsoOrNull(item.created_at),
                added_by_user_name: item.added_by_user_name || null,
            }));

        const outOfStockProducts = outOfStockProductsSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (new Date(toIsoOrNull(b.created_at) || 0)) - (new Date(toIsoOrNull(a.created_at) || 0)))
            .slice(0, safeLimit)
            .map((item) => ({
                id: item.id,
                product_name: item.product_name || null,
                manufacturer_name: item.manufacturer_name || null,
                serial_number: item.serial_number || null,
                branch_id: item.branch_id || null,
                created_at: toIsoOrNull(item.created_at),
            }));

        const todayInvoiceItems = todayInvoices
            .sort((a, b) => (new Date(toIsoOrNull(b.date) || 0)) - (new Date(toIsoOrNull(a.date) || 0)))
            .slice(0, safeLimit)
            .map((item) => ({
                id: item.id,
                invoice_number: item.invoice_number || null,
                date: toIsoOrNull(item.date),
                patient_id: item.patient_id || null,
                branch_id: item.branch_id || null,
                mode_of_payment: item.mode_of_payment || null,
                added_by_user_name: item.added_by_user_name || null,
            }));

        const result = {
            generated_at: new Date().toISOString(),
            scope: {
                is_admin: !ownerUid,
                owner_uid: ownerUid,
            },
            summary: summary.summary,
            attention_queue_detail: {
                pending_services: {
                    count: summary.summary.pending_service_requests,
                    items: pendingServices,
                },
                out_of_stock_products: {
                    count: summary.summary.out_of_stock_products,
                    items: outOfStockProducts,
                },
                invoices_today: {
                    count: summary.summary.invoices_today,
                    yesterday_count: summary.summary.invoices_yesterday,
                    items: todayInvoiceItems,
                },
                generated_for_date_range: {
                    today_start: todayRange.start.toISOString(),
                    today_end: todayRange.end.toISOString(),
                    yesterday_start: yesterdayRange.start.toISOString(),
                    yesterday_end: yesterdayRange.end.toISOString(),
                },
            },
        };

        setMemo(cacheKey, result, REPORT_CACHE_TTL_SECONDS);
        return result;
    }

    static async get_module_overview({ authAccess, authUserUid }) {
        const ownerUid = Report._ownerScopeUid(authAccess, authUserUid);
        const cacheKey = ownerUid ? `report-modules:${ownerUid}` : 'report-modules:admin';
        const cached = getMemo(cacheKey);
        if (cached) {
            return cached;
        }

        const patientsQuery = Report._withOwnerScope(admin.firestore().collection('patients'), ownerUid);
        const invoicesQuery = Report._withOwnerScope(admin.firestore().collection('invoices'), ownerUid);
        const audiometryQuery = Report._withOwnerScope(admin.firestore().collection('audiometry'), ownerUid);
        const servicesQuery = Report._withOwnerScope(admin.firestore().collection('service'), ownerUid);
        const productsQuery = admin.firestore().collection('products');

        const [patients, invoices, audiometry, services, products] = await Promise.all([
            Report._count(patientsQuery),
            Report._count(invoicesQuery),
            Report._count(audiometryQuery),
            Report._count(servicesQuery),
            Report._count(productsQuery),
        ]);

        const result = {
            generated_at: new Date().toISOString(),
            scope: {
                is_admin: !ownerUid,
                owner_uid: ownerUid,
            },
            modules: {
                patients: { total: patients },
                invoices: { total: invoices },
                audiometry: { total: audiometry },
                services: { total: services },
                products: { total: products },
            },
        };

        setMemo(cacheKey, result, REPORT_CACHE_TTL_SECONDS);
        return result;
    }
}

module.exports = wrapStaticMethods(Report);