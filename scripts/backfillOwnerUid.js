/*
 * Backfill utility for owner fields used by phase-2 security hardening.
 *
 * Default mode is DRY RUN (read-only):
 *   node scripts/backfillOwnerUid.js
 *
 * Apply mode (writes to Firestore):
 *   node scripts/backfillOwnerUid.js --apply --fallbackUid=<uid> --fallbackName="System"
 *
 * Notes:
 * - This script only updates docs missing `added_by_user_uid`.
 * - If no source owner can be inferred, fallback values are required in --apply mode.
 */

const dotenv = require('dotenv');
dotenv.config();

const admin = require('../firebaseAdmin');

const COLLECTIONS = ['patients', 'audiometry', 'invoices', 'service'];
const BATCH_LIMIT = 400;

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const fallbackUidArg = args.find((a) => a.startsWith('--fallbackUid='));
const fallbackNameArg = args.find((a) => a.startsWith('--fallbackName='));
const fallbackUid = fallbackUidArg ? fallbackUidArg.split('=')[1] : null;
const fallbackName = fallbackNameArg ? fallbackNameArg.split('=')[1] : 'System Backfill';

const inferOwner = (docData) => {
  if (docData.added_by_user_uid) {
    return {
      uid: docData.added_by_user_uid,
      name: docData.added_by_user_name || null,
      source: 'existing',
    };
  }

  if (docData.current_user_uid) {
    return {
      uid: docData.current_user_uid,
      name: docData.current_user_name || null,
      source: 'current_user_uid',
    };
  }

  if (docData.created_by_user_uid) {
    return {
      uid: docData.created_by_user_uid,
      name: docData.created_by_user_name || null,
      source: 'created_by_user_uid',
    };
  }

  if (fallbackUid) {
    return {
      uid: fallbackUid,
      name: fallbackName,
      source: 'fallback',
    };
  }

  return null;
};

const flushBatch = async (batch, writes) => {
  if (writes === 0) {
    return;
  }
  await batch.commit();
};

const processCollection = async (collectionName) => {
  const db = admin.firestore();
  const snapshot = await db.collection(collectionName).get();

  const stats = {
    collection: collectionName,
    total: snapshot.size,
    missingOwner: 0,
    inferable: 0,
    wouldUpdate: 0,
    updated: 0,
    unresolved: 0,
    bySource: {
      existing: 0,
      current_user_uid: 0,
      created_by_user_uid: 0,
      fallback: 0,
    },
  };

  let batch = db.batch();
  let writesInBatch = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    const hasOwner = Boolean(data.added_by_user_uid);

    if (hasOwner) {
      stats.bySource.existing += 1;
      return;
    }

    stats.missingOwner += 1;

    const inferred = inferOwner(data);
    if (!inferred) {
      stats.unresolved += 1;
      return;
    }

    stats.inferable += 1;
    stats.bySource[inferred.source] = (stats.bySource[inferred.source] || 0) + 1;

    if (!isApply) {
      stats.wouldUpdate += 1;
      return;
    }

    const updatePayload = {
      added_by_user_uid: inferred.uid,
      added_by_user_name: inferred.name || fallbackName,
    };

    batch.update(doc.ref, updatePayload);
    writesInBatch += 1;
    stats.updated += 1;

    if (writesInBatch >= BATCH_LIMIT) {
      flushBatch(batch, writesInBatch);
      batch = db.batch();
      writesInBatch = 0;
    }
  });

  if (isApply && writesInBatch > 0) {
    await flushBatch(batch, writesInBatch);
  }

  return stats;
};

(async () => {
  try {
    if (isApply && !fallbackUid) {
      console.error('In --apply mode you must provide --fallbackUid=<uid> for unresolved legacy docs.');
      process.exit(1);
    }

    const mode = isApply ? 'APPLY (WRITES)' : 'DRY RUN (READ-ONLY)';
    console.log(`\n=== Backfill Owner UID | Mode: ${mode} ===`);

    const results = [];
    for (const collectionName of COLLECTIONS) {
      // eslint-disable-next-line no-await-in-loop
      const stats = await processCollection(collectionName);
      results.push(stats);
    }

    const totals = results.reduce(
      (acc, x) => {
        acc.total += x.total;
        acc.missingOwner += x.missingOwner;
        acc.inferable += x.inferable;
        acc.unresolved += x.unresolved;
        acc.wouldUpdate += x.wouldUpdate;
        acc.updated += x.updated;
        return acc;
      },
      { total: 0, missingOwner: 0, inferable: 0, unresolved: 0, wouldUpdate: 0, updated: 0 }
    );

    console.log('\nPer-collection summary:');
    results.forEach((r) => {
      console.log(
        `- ${r.collection}: total=${r.total}, missingOwner=${r.missingOwner}, inferable=${r.inferable}, unresolved=${r.unresolved}, ${isApply ? `updated=${r.updated}` : `wouldUpdate=${r.wouldUpdate}`}`
      );
    });

    console.log('\nGlobal summary:');
    console.log(JSON.stringify({ mode, totals }, null, 2));

    if (!isApply) {
      console.log('\nNo changes were written (dry run).');
      console.log('To apply updates, run with --apply and provide --fallbackUid=<uid>.');
    }
  } catch (error) {
    console.error('Backfill script failed:', error);
    process.exit(1);
  }
})();
