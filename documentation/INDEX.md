# Happy Ears Backend — Documentation Index

> **Start here.** This folder contains all developer documentation for the Happy Ears backend. Read the files in the order listed for a complete understanding of the system.

---

## Quick Reference

| I want to... | Read this |
|---|---|
| Understand the overall system | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Look up an API endpoint | [API_ENDPOINTS.md](./API_ENDPOINTS.md) |
| Understand the Firestore data model | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) |
| Deploy or run the app | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Deploy Firestore indexes | [FIRESTORE_INDEXES.md](./FIRESTORE_INDEXES.md) |
| Understand security / audit logs | [AUDIT_AND_SECURITY.md](./AUDIT_AND_SECURITY.md) |
| Understand pagination implementation | [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) |
| Review optimization history | [OPTIMIZATIONS_COMPLETED.md](./OPTIMIZATIONS_COMPLETED.md) |
| **Onboard a new user** | [USER_ONBOARDING_AND_ACCESS_GUIDE.md](./USER_ONBOARDING_AND_ACCESS_GUIDE.md) |
| **Configure environment variables** | [ENV_CONFIGURATION_GUIDE.md](./ENV_CONFIGURATION_GUIDE.md) |
| **See process flows visually** | [PROCESS_FLOW_VISUAL_GUIDE.md](./PROCESS_FLOW_VISUAL_GUIDE.md) |

---

## File Index

### Core Documentation (read these first)

| File | What It Covers |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System overview: tech stack, folder structure, request lifecycle, auth model, design decisions, rules that must not be broken |
| [API_ENDPOINTS.md](./API_ENDPOINTS.md) | Full API reference: every endpoint, required permissions, request/response format |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | All 11 Firestore collections with field-level descriptions |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | How to run locally, LAN deployment, Vercel deployment, environment variables, troubleshooting |
| [FIRESTORE_INDEXES.md](./FIRESTORE_INDEXES.md) | Required composite indexes, deployment steps, Fortinet proxy workaround |
| [AUDIT_AND_SECURITY.md](./AUDIT_AND_SECURITY.md) | Auth flow, permission system, XSS sanitization, CORS policy, rate limiting, Firestore rules |

### User & Access Management

| File | What It Covers |
|---|---|
| [USER_ONBOARDING_AND_ACCESS_GUIDE.md](./USER_ONBOARDING_AND_ACCESS_GUIDE.md) | Complete user onboarding flow, module definitions, access levels, how to grant permissions, real-world examples, troubleshooting |
| [ENV_CONFIGURATION_GUIDE.md](./ENV_CONFIGURATION_GUIDE.md) | All environment variables for backend and frontend, how to get Firebase credentials, security best practices, multi-environment setup |
| [PROCESS_FLOW_VISUAL_GUIDE.md](./PROCESS_FLOW_VISUAL_GUIDE.md) | Visual ASCII diagrams of user registration, permission grant flow, login process, double permission checks, debugging guides |

### Implementation History

| File | What It Covers |
|---|---|
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | Cursor-based pagination strategy, endpoint contracts, auth/cache behavior |
| [OPTIMIZATIONS_COMPLETED.md](./OPTIMIZATIONS_COMPLETED.md) | Phase 9 optimization: unbounded query fixes, limit caps added across models |
| [COLLECTION_OPTIMIZATION_AUDIT.md](./COLLECTION_OPTIMIZATION_AUDIT.md) | Full audit of read efficiency for all large collections (April 2026) |
| [DB_OPTIMIZATION_IMPLEMENTATION.md](./DB_OPTIMIZATION_IMPLEMENTATION.md) | Implementation details: rate limit increase, composite indexes, cache bust |
| [CACHE_RATELIMIT_ANALYSIS.md](./CACHE_RATELIMIT_ANALYSIS.md) | Analysis of the original caching/rate-limit issues and their root causes |
| [PHASE_8_METRICS_DOCUMENTATION.md](./PHASE_8_METRICS_DOCUMENTATION.md) | Phase 8: endpoint hotspot metrics system (feature was implemented then removed from UI; kept for reference) |

---

## Most Important Rules for New Developers

> These are non-negotiable. They exist because violating them has caused real production outages.

1. **No full collection reads.** All large collections (`audiometry`, `products`, `invoices`, `patients`, `service`) use cursor-based pagination only. Hard page limit: 50 documents.

2. **No caching.** `utils/cache.js` is intentionally a no-op. Do not re-enable caching without implementing SSE-based cache invalidation.

3. **No timers that trigger Firestore reads.** The app previously had a 2-minute sync loop that exhausted Firestore quota in under 1 hour. Full syncs happen only on user-initiated hard refresh.

4. **Never delete commented-out route code.** Legacy `// Legacy unbounded endpoint kept commented for reference only.` comments must stay.

5. **Exclude `_`-prefixed model methods from `wrapStaticMethods`.** They are private synchronous helpers. Wrapping them as async breaks the Promise chain.

6. **Return 401 (not 500) for auth token errors.** The `checkJwt.js` error code whitelist must be maintained.

---

## Project Info

| Item | Value |
|---|---|
| Firebase Project ID | `happy-ears-31ddb` |
| Backend Port (default) | `4001` |
| Node.js Version | `22.x` |
| Help / Support Email | `official@debasishdebnath.in` |
| Primary Admin UID | `kUVun23AGHgIcdy9KVoWUAUcBY43` |
