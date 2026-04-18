/**
 * Metrics Logger — Tracks timing, response sizes, and frequency for endpoint monitoring.
 * Logs metrics to Firestore metrics_logs collection to identify read-heavy hotspots.
 */

const admin = require('../firebaseAdmin');
const db = admin.firestore();

/**
 * Track endpoint metrics: timing, response doc count, actor, timestamp.
 * Logs to Firestore metrics_logs collection for later aggregation.
 */
const logMetric = async (metricData) => {
    try {
        const {
            path,           // e.g., "/get-product-list-paged"
            method,         // GET, POST, PUT
            durationMs,     // milliseconds taken
            docCount,       // number of documents returned (0 for error)
            statusCode,     // HTTP status
            actor_uid,      // user executing the request
            actor_name,     // user display name
            timestamp,      // ISO string
            querySize,      // size of response payload in bytes
            endpoint_type   // 'heavy' or 'light' classification
        } = metricData;

        // Don't await this—let it happen in background
        setImmediate(async () => {
            try {
                await db.collection('metrics_logs').add({
                    path,
                    method,
                    durationMs,
                    docCount,
                    statusCode,
                    actor_uid,
                    actor_name,
                    timestamp: new Date(timestamp).toISOString(),
                    querySize,
                    endpoint_type,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Failed to log metric:', error.message);
            }
        });
    } catch (error) {
        console.error('Metric logging error:', error.message);
    }
};

/**
 * Get aggregated hotspot metrics for the last N minutes.
 * Returns top endpoints by total duration, frequency, and avg size.
 */
const getHotspotMetrics = async (minutesBack = 60) => {
    try {
        const cutoff = new Date(Date.now() - minutesBack * 60 * 1000);
        
        const snapshot = await db.collection('metrics_logs')
            .where('created_at', '>=', cutoff)
            .orderBy('created_at', 'desc')
            .limit(5000)
            .get();

        const aggregated = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const key = `${data.method}:${data.path}`;

            if (!aggregated[key]) {
                aggregated[key] = {
                    path: data.path,
                    method: data.method,
                    endpoint_type: data.endpoint_type || 'unknown',
                    total_duration_ms: 0,
                    call_count: 0,
                    total_docs: 0,
                    total_bytes: 0,
                    error_count: 0,
                    last_called_at: null
                };
            }

            const agg = aggregated[key];
            agg.total_duration_ms += data.durationMs || 0;
            agg.call_count += 1;
            agg.total_docs += data.docCount || 0;
            agg.total_bytes += data.querySize || 0;
            if (data.statusCode >= 400) {
                agg.error_count += 1;
            }
            if (!agg.last_called_at || new Date(data.timestamp) > new Date(agg.last_called_at)) {
                agg.last_called_at = data.timestamp;
            }
        });

        // Calculate averages and sort by cost (duration * frequency)
        const hotspots = Object.values(aggregated)
            .map(agg => ({
                ...agg,
                avg_duration_ms: Math.round(agg.total_duration_ms / agg.call_count),
                avg_docs: Math.round(agg.total_docs / agg.call_count),
                avg_bytes: Math.round(agg.total_bytes / agg.call_count),
                total_cost: agg.total_duration_ms * agg.call_count // proxy for cost
            }))
            .sort((a, b) => b.total_cost - a.total_cost)
            .slice(0, 20); // Top 20 hotspots

        return {
            period_minutes: minutesBack,
            hotspots,
            total_metrics_collected: snapshot.size
        };
    } catch (error) {
        console.error('Error computing hotspot metrics:', error.message);
        return { period_minutes: minutesBack, hotspots: [], total_metrics_collected: 0, error: error.message };
    }
};

/**
 * Clear old metrics logs (older than N days) for storage cleanup.
 */
const clearOldMetrics = async (daysOld = 7) => {
    try {
        const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
        
        const snapshot = await db.collection('metrics_logs')
            .where('created_at', '<', cutoff)
            .limit(500)
            .get();

        let deletedCount = 0;
        const batch = db.batch();

        snapshot.forEach(doc => {
            batch.delete(doc.ref);
            deletedCount += 1;
        });

        if (snapshot.size > 0) {
            await batch.commit();
        }

        return { deleted_count: deletedCount };
    } catch (error) {
        console.error('Error clearing old metrics:', error.message);
        return { deleted_count: 0, error: error.message };
    }
};

module.exports = {
    logMetric,
    getHotspotMetrics,
    clearOldMetrics
};
