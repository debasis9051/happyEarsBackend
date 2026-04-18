# API Endpoint Reference

> All endpoints use `POST` method. All require `Authorization: Bearer <Firebase ID Token>` header unless noted.  
> Base URL (local): `http://localhost:4001` (or configured `PORT`).

---

## Standard Response Format

**Success:**
```json
{
  "operation": "success",
  "message": "Human-readable description",
  "info": { ... }
}
```

**Failure (business logic):**
```json
{
  "operation": "failed",
  "message": "Reason for failure"
}
```

**Auth errors:** HTTP `401` (missing/invalid token, user not found) or `403` (insufficient permissions).

---

## Standard Paged Request Body

All paged list endpoints accept:
```json
{
  "current_user_uid": "auto-injected-by-middleware",
  "limit": 25,
  "cursor": null
}
```
- `limit`: Number of records per page. Capped server-side at 50.
- `cursor`: Document ID of the last record from the previous page. `null` for the first page.
- `current_user_uid`: **Injected automatically by `checkJwt` middleware** — do not send manually.

**Paged Response:**
```json
{
  "operation": "success",
  "info": {
    "items": [...],
    "nextCursor": "lastDocumentId or null",
    "hasMore": true
  }
}
```

---

## User Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /create-user` | Authenticated (no specific page) | Creates a user record in Firestore on first sign-in. Safe to call on every auth-state change. |
| `POST /get-user-details` | Authenticated (no specific page) | Returns current user record including `auth_access` permissions map. |
| `POST /get-user-list` | `admin_panel` | Returns list of all registered users with their permissions. |
| `POST /update-user-access` | `admin_panel` | Updates a user's `auth_access` map. Requires `ADMIN_ROLE_UPDATE_PASSWORD` in request body. |

---

## Patient Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /get-patient-list-paged` | `audiometry` or `patients` | Paginated patient list. Ordered by `created_at DESC`. Supports `branch_id` filter in body. |
| `POST /get-patient-number` | `patients` | Returns next patient number for new patient creation. |
| `POST /get-patient-details-by-id` | Any authenticated user | Returns full patient record for a given `patient_id`. |
| `POST /get-patient-docs-by-id` | `patients` | Returns Firebase Storage file URLs for a patient's documents. |
| `POST /get-patients-brief-by-ids` | Multi-module | Returns lightweight patient records (name, number) for an array of `patient_ids`. Used for visible-row hydration in list views. |
| `POST /search-patients-brief` | Multi-module | Server-side patient search by name or phone number. Minimum 2 characters. |
| `POST /configure-patient` | `patients` | Create or update a patient record. |

**Search body example:**
```json
{ "query": "John", "limit": 10 }
```

---

## Audiometry Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /get-audiometry-list-paged` | `audiometry` | Paginated audiometry report list. Ordered by `date DESC`. Supports optional `branch_id` filter. |
| `POST /get-audiometry-report-by-id` | `generate_invoice` | Returns a single audiometry report by ID. Used by invoice generation to pre-fill form. |
| `POST /save-audiometry-report` | `audiometry` | Creates a new audiometry report. |
| `POST /update-audiometry-report` | `audiometry` | Updates an existing audiometry report. Not all fields are editable post-creation. |

> **Legacy:** `POST /get-audiometry-list` (unbounded) is commented out in `audiometryRoutes.js`. Do not re-enable.

---

## Invoice Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /get-invoice-list-paged` | `sales_report` | Paginated invoice list. Ordered by `date DESC`. Supports optional `branch_id` filter. |
| `POST /get-invoice-number` | `generate_invoice` | Returns next invoice number for new invoice creation. |
| `POST /save-invoice` | `generate_invoice` | Creates a new invoice. Triggers product stock deduction. |
| `POST /update-invoice` | `sales_report` | Updates an existing invoice. |
| `POST /invoice/:invoice_id` | `inventory` | Deletes an invoice. |
| `POST /invoice/product/:product_id` | `inventory` | Returns the invoice associated with a product serial. |

> **Legacy:** `POST /get-invoice-list` (unbounded) is commented out. Do not re-enable.

---

## Product Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /get-product-list-paged` | `generate_invoice` or `inventory` | Paginated product list. Ordered by `product_name ASC`. Supports `branch_id` and `inStockOnly` filters. |
| `POST /search-product-brief` | `generate_invoice` or `inventory` | Server-side product search by name. |
| `POST /add-product` | `inventory` | Adds a new product (single unit). |
| `POST /update-product` | `inventory` | Updates product details. |
| `POST /import-products` | `inventory` | Bulk import via Excel file upload (`multipart/form-data`, field: `selected_file`). |
| `POST /transfer-product` | `inventory` | Transfers product to a different branch. |
| `POST /return-product` | `inventory` | Marks a product as returned. |
| `POST /get-product-log-history` | `inventory` | Returns audit log of all operations on a product. |
| `POST /products/:product_id` | `inventory` | Deletes a product. |

> **Legacy:** `POST /get-product-list` (unbounded) is commented out. Do not re-enable.

---

## Service Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /get-service-list` | `service` | Returns service list (capped at 250). Use paged version for production. |
| `POST /get-service-list-paged` | `service` | Paginated service request list. Ordered by `created_at ASC`. |
| `POST /get-patient-service-reports-by-id` | `patients` | Returns service history for a specific patient (capped at 100 records). |
| `POST /create-service-request` | `service` | Creates a new service request. |
| `POST /complete-service-request` | `service` | Marks service as complete. Accepts `multipart/form-data` with up to 3 files (field: `uploaded_files`). |
| `POST /cancel-service-request` | `service` | Marks service as cancelled. Accepts `multipart/form-data` with 1 file (field: `uploaded_file`). |

---

## Branch Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /get-branch-list` | `generate_invoice`, `inventory`, or `sales_report` | Returns all branches (capped at 100). |
| `POST /save-branch` | `admin_panel` | Creates or updates a branch record. |

---

## Doctor Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /get-doctor-list` | `audiometry` | Returns all doctors (capped at 100). |
| `POST /save-doctor` | `admin_panel` | Creates or updates a doctor record. Accepts `multipart/form-data` with signature image (field: `doctor_signature_file`). |
| `POST /get-doctor-details` | `audiometry` | Returns details for a specific doctor by ID. |

---

## Salesperson Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /get-salesperson-list` | `generate_invoice` or `sales_report` | Returns all salespersons. |
| `POST /save-salesperson` | `admin_panel` | Creates or updates a salesperson record. |

---

## Report Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /reports/sales-drill-down` | `sales_report` | Returns invoice aggregates for filtering/reporting (date range, branch, salesperson). |
| `POST /reports/attention-queue` | `service` | Returns overdue/outstanding service requests. |
| `POST /reports/daily-performance` | `admin_panel` | Returns daily transaction counts by branch. |

> Reports are **excluded from audit logging** to prevent read-noise in the activity log.

---

## Activity Log Routes (Admin)

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /get-activity-logs` | `admin_panel` | Returns paginated audit logs. Supports filters: `actor_uid`, `operation`, `date_from`, `date_to`. |
| `POST /delete-activity-logs` | `admin_panel` | Deletes logs by array of document IDs. |
| `POST /delete-old-activity-logs` | `admin_panel` | Deletes logs older than `days` (default: 30). |

---

## Push Notification Routes

| Endpoint | Permission Required | Description |
|---|---|---|
| `POST /push/subscribe-to-push` | Authenticated | Saves a browser push subscription for the current user. |
| `POST /push/unsubscribe-from-push` | Authenticated | Removes a push subscription. |

---

## SSE (Server-Sent Events)

| Endpoint | Auth | Description |
|---|---|---|
| `GET /push/sse-connect?token=<idToken>` | Token in query string (SSE cannot set headers) | Opens a persistent SSE stream. Backend sends `cache-invalidated` events when data changes. Frontend uses these events to trigger targeted re-fetches. |

---

## Rate Limiting

- **Global limit:** 500 requests per minute per IP
- **Excluded from rate limiting:** All `/get-*` and `/push/*` paths (read-only, no quota impact)
- Mutations (POST/PUT/PATCH/DELETE) consume the rate budget
