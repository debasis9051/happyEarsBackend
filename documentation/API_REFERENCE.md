# Backend API Reference - Custom Script Endpoint

## Endpoint: POST /custom-script

**Purpose**: Execute admin-only database operations including backups, migrations, and maintenance tasks.

---

## Authentication & Authorization

### Required Headers
```javascript
{
  'Authorization': 'Bearer [JWT_TOKEN]',
  'Content-Type': 'application/json'
}
```

### JWT Requirements
- **Token Type**: Firebase JWT issued by authenticated user
- **Required Role**: `admin_panel` (verified by `checkJwt(["admin_panel"])` middleware)
- **Automatic Validation**: Middleware validates role before request reaches handler

### Password Authentication
- **Location**: Request body field `action_password`
- **Validation**: Exact string match with `process.env.BACKUP_SCRIPT_PASSWORD`
- **Requirement**: Additional layer beyond JWT role (two-factor admin security)
- **Error**: Returns `403 Forbidden` if password doesn't match

---

## Request Format

### URL
```
POST https://{backend-domain}/custom-script
```

### Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Request Body (Backup Action)

```javascript
{
  // REQUIRED: Action type (currently only supports "backup_database")
  "action_type": "backup_database",
  
  // REQUIRED: Secret password from backend .env
  "action_password": "backup",
  
  // OPTIONAL: Default true
  // true = count collections/docs without writing files (safe, fast)
  // false = create actual backup JSON file
  "dry_run": true,
  
  // OPTIONAL: User context for audit logging
  "current_user_uid": "firebase-user-uid-12345",
  "current_user_name": "Admin Full Name"
}
```

### Request Body Example

#### Dry-Run (Recommended)
```json
{
  "action_type": "backup_database",
  "action_password": "backup",
  "dry_run": true,
  "current_user_uid": "user-abc123",
  "current_user_name": "Jane Admin"
}
```

#### Full Backup (Apply)
```json
{
  "action_type": "backup_database",
  "action_password": "backup",
  "dry_run": false,
  "current_user_uid": "user-abc123",
  "current_user_name": "Jane Admin"
}
```

---

## Response Format

### Response Headers
```
Content-Type: application/json
```

### Success Response (Dry-Run)

**Status Code**: `200 OK`

```json
{
  "operation": "success",
  "message": "Backup dry-run completed successfully",
  "info": {
    "mode": "dry-run",
    "filePath": null,
    "collectionCount": 9,
    "documentCount": 1250
  }
}
```

### Success Response (Apply Backup)

**Status Code**: `200 OK`

```json
{
  "operation": "success",
  "message": "Backup completed successfully",
  "info": {
    "mode": "apply",
    "filePath": "/app/backups/firestore/firestore_backup_20260406_143022.json",
    "collectionCount": 9,
    "documentCount": 1250
  }
}
```

### Error Responses

#### Invalid Backup Password

**Status Code**: `403 Forbidden`

```json
{
  "operation": "failed",
  "message": "Invalid backup password"
}
```

**Audit Log Entry**:
```json
{
  "timestamp": "2026-04-06T14:30:22.000Z",
  "status": "rejected",
  "action_type": "backup_database",
  "actor_uid": "user-abc123",
  "actor_name": "Jane Admin",
  "dry_run": false,
  "reason": "invalid_password"
}
```

---

#### Invalid Action Type

**Status Code**: `400 Bad Request`

```json
{
  "operation": "failed",
  "message": "Invalid action_type. Allowed: backup_database"
}
```

**Audit Log Entry**:
```json
{
  "timestamp": "2026-04-06T14:30:22.000Z",
  "status": "rejected",
  "action_type": null,
  "reason": "invalid_action_type"
}
```

---

#### Missing/Invalid JWT

**Status Code**: `401 Unauthorized`

```json
{
  "error": "Unauthorized",
  "message": "JWT token missing or invalid"
}
```

*No audit log entry* (authentication failed before handler)

---

#### Missing admin_panel Role

**Status Code**: `401 Unauthorized`

```json
{
  "error": "Unauthorized",
  "message": "User does not have required 'admin_panel' role"
}
```

*No audit log entry* (authorization failed before handler)

---

#### Server Error (Firestore Unreachable)

**Status Code**: `500 Internal Server Error`

```json
{
  "error": "Error",
  "message": "Firestore database connection failed"
}
```

**Audit Log Entry**:
```json
{
  "timestamp": "2026-04-06T14:30:22.000Z",
  "status": "failed",
  "action_type": "backup_database",
  "actor_uid": "user-abc123",
  "error": "Firestore database connection failed"
}
```

---

#### Server Error (Insufficient Disk Space)

**Status Code**: `500 Internal Server Error`

```json
{
  "error": "Error",
  "message": "ENOSPC: no space left on device"
}
```

---

## Complete Code Flow

### 1. Middleware Chain
```javascript
app.post('/custom-script', 
  checkJwt(["admin_panel"]),  // ← Verify JWT + admin_panel role
  async (req, res) => {        // ← Handler
```

### 2. Request Validation
```javascript
const actionType = (req.body.action_type || '').toString().trim();
const providedPassword = (req.body.action_password || '').toString();
const dryRun = req.body.dry_run !== false;  // Default true

// Check action type
if (actionType !== 'backup_database') {
  writeAuditLog('rejected', { reason: 'invalid_action_type' });
  return res.status(400).json({ 
    operation: "failed", 
    message: "Invalid action_type. Allowed: backup_database" 
  });
}

// Check password
const expectedBackupPassword = process.env.BACKUP_SCRIPT_PASSWORD || 'backup';
if (providedPassword !== expectedBackupPassword) {
  writeAuditLog('rejected', { reason: 'invalid_password' });
  return res.status(403).json({ 
    operation: "failed", 
    message: "Invalid backup password" 
  });
}
```

### 3. Backup Execution
```javascript
const backupResult = await backupAllCollections({ dryRun });
writeAuditLog('success', {
  backup_file: backupResult.filePath,
  collection_count: backupResult.collectionCount,
  document_count: backupResult.documentCount,
});
```

### 4. Response
```javascript
return res.status(200).json({
  operation: "success",
  message: dryRun 
    ? "Backup dry-run completed successfully"
    : "Backup completed successfully",
  info: backupResult,
});
```

---

## Backup Algorithm Details

### Function: `backupAllCollections({ dryRun })`

#### Parameters
```javascript
{
  dryRun: boolean  // true = count only, false = write files
}
```

#### Return Value
```javascript
{
  mode: 'dry-run' | 'apply',
  filePath: string | null,
  collectionCount: number,
  documentCount: number
}
```

#### Process

**Phase 1: Initialize**
```javascript
const db = admin.firestore();
const collections = await db.listCollections();
const backup = {};
let documentCount = 0;
```

**Phase 2: Iterate Collections**
```javascript
for (const col of collections) {
  const colName = col.id;  // e.g., "patients", "products"
  console.log(`Backing up collection: ${colName}`);
  
  const snap = await col.get();  // Get ALL documents in collection
  documentCount += snap.size;
  
  if (dryRun) continue;  // If dry-run, skip to next collection
  
  backup[colName] = {};  // Init collection in backup object
```

**Phase 3: Document Processing (if Apply Mode)**
```javascript
  for (const doc of snap.docs) {
    backup[colName][doc.id] = doc.data();  // Store document data
    
    // Handle subcollections
    const subcollections = await doc.ref.listCollections();
    if (subcollections.length > 0) {
      backup[colName][doc.id]._subcollections = {};
      
      for (const sub of subcollections) {
        const subSnap = await sub.get();
        backup[colName][doc.id]._subcollections[sub.id] = {};
        
        for (const subDoc of subSnap.docs) {
          backup[colName][doc.id]._subcollections[sub.id][subDoc.id] = 
            subDoc.data();
        }
      }
    }
  }
}
```

**Phase 4: Return on Dry-Run**
```javascript
if (dryRun) {
  return {
    mode: 'dry-run',
    filePath: null,
    collectionCount: collections.length,
    documentCount,
  };
}
```

**Phase 5: Write to Disk (if Apply Mode)**
```javascript
const backupDir = path.join(__dirname, 'backups', 'firestore');
fs.mkdirSync(backupDir, { recursive: true });

const fileName = `firestore_backup_${moment().format("YYYYMMDD_HHmmss")}.json`;
const filePath = path.join(backupDir, fileName);

fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
console.log(`✅ Backup complete → ${filePath}`);

return {
  mode: 'apply',
  filePath,
  collectionCount: collections.length,
  documentCount,
};
```

---

## Audit Logging

### Audit Log Location
```
happyEarsBackend/backups/audit/backup_audit.log
```

### Log Format
Line-delimited JSON (one entry per line)

### Success Entry
```json
{"timestamp":"2026-04-06T14:30:22.000Z","status":"success","action_type":"backup_database","actor_uid":"user-abc123","actor_name":"Jane Admin","dry_run":false,"backup_file":"backups/firestore/firestore_backup_20260406_143022.json","collection_count":9,"document_count":1250}
```

### Rejection Entry
```json
{"timestamp":"2026-04-06T14:30:22.000Z","status":"rejected","action_type":"backup_database","actor_uid":"user-abc123","actor_name":"Jane Admin","dry_run":false,"reason":"invalid_password"}
```

### Failure Entry
```json
{"timestamp":"2026-04-06T14:30:22.000Z","status":"failed","action_type":"backup_database","actor_uid":"user-abc123","error":"ENOSPC: no space left on device"}
```

---

## Environment Variables

### Required
```env
# Database backup password (set in .env, NEVER commit actual value)
BACKUP_SCRIPT_PASSWORD=your-secure-backup-password
```

### Used from Firebase Admin Setup
```env
FIREBASE_ADMIN_SDK_KEY=...  # Already configured in firebaseAdmin.js
```

---

## Performance Considerations

### Dry-Run Speed
- Small databases: < 100ms
- Medium databases (10,000 docs): 1-5s
- Large databases (100,000+ docs): 10-30s

### Full Backup Size Estimation
- Typical doc size: 1-5 KB
- JSON overhead: ~20-30%
- Example: 1,250 docs × 2 KB × 1.25 = ~3.1 MB backup file

### Factors Affecting Backup Time
1. **Number of collections** (read metadata)
2. **Number of documents** (read each document)
3. **Document sizes** (larger data = more transfer time)
4. **Subcollection depth** (recursive reads)
5. **Network latency** (if using Firestore emulator, local)
6. **Disk I/O** (write speed when creating backup file)

### Optimization Tips
```javascript
// Current approach: Read all data into memory
// For large databases, consider:
// 1. Streaming writes to disk
// 2. Incremental backups (only new/modified docs)
// 3. Compression (gzip the JSON)
// 4. Scheduled backups at off-peak hours
```

---

## Error Recovery

### If Backup File IS Created But Response Fails
```
✅ Backup file exists at: backups/firestore/firestore_backup_*.json
❌ Frontend gets error response

Recovery: Check file system, retry dry-run to verify database state
```

### If Backup File Is NOT Created
```
❌ Backup file missing: backups/firestore/ is empty
❌ Frontend gets error response

Causes:
- Insufficient disk space (ENOSPC)
- Permission denied on backups/ directory
- Firestore connection timeout
- Memory exhausted

Recovery: Check server logs, increase disk space, retry
```

### If Audit Log Fails
```
✅ Backup succeeds and file is created
⚠️ Audit log write fails silently (logged to console)

Recovery: Check console logs, manually verify backup file exists
```

---

## Security Best Practices

### 1. Password Management
```javascript
✅ CORRECT:
- Store in .env file
- Load via process.env.BACKUP_SCRIPT_PASSWORD
- Validate exact string match
- Never log the actual password

❌ INCORRECT:
- Hardcode password in source code
- Log password in error messages
- Send password in response
- Store in database
```

### 2. Role-Based Access
```javascript
✅ CORRECT:
- JWT verifies admin_panel role
- Middleware blocks non-admin requests
- Audit logs record actor UID/name

❌ INCORRECT:
- Allow backup without admin role
- Skip JWT validation
- Don't log who performed backup
```

### 3. File Permissions
```bash
✅ CORRECT:
# Backup directory accessible only by service account
chmod 700 backups/
chmod 600 backups/firestore/backup_*.json
chmod 600 backups/audit/backup_audit.log

❌ INCORRECT:
# World-readable backups (contains all database data!)
chmod 777 backups/
```

---

## Examples

### cURL Example: Dry-Run Backup
```bash
curl -X POST https://api.happyears.local/custom-script \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{
    "action_type": "backup_database",
    "action_password": "backup",
    "dry_run": true,
    "current_user_uid": "user123",
    "current_user_name": "Admin"
  }'
```

### JavaScript/Axios Example: Full Backup
```javascript
import axios from 'axios';

const data = {
  action_type: "backup_database",
  action_password: backupPassword,
  dry_run: false,
  current_user_uid: currentUser.uid,
  current_user_name: currentUser.displayName
};

try {
  const response = await axios.post(
    `${backendOrigin}/custom-script`, 
    data,
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  console.log('Backup successful:', response.data.info);
  console.log('File:', response.data.info.filePath);
  console.log('Documents:', response.data.info.documentCount);
  
} catch (error) {
  console.error('Backup failed:', error.response?.data?.message);
}
```

### PowerShell Example: Dry-Run Check
```powershell
$token = "eyJhbGciOi..."
$body = @{
    action_type = "backup_database"
    action_password = "backup"
    dry_run = $true
    current_user_uid = "user123"
    current_user_name = "Admin"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "https://api.happyears.local/custom-script" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $body `
  -ContentType "application/json"

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## Related Documentation

- [Database Backup User Guide](./DATABASE_BACKUP.md)
- [Admin Panel UI Reference](../frontend/documentation/ADMIN_BACKUP_UI.md)
- [Security & Authentication](./SECURITY.md)
- [Audit Logging System](./AUDIT_AND_SECURITY.md)
