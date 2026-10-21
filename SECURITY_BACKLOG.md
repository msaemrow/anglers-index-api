# Public exposure security backlog

Source review and initial fixes: October 20, 2026. This is a work tracker, not a certification that the app is ready for public deployment. Network/proxy settings and deployed secrets have not been verified.

## Critical fixes completed

- [x] Require authentication on every tackle box endpoint.
- [x] Reject attempts to read or change another user's tackle box, including requests from admins. Use the authenticated user's ID in database operations; retain the existing user_id request contract for frontend compatibility.
- [x] Require authentication and admin permission on DELETE /lures/delete/:lureId, matching the shared lure catalog's existing edit policy.
- [x] Add route-level regression coverage for missing/invalid tokens, deleted users, cross-user access, ordinary-user deletion attempts, and permitted operations.

## High priority: complete before public exposure

- [x] Protect catch list/detail and user detail reads with authentication. Catch lists and species personal bests use the authenticated owner; conflicting user IDs are rejected. Catch detail queries include ownership for ordinary users and return 404 for another user's catch. Admins retain individual catch/profile access for existing administration and review workflows.
- [x] Protect species personal-best data while retaining anonymous access to the base species catalog.
- [x] Review all currently registered personal-data/catalog/write routes and remaining user_id/userId inputs. Protect weather-provider use, remove owner details from public lure queries, enforce authenticated self-filtering, guard the unused approved-submission handler, and scope trip catch unlinking to the owner. Route matrix and regression coverage are documented in SECURITY_AUDIT.md. Recheck authorization whenever routes change.
- [x] Fix authentication middleware wiring on user routes: attach the verified user before requiring login on account endpoints; restrict the user list to admins. Species routes now attach the verified user before their existing admin checks. Add regression coverage for permitted self-service and admin operations, anonymous requests, cross-user attempts, and malformed user IDs.
- [x] Preserve signup behind opt-in environment flags, disabled by default: ALLOW_PUBLIC_SIGNUP=true enables the API endpoint; VITE_ALLOW_PUBLIC_SIGNUP=true enables Vue registration. When off, the Sign up button remains visible but disabled with a hover/focus explanation. Disabled API requests return 403 before account operations. See SECURITY_SETUP.md for restart/rebuild instructions.
- [ ] Optionally add a trusted server-side account-provisioning command if accounts need to be created without temporarily enabling public registration.
- [x] Consolidate JWT configuration and remove the hardcoded fallback signing secret. Refuse startup with missing/unsafe configuration, explicitly restrict HS256 signing/verification, validate token lifetimes/claims, parse Bearer headers strictly, and require an existing user through both middleware entry points. Real-library cryptographic regression tests cover forged, expired, wrong-algorithm, and malformed tokens.
- [ ] Assess deployed secret exposure and repository history privately; rotate credentials if needed. Local authentication configuration passed validation without printing values; no credentials have been rotated.
- [x] Revoke the current session on logout using a signed unique session ID and PostgreSQL-backed revocations. Authentication checks revocations on every authenticated request and fails closed if the store is unavailable. Vue confirms server logout before clearing its token and shows retryable failures. Revocation survives API restarts; other device sessions remain valid. Password-change behavior is out of scope until that feature exists.
- [ ] Decide whether to migrate browser token storage from localStorage to Secure/HttpOnly/SameSite cookies with CSRF defenses. Current bearer-token storage and the default 24-hour lifetime remain unchanged.
- [x] Add per-IP general API, login, signup, upload/catch-creation, and weather limits, plus a normalized-account failed-login limit. Return JSON 429 responses with retry/rate-limit headers. IPv6 clients use subnet-aware IP keys through express-rate-limit.
- [ ] Verify TRUSTED_PROXIES against the deployed proxy topology. Default is no proxy trust; only explicit proxy IPs/CIDRs (or loopback) are accepted. Restrict access to the API origin so a trusted proxy cannot be bypassed.
- [ ] If deploying multiple API instances/workers, replace in-memory limiter counters with a shared store. The current single-process counters reset on restart; PostgreSQL logout revocations do not.
- [ ] Verify HTTPS and deployment boundaries: decide between private remote access, an identity-aware gateway, or direct public access. Keep PostgreSQL, Docker/debug services, and the API origin port inaccessible publicly. Ensure an access gateway cannot be bypassed through the origin.

## Additional hardening and operations

- [x] Replace raw controller error messages with safe public responses and private structured logs. Add request IDs and a final JSON error handler for parsing, CORS, and unexpected failures, including in development. Log only selected metadata; omit raw exceptions, SQL, credentials, bodies, tokens, and provider URLs. See SECURITY_AUDIT.md.
- [ ] Add security headers; configure production CORS origins. CORS is not authentication.
- [ ] Validate request types, lengths, IDs, and allowed fields; bound list sizes/pagination, external request timeouts, and upload processing concurrency.
- [ ] Restrict or disable Swagger endpoints and remove unnecessary test endpoints in production.
- [ ] Run containers as non-root; use a least-privilege database account, separate production configuration, and private secrets. Review persistent photo-volume permissions.
- [ ] Review dependency vulnerabilities and establish host/container/dependency update procedures.
- [ ] Back up PostgreSQL and persistent photos together; maintain a separate backup copy and test restoration.
- [ ] Monitor authentication failures, authorization failures, server errors, disk usage, and availability. Never log passwords, tokens, or secrets.

## Validation for the initial fixes

Run from the API repository:

```sh
node --test tests/criticalAuthorization.test.js tests/tackleBox.test.js tests/lure.test.js tests/fishMode.test.js tests/species.test.js
```

The route tests use real Express routing and authentication middleware with isolated database/JWT stubs and a temporary loopback HTTP server. They verify authorization and query ownership; they do not validate cryptographic JWT behavior or production networking.

## Read/account hardening behavior

- Catch lists without user_id now default to the signed-in user's catches, including when filtering by date or catch IDs. They never become a global list.
- Ordinary users may read/update/delete their own profile; admins retain existing profile read/delete privileges. Full string comparisons replace permissive parseInt ownership comparisons.
- Existing frontend API calls already send tokens for personal data, so no frontend changes are required.
- Login remains reachable; signup is now disabled. Logout now revokes the current signed session ID in PostgreSQL before confirming success.

Authentication configuration and registration behavior are documented in [SECURITY_SETUP.md](SECURITY_SETUP.md).

## Rate limiting and logout verification

- Local development migration `20261020000000-revoked-sessions.js` applied. Other databases must apply it before starting this API version.
- Full API regression suite: 102 passing tests, with the opt-in database test skipped by default. The PostgreSQL test also passed separately with RUN_DB_SECURITY_TESTS=true.
- Dependency installation reported 24 audit findings (6 moderate, 17 high, 1 critical). Dependency remediation remains a separate pending hardening task; no broad automatic dependency upgrades were applied.

The current authorization/error-handling review is documented in [SECURITY_AUDIT.md](SECURITY_AUDIT.md); the full API suite now has 107 passing tests (one opt-in database test skipped in the default run).
