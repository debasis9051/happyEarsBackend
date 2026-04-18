# Cache Policy Database Integration - Real World Implementation

## ✅ Status: Complete & Verified

The cache policy is now stored in Firestore and fully integrated with both the frontend and backend systems.

---

## 📍 Database Location

**Collection:** `app_settings`  
**Document ID:** `cache_policy_v1`  
**Project:** happy-ears-31ddb

---

## 📋 Current Document Structure

```json
{
  "reference_data_ttl_seconds": 1200,
  "dashboard_reports_ttl_seconds": 300,
  "monthly_report_ttl_seconds": 600,
  "paged_records_ttl_seconds": 120,
  "notify_on_stale_data": true,
  "created_at": "2026-04-12T20:01:20.000Z",
  "updated_at": "2026-04-12T20:01:40.000Z",
  "updated_by_uid": "MAehKb0ZaFV0ehaV7MXwInPJ41J3",
  "updated_by_name": "Admin User",
  "source": "db"
}
```

### Field Descriptions:

| Field | Type | Description | Range |
|-------|------|-------------|-------|
| `reference_data_ttl_seconds` | number | TTL for static reference data (branches, doctors, etc.) | 60-3600s |
| `dashboard_reports_ttl_seconds` | number | TTL for dashboard reports and analytics | 30-900s |
| `monthly_report_ttl_seconds` | number | TTL for monthly/historical reports | 60-1800s |
| `paged_records_ttl_seconds` | number | TTL for paginated/list data | 30-600s |
| `notify_on_stale_data` | boolean | Whether to notify users when serving stale data | - |
| `created_at` | Timestamp | When the policy was first created | - |
| `updated_at` | Timestamp | Last update timestamp | - |
| `updated_by_uid` | string | Firebase UID of admin who made the change | - |
| `updated_by_name` | string | Display name of admin who made the change | - |
| `source` | string | "db" (from database) or "default" (fallback) | - |

---

## 🔄 How App Loads Cache Policy

### Frontend Flow (React):

1. **App Startup** - `index.js`
   ```javascript
   import { loadCachePolicyFromStorage, syncQueryClientWithCachePolicy } from './utils/cachePolicyManager';
   
   // Step 1: Load from localStorage (cached from Service Worker)
   loadCachePolicyFromStorage();
   
   // Step 2: Subscribe TanStack Query to policy updates
   syncQueryClientWithCachePolicy();
   
   // Step 3: Listen for Service Worker policy broadcasts
   setupPolicyUpdateListener();
   ```

2. **Loading Process:**
   - App checks localStorage for cached policy
   - If found, uses it immediately (fast startup)
   - Service Worker fetches latest from backend/Firestore
   - If newer version exists, updates all tabs via broadcast
   - TanStack Query staleTime updates automatically

3. **TanStack Query Integration:**
   ```javascript
   // queryClient.js uses dynamic staleTime from cachePolicyManager
   staleTime: DEFAULT_CACHE_POLICY.paged_records_ttl_seconds * 1000 // milliseconds
   
   // Updated when policy changes
   queryClient.setDefaultOptions({
       queries: {
           staleTime: newPolicy.paged_records_ttl_seconds * 1000
       }
   });
   ```

### Backend Flow (Node.js/Express):

1. **Getting Policy:** `controllers/cachePolicyController.js`
   ```
   GET /api/get-cache-policy-settings
   → CachePolicy.get_policy()
   → If exists in Firestore: return from DB
   → If not exists: return DEFAULT_POLICY with source: 'default'
   ```

2. **Saving Policy:** `controllers/cachePolicyController.js`
   ```
   POST /api/save-cache-policy-settings (requires auth: admin_panel)
   → Validate with sanitizePolicy()
   → Save to Firestore (app_settings/cache_policy_v1)
   → Add audit trail (updated_at, updated_by_uid, updated_by_name)
   ```

---

## 👨‍💼 Admin Changes TTL Values - Complete Flow

### Step-by-Step Synchronization:

```
1. Admin Panel [Frontend]
   ↓
2. Admin changes TTL value and clicks "Save"
   ↓
3. useCachePolicySettings mutation sends to backend
   ↓
4. Backend: saveCachePolicySettings()
   ↓
5. CachePolicy.save_policy() writes to Firestore
   ✅ Document: app_settings/cache_policy_v1 updated
   ✅ Audit fields set: updated_at, updated_by_uid, updated_by_name
   ↓
6. Backend: updateCachePolicy(data)
   ↓
7. cachePolicyManager updates in-memory policy
   ↓
8. updateServiceWorkerCachePolicy(data)
   ↓
9. Service Worker receives UPDATE_CACHE_POLICY message
   ↓
10. Service Worker broadcasts CACHE_POLICY_UPDATED to all clients
    ↓
11. All open tabs receive the broadcast
    ↓
12. Each tab:
    - Updates cachePolicyManager
    - Syncs TanStack Query staleTime
    - Invalidates old cache entries
    - Saves to localStorage
```

### Result:
- ✅ Firestore document updated immediately
- ✅ TanStack Query staleTime synced across all instances
- ✅ Service Worker cache TTL updated
- ✅ All browser tabs synchronized
- ✅ Audit trail recorded (who/when)

---

## 🧪 Testing & Verification Scripts

Three utility scripts are provided in `happyEarsBackend/`:

### 1. **verify-cache-policy.js** - View Current Settings
```bash
cd happyEarsBackend
node verify-cache-policy.js
```
Shows current cache policy from Firestore with audit information.

### 2. **create-cache-policy-db.js** - Initialize DB Document
```bash
cd happyEarsBackend
node create-cache-policy-db.js
```
Creates the initial `app_settings/cache_policy_v1` document with default values.

### 3. **test-admin-update.js** - Simulate Admin Change
```bash
cd happyEarsBackend
node test-admin-update.js
```
Simulates an admin changing TTL values and verifies they're saved to Firestore.

---

## 🔒 Security & Validation

### Admin Authorization:
- Only users with `admin_panel` role can change TTL values
- Backend: `checkJwt(['admin_panel'])` decorator required
- Audit trail records who made the change

### Input Validation:
```javascript
// sanitizePolicy() enforces ranges:
- reference_data_ttl_seconds: 60-3600 seconds
- dashboard_reports_ttl_seconds: 30-900 seconds
- monthly_report_ttl_seconds: 60-1800 seconds
- paged_records_ttl_seconds: 30-600 seconds
```

Invalid values are rejected before saving to database.

---

## 📊 Real World Data Currently in DB

**Document Last Updated:** 2026-04-12T20:01:40.000Z  
**Updated By:** Admin User (MAehKb0ZaFV0ehaV7MXwInPJ41J3)

| TTL Type | Value | Use Case |
|----------|-------|----------|
| reference_data_ttl_seconds | 1200s (20 min) | Branches, doctors, products |
| dashboard_reports_ttl_seconds | 300s (5 min) | Dashboard charts, summaries |
| monthly_report_ttl_seconds | 600s (10 min) | Historical/monthly reports |
| paged_records_ttl_seconds | 120s (2 min) | Patient lists, invoice tables |

---

## 🚀 How to Use in Production

### Initial Setup (Done Once):
1. Run `create-cache-policy-db.js` to initialize the document
2. Document is created in Firestore automatically
3. App startup will load from DB

### Admin Changes TTL:
1. Admin opens Admin Panel
2. Updates TTL values in cache policy settings
3. Clicks "Save"
4. Values are saved to Firestore automatically
5. All open tabs receive the update via Service Worker broadcast
6. Cache is invalidated across both systems

### Monitoring:
1. Check audit trail: `updated_by_uid`, `updated_by_name`, `updated_at` fields
2. View current settings: `node verify-cache-policy.js`
3. Monitor browser console for `CACHE_POLICY_UPDATED` messages

---

## 🔧 Fallback Behavior

If the Firestore document doesn't exist:

```javascript
// Backend returns DEFAULT_POLICY
{
  reference_data_ttl_seconds: 600,        // 10 minutes
  dashboard_reports_ttl_seconds: 180,     // 3 minutes
  monthly_report_ttl_seconds: 300,        // 5 minutes
  paged_records_ttl_seconds: 60,          // 1 minute
  notify_on_stale_data: true,
  source: 'default'  // Indicates using fallback
}
```

This ensures the app continues to work even if DB is unavailable.

---

## ✨ Key Features Implemented

- ✅ **Persistent Storage:** TTL values stored in Firestore
- ✅ **Dynamic TTL:** Both TanStack Query and Service Worker respect admin settings
- ✅ **Cross-Tab Sync:** Service Worker broadcasts policy changes to all open tabs
- ✅ **Audit Trail:** Records who changed TTL values and when
- ✅ **Input Validation:** Enforces min/max ranges for safety
- ✅ **Fallback System:** Uses hardcoded defaults if DB is unavailable
- ✅ **Fast Startup:** Loads from localStorage cache, then syncs from DB

---

## 📌 Quick Reference

| Action | Command |
|--------|---------|
| View current settings | `node verify-cache-policy.js` |
| Initialize DB | `node create-cache-policy-db.js` |
| Test admin update | `node test-admin-update.js` |
| Location in Firestore | `app_settings/cache_policy_v1` |
| Frontend manager | `src/utils/cachePolicyManager.js` |
| Backend controller | `controllers/cachePolicyController.js` |
| Backend model | `models/cachePolicyModel.js` |

---

**Status:** ✅ Production Ready - All systems synchronized and tested.
