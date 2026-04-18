# Happy Ears Backend Implementation Guide

## Scope
This document explains the backend work implemented so far for cursor-based pagination and the related read-only API paths used by the frontend.

## Primary Files
Controllers:
- `controllers/productController.js`
- `controllers/patientController.js`
- `controllers/invoiceController.js`
- `controllers/audiometryController.js`
- `controllers/serviceController.js`

Models:
- `models/productModel.js`
- `models/patientModel.js`
- `models/invoiceModel.js`
- `models/audiometryModel.js`
- `models/serviceModel.js`

Routes:
- `routes/productRoutes.js`
- `routes/patientRoutes.js`
- `routes/invoiceRoutes.js`
- `routes/audiometryRoutes.js`
- `routes/serviceRoutes.js`

## 1. Pagination Strategy
The backend uses Firestore cursor-based pagination instead of reading entire collections.

Pattern used in each paged model method:
1. Start with an ordered collection query
2. Apply `.limit(limit)`
3. If a cursor document id is provided:
   - fetch that document
   - if it exists, apply `.startAfter(cursorDoc)`
4. Execute the query
5. Map documents into plain objects with `id`
6. Return:
   - `items`
   - `nextCursor`
   - `hasMore`

This approach reduces read volume compared with full-list loading.

## 2. Endpoint Inventory

### Products
Route:
- `POST /get-product-list-paged`

Files:
- `routes/productRoutes.js`
- `controllers/productController.js`
- `models/productModel.js`

Ordering:
- `product_name` ascending

Default page size:
- 100

Controller behavior:
- parses `limit`
- clamps it to a max of 200
- passes `cursor` through as `cursorDocId`
- responds with `info: { items, nextCursor, hasMore }`

Model method:
- `Product.get_product_list_paged(limit = 100, cursorDocId = null)`

### Patients
Route:
- `POST /get-patient-list-paged`

Files:
- `routes/patientRoutes.js`
- `controllers/patientController.js`
- `models/patientModel.js`

Ordering:
- `created_at` descending

Default page size:
- 100

Model method:
- `Patient.get_patient_list_paged(limit = 100, cursorDocId = null)`

### Invoices
Route:
- `POST /get-invoice-list-paged`

Files:
- `routes/invoiceRoutes.js`
- `controllers/invoiceController.js`
- `models/invoiceModel.js`

Ordering:
- `date` descending

Default page size:
- 50

Model method:
- `Invoice.get_invoice_list_paged(limit = 50, cursorDocId = null)`

### Audiometry
Route:
- `POST /get-audiometry-list-paged`

Files:
- `routes/audiometryRoutes.js`
- `controllers/audiometryController.js`
- `models/audiometryModel.js`

Ordering:
- `date` descending

Default page size:
- 50

Model method:
- `Audiometry.get_audiometry_list_paged(limit = 50, cursorDocId = null)`

### Service
Route:
- `POST /get-service-list-paged`

Files:
- `routes/serviceRoutes.js`
- `controllers/serviceController.js`
- `models/serviceModel.js`

Ordering:
- `created_at` ascending in the current implementation

Default page size:
- 50

Model method:
- `Service.get_service_list_paged(limit = 50, cursorDocId = null)`

## 3. Request and Response Contract

### Request body
Each paged controller expects:
```json
{
  "current_user_uid": "...",
  "current_user_name": "...",
  "limit": 100,
  "cursor": null
}
```

### Response body
Successful response shape:
```json
{
  "operation": "success",
  "message": "...",
  "info": {
    "items": [],
    "nextCursor": "lastDocId-or-null",
    "hasMore": true
  }
}
```

## 4. Auth and Access Control
Each paged route is protected with `checkJwt(...)` and retains module-based permission checks.

Examples:
- products: `generate_invoice`, `inventory`
- patients: `audiometry`, `patients`
- invoices: `sales_report`
- audiometry: `audiometry`
- service: `service`

This means pagination changed how list data is fetched, not who is allowed to access it.

## 5. Cache Headers
Paged controllers set short-lived private cache headers through `setCacheControl(...)`.

Current pattern:
- full list endpoints often use a longer private cache duration
- paged list endpoints use `private, 60` seconds

Reason:
- first page is read frequently
- data should stay fresh enough for operational screens
- responses are still user-scoped/private

## 6. Read-Only Safety Notes
The paged endpoints are read-only.

What they do:
- build Firestore queries
- fetch pages from collections
- transform documents into response objects
- return pagination metadata

What they do not do:
- `.set()` documents
- `.add()` documents
- `.update()` documents
- `.delete()` documents

This is important for live-data safety. The pagination implementation does not alter stored records.

## 7. Developer Guidance

### To add pagination to another collection
Follow the same three-layer pattern:
1. Route layer
   - add a `POST /get-...-list-paged` route
   - protect it with `checkJwt(...)`
2. Controller layer
   - validate and clamp `limit`
   - accept `cursor`
   - call the model method
   - return `{ items, nextCursor, hasMore }`
3. Model layer
   - define stable ordering with `orderBy(...)`
   - apply `limit(...)`
   - resolve cursor doc and use `startAfter(...)`
   - compute `nextCursor` and `hasMore`

### Important design requirement
The ordering field used in `orderBy(...)` must stay stable and meaningful for the UI. If the ordering strategy changes, the frontend sort/search expectations may also need updates.

### Known implementation nuance
`service` pagination currently orders by `created_at` ascending. If the product expectation is “newest first”, this is a business decision to revisit explicitly rather than changing casually.

## 8. Quick Reference

Paged backend routes currently implemented:
- `/get-product-list-paged`
- `/get-patient-list-paged`
- `/get-invoice-list-paged`
- `/get-audiometry-list-paged`
- `/get-service-list-paged`

Core backend files to inspect first:
- `controllers/productController.js`
- `controllers/patientController.js`
- `controllers/invoiceController.js`
- `controllers/audiometryController.js`
- `controllers/serviceController.js`
- `models/productModel.js`
- `models/patientModel.js`
- `models/invoiceModel.js`
- `models/audiometryModel.js`
- `models/serviceModel.js`
