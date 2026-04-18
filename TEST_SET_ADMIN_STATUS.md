# Testing the New `/set-admin-status` Endpoint

## Overview
This document provides step-by-step instructions to test the newly implemented unified admin status endpoint.

## Prerequisites
1. Backend server running
2. Admin user JWT token (from Firebase authentication)
3. User ID to promote/demote (from Firestore `users` collection)
4. Admin password (from `ADMIN_ROLE_UPDATE_PASSWORD` environment variable)

## Test Scenarios

### Scenario 1: Promote User to Admin

**Request:**
```bash
curl -X POST http://localhost:5000/set-admin-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{
    "user_id": "uid_to_promote",
    "is_admin": true,
    "admin_password": "your_admin_password"
  }'
```

**Expected Response (200 OK):**
```json
{
  "operation": "success",
  "message": "User uid_to_promote promoted to admin successfully",
  "data": {
    "user_id": "uid_to_promote",
    "is_admin": true,
    "admin_panel": true,
    "timestamp": "2024-12-20T10:30:00.000Z"
  }
}
```

**Verification Steps:**
1. Check Firestore `users/{uid_to_promote}/auth_access/admin_panel` = **true**
2. Check Firestore `app_settings/admin_uids_v1/authorized_admin_uids` contains **uid_to_promote**
3. Check Firestore `activity_logs` has entry showing promotion by admin user
4. Verify user can now access admin panel in frontend

---

### Scenario 2: Demote User from Admin

**Request:**
```bash
curl -X POST http://localhost:5000/set-admin-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{
    "user_id": "uid_to_demote",
    "is_admin": false,
    "admin_password": "your_admin_password"
  }'
```

**Expected Response (200 OK):**
```json
{
  "operation": "success",
  "message": "User uid_to_demote demoted from admin successfully",
  "data": {
    "user_id": "uid_to_demote",
    "is_admin": false,
    "admin_panel": false,
    "all_access_removed": true,
    "timestamp": "2024-12-20T10:30:00.000Z"
  }
}
```

**Verification Steps:**
1. Check Firestore `users/{uid_to_demote}/auth_access` all fields = **false**
2. Check Firestore `app_settings/admin_uids_v1/authorized_admin_uids` does NOT contain **uid_to_demote**
3. Check admin_uids_v1 still has other admins (not empty)
4. Check Firestore `activity_logs` has entry showing demotion

---

### Scenario 3: Error - Wrong Password

**Request:**
```bash
curl -X POST http://localhost:5000/set-admin-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{
    "user_id": "uid_to_promote",
    "is_admin": true,
    "admin_password": "wrong_password"
  }'
```

**Expected Response (403 Forbidden):**
```json
{
  "operation": "failed",
  "message": "Invalid admin password for admin status update"
}
```

---

### Scenario 4: Error - User Not Found

**Request:**
```bash
curl -X POST http://localhost:5000/set-admin-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{
    "user_id": "nonexistent_uid",
    "is_admin": true,
    "admin_password": "your_admin_password"
  }'
```

**Expected Response (404 Not Found):**
```json
{
  "operation": "failed",
  "message": "No such User exists"
}
```

---

### Scenario 5: Error - Last Admin Cannot Be Removed

**Request (try to demote the only admin):**
```bash
curl -X POST http://localhost:5000/set-admin-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{
    "user_id": "last_admin_uid",
    "is_admin": false,
    "admin_password": "your_admin_password"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "operation": "failed",
  "message": "At least one admin is required. Cannot remove the last admin."
}
```

---

### Scenario 6: Error - Cannot Remove Your Own Admin Status

**Request (current admin tries to remove their own admin status):**
```bash
curl -X POST http://localhost:5000/set-admin-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "user_id": "<YOUR_UID>",
    "is_admin": false,
    "admin_password": "your_admin_password"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "operation": "failed",
  "message": "You cannot remove your own admin status"
}
```

---

## Backward Compatibility Testing

### Test Old Endpoints Still Work

**Old endpoint - Update User Access:**
```bash
curl -X POST http://localhost:5000/update-user-access \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{
    "user_id": "uid_xyz",
    "admin_password": "your_admin_password",
    "user_access": {
      "admin_panel": false,
      "audiometry": true,
      "generate_invoice": true,
      "inventory": false,
      "sales_report": false,
      "patients": true,
      "service": false
    }
  }'
```

**Old endpoint - Add Admin UID:**
```bash
curl -X POST http://localhost:5000/admin-uids/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{
    "user_id": "uid_to_add"
  }'
```

**Expected:** Both endpoints should still work as before ✅

---

## Firestore Audit Trail Verification

After running tests, check `activity_logs` collection for entries like:

```
{
  action: "Admin change",
  timestamp: Timestamp,
  admin_uid: "uid_xyz",
  target_user_id: "uid_to_promote",
  change_type: "Promoted to admin" | "Demoted from admin",
  details: {...}
}
```

---

## Testing Checklist

- [ ] Promote user: Check both auth_access and admin_uids_v1 updated
- [ ] Demote user: Check all permissions removed and removed from admin list
- [ ] Wrong password: Gets 403 error
- [ ] User doesn't exist: Gets 404 error
- [ ] Can't remove last admin: Gets 400 error
- [ ] Can't remove own admin status: Gets 400 error
- [ ] Missing parameters: Gets 400 error
- [ ] Old endpoints still functional
- [ ] Activity logs record all changes
- [ ] Frontend admin panel reflects changes

---

## Notes

- The new endpoint is **non-breaking**: all old endpoints continue to work
- Both operations (auth_access + admin_uids) happen atomically (together or not at all)
- Demoting from admin removes ALL permissions (security best practice)
- Promoting adds admin_panel but keeps other existing permissions
