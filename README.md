# happyEarsBackend

> **New developer?** Start with [`documentation/INDEX.md`](./documentation/INDEX.md) for a full map of all docs.

## HAPPY EARS PROJECT
Frontend using React.js, Bootstrap 5
Backend using Node.js
Authentication, Database(including files) using Firebase

### database collections:
1. users - each document representing all information of one user and access authorization
2. invoices - each document representing one invoice with full information and patient id given in form
3. products - each document representing one serial with all basic product information
4. product_logs - log against per product containing current user, reason, operation [operation types: import, invoiced, transfer_add, transfer_remove, returned, add, update ]
5. branches - each document representing one branch with basic information and invoice codes
6. audiometry - each document representing one audiomtry report against a patient with patient id and remarks
7. doctor - each document representing a doctor entity with their respective details and signature file
8. patients - each document representing a patient entity with their name and location
9. salesperson - each document representing a salesperson entity with their name only
10. service - each document representing a patient service request entity with its details including uploaded file
11. activity_logs - automatic audit trail storing all user actions (create, update, delete operations)
12. cache_policies - cache configuration settings for TTL management

### environment variables
Add these values in backend environment configuration:

1. `PORT` - backend server port
2. `frontend_origin` - comma separated allowed frontend origins for CORS
3. `ADMIN_ROLE_UPDATE_PASSWORD` - required password to authorize role/permission updates from Admin Panel

Example:

`ADMIN_ROLE_UPDATE_PASSWORD=admin`

## Key Features

### Audit & Activity Logging
- **Automatic Activity Tracking**: All user actions (create, update, delete) are automatically logged to the `activity_logs` collection
- **Comprehensive Audit Trail**: Each log captures:
  - Timestamp of action
  - Actor (user UID and name)
  - HTTP method and endpoint
  - Status code and response message
  - IP address (public & local)
  - User agent (browser/device)
  - Full request payload with all changes
  - Execution time (duration in ms)
- **Admin Dashboard Access**: Admins can view, filter, and manage activity logs via the Admin Panel
- **Data Retention**: Configurable retention policy (default: 30 days)

### Cache & Performance Optimization
- **Service Worker Integration**: Workbox-based SW with Network-First strategy for APIs (4s timeout)
- **Cache Policies**: Configurable TTL for different data types (reference data, reports, invoices, etc.)
- **Real-time Cache Invalidation**: SSE-based push notifications to all connected clients on data mutations
- **Memory Cache**: Backend in-memory caching for frequently accessed data

### Sales Report Module
- **Dual-Mode Filtering**: 
  - Month-based: Select specific month for full monthly report
  - Date Range: Custom date range (Oct 1, 2025 - Jan 31, 2026)
- **Independent Branch Filters**: Records tab and Sales Report tab have separate branch selection
- **Smart Date Validation**: Auto-adjusts dates to month boundaries with user feedback

### Real-time Features
- **Push Notifications**: Automatic push notifications when data is updated
- **Cache Invalidation Broadcasting**: Real-time SSE-based cache busting for all clients
- **Data Freshness Indicators**: Client-side freshness badges (Fresh/Stale/Syncing)

### Security
- **JWT Authentication**: All endpoints protected with JWT token validation
- **Role-Based Access Control (RBAC)**: Fine-grained permissions per user (admin_panel, inventory, sales_report, etc.)
- **Rate Limiting**: API rate limiting (500 requests per minute)
- **Input Sanitization**: XSS prevention with payload sanitization
- **Activity Audit**: Complete audit trail for compliance