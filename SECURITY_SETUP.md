# Authentication setup for the personal instance

## Registration

Signup is preserved and disabled by default. To enable it, set these flags in each application's private `.env` file:

API (`anglers-index-api/.env`):

```dotenv
ALLOW_PUBLIC_SIGNUP=true
```

Vue (`anglers-index-frontend-new/.env`):

```dotenv
VITE_ALLOW_PUBLIC_SIGNUP=true
```

Restart the API and restart the Vue development server, or rebuild/redeploy the production frontend. Set both flags to `false` (or remove them) to disable signup again. Only the exact value `true` enables signup.

The API flag is the security control: when disabled, `POST /users/signup` returns 403 before looking up or creating accounts. The frontend flag enables the registration button/form and landing-page call to action. When disabled, the Sign up button remains visible and disabled, with a hover/keyboard-focus message explaining that signup is disabled; it cannot bypass the API flag. If only the frontend flag is enabled, registration attempts still fail. No settings API is used. These booleans are not secrets; JWT/database secrets must never use a VITE_ prefix.

Existing accounts can always sign in regardless of the signup flags. The signup controller uses the User model's password-hashing hooks and does not accept client-supplied admin privileges.

## Required server configuration

Set these values in the API's private environment, never in frontend `VITE_*` variables:

- `JWT_SECRET_KEY`: a cryptographically random secret of at least 32 bytes. Missing, short, obvious placeholder, and low-diversity values cause startup to fail. These checks cannot prove that a secret was randomly generated.
- `JWT_ALGORITHM`: omit it or set `HS256`. Other algorithms cause startup to fail.
- `JWT_EXPIRATION`: whole seconds from 1 through 86400; defaults to 86400 (24 hours). Invalid/empty values cause startup to fail rather than silently selecting a default.

Generate a new secret privately, for example with `openssl rand -hex 32`, and store the result in your server's private configuration. Do not paste the value into tickets, chat, source files, or frontend configuration. Changing it invalidates all existing tokens, so sign in again after rotation. No deployed secrets have been rotated by this change.

Signing and verification share one configuration. Verification explicitly permits HS256, requires a valid numeric user ID and issued/expiry times, enforces the configured maximum lifetime, and rejects future-issued tokens. Bearer headers must contain exactly one token. Both authentication middleware entry points require that the user still exists in the database.

New tokens carry a random UUID session ID (jti). Older tokens without that claim are rejected: sign in again after this update. Shortening JWT_EXPIRATION also shortens acceptance of previously issued tokens.

Implementation uses the documented `algorithms`, `expiresIn`, and `maxAge` options in [node-jsonwebtoken](https://github.com/auth0/node-jsonwebtoken#readme).

## Logout revocation

Apply the new migration before starting this version against each database:

```sh
npx sequelize-cli db:migrate --name 20261020000000-revoked-sessions.js
```

This migration was already applied to the local development database. It creates revoked_sessions with a unique session ID, owning user ID, and indexed expiry. No passwords or bearer tokens are stored in that table.

POST /users/logout requires the current bearer token and persists its signed session ID before returning success. Every authentication check consults PostgreSQL. Revocation survives API restarts and only affects that login; other devices remain signed in. Previously authorized requests already in flight are not cancelled. Expired revocations are deleted on subsequent successful logout; expired tokens are rejected independently even if cleanup has not run.

The frontend waits for confirmation before clearing local session data. Network/server/rate-limit failures leave the session visible with a retry message. An already invalid/revoked token can be cleared locally. Authentication-store outages return a safe 503 rather than accepting a token without checking revocation.

Browser token storage remains in localStorage. Cookie migration and password-change revocation are not part of this change. The server-side revocation design follows [OWASP REST guidance](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).

## Rate limiting

Limits are enforced before endpoint work, using [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit). The general limit also covers documentation routes. More specific budgets apply in addition:

| Budget | Limit | Key |
| --- | --- | --- |
| General API | 600 requests / 5 minutes | IP (IPv6 subnet-aware) |
| Login | 30 attempts / 15 minutes | IP |
| Failed login | 10 failures / 15 minutes | Hash of normalized username, shared across IPs |
| Signup | 5 attempts / hour | IP |
| Catch creation and photo uploads combined | 30 requests / 15 minutes | IP |
| Weather lookup and lake create/update geocoding combined | 20 requests / minute | IP |

Successful login requests do not consume the account-failure budget, but do count against the IP limit. Different accounts on the same IP share the IP budget. Limits return a JSON 429 error, Retry-After, and standard rate-limit headers. CORS preflight is excluded. These limits can be tuned in middleware/rateLimits.js.

Counters are held in memory for a single API process and reset on restart. Before scaling to multiple instances/workers, use a shared limiter store. Account throttling deliberately also applies across IPs, so a targeted attacker can temporarily delay login to that account; the window expires automatically.

### Reverse proxies

Proxy trust defaults to off, preventing clients from choosing their rate-limit identity through forwarded headers. Configure the actual proxy source addresses in the API environment when deploying behind a reverse proxy, for example:

```dotenv
# Only if your reverse proxy really connects from loopback:
TRUSTED_PROXIES=loopback
# Or a specific private proxy address/CIDR:
# TRUSTED_PROXIES=10.0.0.2/32
```

Never blindly trust all proxies. Configure the proxy to overwrite incoming forwarding headers and prevent direct public access to the API origin. Without a correct proxy setting, all clients behind that proxy share its IP budget. Test the deployed client IP behavior before public exposure.

## Verification

```sh
node --test tests/*.test.js
# Optional integration check against the configured database (requires an existing account):
RUN_DB_SECURITY_TESTS=true node --test tests/sessionDatabase.test.js
```

JWT tests use randomly generated test keys and the real JWT library. Authorization route tests use isolated JWT/database stubs. Only the explicitly enabled database integration test contacts the configured database; it uses temporary revocation data and does not change existing accounts.
