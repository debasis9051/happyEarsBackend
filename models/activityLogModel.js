const admin = require('../firebaseAdmin');

const ACTIVITY_LOG_COLLECTION = 'activity_logs';

const getActivityLogCollection = () => admin.firestore().collection(ACTIVITY_LOG_COLLECTION);

const getCutoffTimestamp = (days = 30) => {
    const safeDays = Math.max(parseInt(days, 10) || 30, 1);
    const cutoffDate = new Date(Date.now() - (safeDays * 24 * 60 * 60 * 1000));
    return admin.firestore.Timestamp.fromDate(cutoffDate);
};

class ActivityLog {
    static async add(logEntry) {
        await getActivityLogCollection().add({
            ...logEntry,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    static async list({ limit = 50, cursor = null, actor_uid = '', method = '', path_contains = '' } = {}) {
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        let q = getActivityLogCollection()
            .orderBy('created_at', 'desc')
            .limit(safeLimit);

        if (cursor) {
            const cursorDoc = await getActivityLogCollection().doc(cursor).get();
            if (cursorDoc.exists) {
                q = q.startAfter(cursorDoc);
            }
        }

        const qs = await q.get();
        let items = qs.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const normalizedActorUid = (actor_uid || '').trim();
        if (normalizedActorUid) {
            items = items.filter((entry) => (entry.actor_uid || '') === normalizedActorUid);
        }

        const normalizedMethod = (method || '').trim().toUpperCase();
        if (normalizedMethod) {
            items = items.filter((entry) => (entry.method || '').toUpperCase() === normalizedMethod);
        }

        const normalizedPathContains = (path_contains || '').trim().toLowerCase();
        if (normalizedPathContains) {
            items = items.filter((entry) => (entry.path || '').toLowerCase().includes(normalizedPathContains));
        }

        return {
            items,
            nextCursor: qs.docs.length === safeLimit ? qs.docs[qs.docs.length - 1].id : null,
            hasMore: qs.docs.length === safeLimit,
        };
    }

    static async deleteByIds(ids = []) {
        const uniqueIds = [...new Set((ids || []).filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))];

        if (uniqueIds.length === 0) {
            return { deletedCount: 0 };
        }

        let deletedCount = 0;

        for (let index = 0; index < uniqueIds.length; index += 450) {
            const chunk = uniqueIds.slice(index, index + 450);
            const batch = admin.firestore().batch();

            chunk.forEach((id) => {
                batch.delete(getActivityLogCollection().doc(id));
            });

            await batch.commit();
            deletedCount += chunk.length;
        }

        return { deletedCount };
    }

    static async getRetentionSummary({ days = 30 } = {}) {
        const cutoffTimestamp = getCutoffTimestamp(days);
        const cutoffIso = cutoffTimestamp.toDate().toISOString();

        let oldCount = 0;
        let oldestEntry = null;
        let newestEntry = null;
        let cursorDoc = null;

        while (true) {
            let query = getActivityLogCollection()
                .where('created_at', '<', cutoffTimestamp)
                .orderBy('created_at', 'asc')
                .limit(200);

            if (cursorDoc) {
                query = query.startAfter(cursorDoc);
            }

            const snapshot = await query.get();
            if (snapshot.empty) {
                break;
            }

            snapshot.docs.forEach((doc, index) => {
                const data = doc.data();
                const entry = {
                    id: doc.id,
                    ...data,
                };

                if (!oldestEntry && index === 0 && oldCount === 0) {
                    oldestEntry = entry;
                }

                newestEntry = entry;
                oldCount += 1;
            });

            cursorDoc = snapshot.docs[snapshot.docs.length - 1];

            if (snapshot.size < 200) {
                break;
            }
        }

        return {
            days: Math.max(parseInt(days, 10) || 30, 1),
            cutoffIso,
            oldCount,
            oldestEntry,
            newestEntry,
        };
    }

    static async deleteOlderThan({ days = 30 } = {}) {
        const cutoffTimestamp = getCutoffTimestamp(days);
        let deletedCount = 0;

        while (true) {
            const snapshot = await getActivityLogCollection()
                .where('created_at', '<', cutoffTimestamp)
                .orderBy('created_at', 'asc')
                .limit(200)
                .get();

            if (snapshot.empty) {
                break;
            }

            const batch = admin.firestore().batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            deletedCount += snapshot.size;

            if (snapshot.size < 200) {
                break;
            }
        }

        return {
            deletedCount,
            days: Math.max(parseInt(days, 10) || 30, 1),
        };
    }
}

module.exports = ActivityLog;
