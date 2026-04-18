# Firestore Index Deployment Guide

> **Required reading before deploying index changes.** This project has a known network proxy issue that affects Firebase CLI deployments.

---

## Why Composite Indexes Are Required

Firestore requires a composite index for any query that:
- Filters on more than one field, OR
- Filters on one field and orders by a different field

Without the index, the query fails at runtime with:
```
FAILED_PRECONDITION: The query requires an index.
```

---

## Current Active Indexes

All indexes are defined in `happyEarsBackend/firestore.indexes.json`.

| # | Collection | Index Fields | Purpose |
|---|---|---|---|
| 1 | `audiometry` | `branch_id ASC`, `date DESC` | Branch-filtered audiometry list sorted by date |
| 2 | `audiometry` | `added_by_user_uid ASC`, `branch_id ASC`, `date DESC` | Owner-scoped branch audiometry list |
| 3 | `products` | `branch_id ASC`, `product_name ASC` | Paginated product list filtered by branch |
| 4 | `products` | `branch_id ASC`, `instock ASC`, `product_name ASC` | In-stock products filtered by branch |
| 5 | `products` | `instock ASC`, `product_name ASC` | All in-stock products globally |
| 6 | `invoices` | `branch_id ASC`, `date DESC` | Branch-filtered invoice list sorted by date |
| 7 | `invoices` | `date DESC` | Global invoice list sorted by date |

---

## How to Deploy Indexes

### Prerequisites
```powershell
# Firebase CLI must be installed and authenticated
npm install -g firebase-tools
firebase login
```

### Known Network Issue (Fortinet Proxy)

> **Critical:** On this network, `firebaserules.googleapis.com` is blocked by the Fortinet proxy firewall. Deploying Firestore **rules** at the same time as indexes will fail.

**Workaround — always do this before any `firebase deploy`:**

**Step 1:** Open `happyEarsBackend/firebase.json`

**Before deployment** — temporarily remove the `rules` entry:
```json
{
  "firestore": {
    "indexes": "./firestore.indexes.json"
  }
}
```

**Step 2:** Deploy indexes only:
```powershell
cd happyEarsBackend
firebase deploy --only firestore:indexes --project happy-ears-31ddb
```

**Step 3:** After successful deployment, restore `firebase.json`:
```json
{
  "firestore": {
    "indexes": "./firestore.indexes.json",
    "rules": "firestore.rules"
  }
}
```

### Deployment Output
A successful deployment looks like:
```
✔  firestore: deployed indexes in firestore.indexes.json
```

---

## Adding a New Index

**Step 1:** Identify the query that needs an index. You'll see this error in the backend logs:
```
Error: 9 FAILED_PRECONDITION: The query requires an index.
```
Firestore usually provides a link to create the index automatically. However, it will be added to the Firebase Console only, not to `firestore.indexes.json`.

**Step 2:** Add the index definition to `firestore.indexes.json`:
```json
{
  "collectionGroup": "your_collection",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "field_one", "order": "ASCENDING" },
    { "fieldPath": "field_two", "order": "DESCENDING" }
  ]
}
```

**Step 3:** Deploy following the steps above.

**Step 4:** While the index is being built (can take several minutes), the backend has try/catch fallbacks in the affected model methods. The fallback drops the ordering requirement to let the query succeed without the index. Once the index is active, the full ordered query resumes automatically.

---

## Fallback Behavior During Index Building

The following model methods have try/catch fallbacks:
- `audiometryModel.js → get_audiometry_list_paged()`
- `productModel.js → get_product_list_paged()`

If the primary query fails with `FAILED_PRECONDITION`, the model retries without the branch filter compound — returning unfiltered results. This is intentional and prevents crashes during index build time.

---

## Firebase Project Details

- **Project ID:** `happy-ears-31ddb`
- **Region:** default (nam5 / us-central)
- **Firebase CLI project alias:** Set in `.firebaserc` at the `happyEarsBackend/` root
