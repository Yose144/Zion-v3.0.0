# ZION Identity Service (ZIS) Full-Stack Integration Plan

**Date:** 2026-08-23
**Scope:** L2 multichain (`V31/L2/multichain`), L4 OASIS (`V31/L4/oasis` + `APP&WEB/OasisWeb`), and Web 2.9 (`APP&WEB/website-v2.9`)
**Author:** Devin
**Status:** In progress — all four phases implemented locally, pending final smoke tests, commit and deploy

---

## 1. Executive summary

The ZION Identity Service (`APP&WEB/identity/`) is live on `https://auth.zionterranova.com` and already powers Web 2.9 login and session management. This plan closes the remaining gaps:

1. **L2 multichain** currently relies only on an operator API key for mutating routes. It must learn to trust and enforce ZIS sessions / API keys, resolve the caller's `ZisUser`, and use that identity for address derivation and transaction attribution.
2. **L4 OASIS** has its own player database but no SSO gate. OASIS Web is a separate Next.js app that re-exports the shared ZIS client but does not use it yet. We need to bind OASIS player profiles to ZIS users and require authentication for gameplay.
3. **website-v2.9** already has `AuthContext`, SIWE, and Edge middleware protecting `/account` and `/dashboard/private`. The remaining work is to extend route protection to the rest of the authenticated surface, unify the login redirect experience, and feed the authenticated user into the DeFi/DEX widgets.

The plan is split into four implementation phases plus a final testing and deploy phase. Each phase contains concrete files to change, acceptance criteria, and deploy notes. A more detailed technical and product plan covering the DEX execution, settlement, and multichain wallet integration is in [`ZionDexZis.md`](./ZionDexZis.md).

---

## 2. Current baseline

### 2.1 ZIS (already deployed)

- Fastify server with challenge/verify for Ed25519 and SIWE, profile, sessions, and API-key routes.
- `GET /api/auth/me` returns the full `ZisUser` including `linkedAddresses` and `oasisPlayer`.
- Signed `zion_session` cookie scoped to `.zionterranova.com` enables SSO across subdomains.
- Prisma schema unifies `User`, `LinkedAddress`, `Session`, `ApiKey`, `OasisPlayer`, `DexOrder`, `BridgeTransaction`, and `Notification`.

<ref_file file="/home/zionserver/2.9.6-main/APP&WEB/identity/src/routes/auth.ts" />
<ref_file file="/home/zionserver/2.9.6-main/APP&WEB/shared/prisma/schema.prisma" />

### 2.2 Shared client (ready for all consumers)

`APP&WEB/shared/zis-client.ts` exposes the full API surface: challenge/verify, `getCurrentUser`, profile, session, API-key, and `useZisAuth` React hook. It works both browser-side (cookie credentials) and server-side (cookie header forwarding).

<ref_file file="/home/zionserver/2.9.6-main/APP&WEB/shared/zis-client.ts" />

### 2.3 L2 multichain (auth implemented)

The Axum server in `V31/L2/multichain/src/server.rs` now resolves callers via the `zion_session` cookie or a ZIS API key (`resolve_zis_auth` in `src/zis_auth.rs`). `ZisUser` is attached to request extensions and `require_user` is used by mutating handlers. CORS allows credentials for `*.zionterranova.com` origins and local dev.

<ref_file file="/home/zionserver/2.9.6-main/V31/L2/multichain/src/zis_auth.rs" />
<ref_file file="/home/zionserver/2.9.6-main/V31/L2/multichain/src/server.rs" />

### 2.4 L4 OASIS (auth implemented)

The OASIS backend in `V31/L4/oasis/src/server.rs` now wraps sensitive POST routes with `require_auth` and resolves ZIS sessions / API keys (`src/zis_auth.rs`). It verifies the caller owns the `:address` path parameter and syncs `player.user_id` to the ZIS user. `APP&WEB/OasisWeb/src/contexts/AuthContext.tsx` provides ZIS-backed auth and uses the player's ZION address.

<ref_file file="/home/zionserver/2.9.6-main/V31/L4/oasis/src/server.rs" />
<ref_file file="/home/zionserver/2.9.6-main/APP&WEB/OasisWeb/src/lib/zis.ts" />

### 2.5 website-v2.9 (auth integration)

Web 2.9 now has:

- `AuthContext` backed by ZIS.
- Local Next.js proxy routes for `/api/auth/*`, `/api/session/*`, and `/api/keys/*`.
- Edge middleware (`src/proxy.ts`) that protects `/account`, `/dashboard/private`, `/dex`, `/swap`, `/ziondex`, `/bridge`, `/multichain`, and `/defi`, redirecting unauthenticated users to `/login?redirect=...`.
- `CrossChainSwapWidget` sends `credentials: 'include'`, pre-fills the source address from linked addresses, and prompts for login before swap execution.
- `NavAuthButton`, `LoginModal`, and `AccountPage`.

<ref_file file="/home/zionserver/2.9.6-main/APP&WEB/website-v2.9/src/contexts/AuthContext.tsx" />
<ref_file file="/home/zionserver/2.9.6-main/APP&WEB/website-v2.9/src/proxy.ts" />

---

## 3. Goals and non-goals

### Goals

- Every ZIS-authenticated user can use the same identity on Web 2.9, OASIS Web, L2 multichain, and L4 OASIS without a second login.
- Mutating L2 endpoints are gated by ZIS identity (session cookie or API key) and attribute on-chain intents to a `ZisUser`.
- L4 OASIS gameplay is gated by ZIS identity and player profiles are linked to `User.oasisPlayer`.
- website-v2.9 route protection is consistent and the login redirect UX is unified.
- DeFi/DEX widgets on Web 2.9 carry the authenticated identity to the L2 API.

### Non-goals

- Replacing the L4 OASIS local SQLite game DB with the ZIS Prisma DB in one step. The first pass adds an identity gate and a `userId` mapping; a later migration can move game state if needed.
- Real on-chain DEX settlement. This plan covers identity and API auth only; on-chain settlement remains the next L2 milestone.
- Non-EVM chains. They stay disabled until their adapters are ready.

---

## 4. Guiding principles

1. **Single source of truth for identity:** `https://auth.zionterranova.com` is the only issuer. No other service issues sessions.
2. **Cookie-first for browser apps:** Browser frontends send the `zion_session` httpOnly cookie with `credentials: 'include'` and CORS configured. Server-side consumers forward the `Cookie` header.
3. **API-key fallback for headless callers:** CLI/automated scripts use a ZIS API key. A new `POST /api/keys/verify` endpoint lets backend services validate any key by talking to ZIS.
4. **Address ownership is proven in ZIS:** L2/L4 must not trust a raw `address` body or path parameter. They resolve the caller's `ZisUser` and then select an address from `linkedAddresses` that matches the requested chain.
5. **Rate limits remain, but separate by auth level:** Authenticated users get a higher rate-limit bucket than anonymous or IP-based traffic.

---

## 5. Phase 1 — L2 multichain ZIS gating

### 5.1 Add a ZIS auth resolver to the multichain gateway

**What to build**

Introduce a new Axum middleware and an `AuthContext` extension that resolves the caller before the handler runs.

- Read `Cookie: zion_session=...` or `Authorization: Bearer <zis-api-key>`.
- Call `https://auth.zionterranova.com/api/auth/me` with the cookie, or `POST /api/keys/verify` for an API key.
- Cache the resolved `ZisUser` for the lifetime of the request and insert it into the request extensions.
- If no credentials are present, mark the request as `anonymous` and still allow public GETs (rate-limited by IP).
- If credentials are present but invalid, return `401 Unauthorized`.

**Files to change**

- `V31/L2/multichain/src/rate_limit.rs` — extend `RateLimiter` to optionally hold a `ZisClient` and provide `resolve_user(req)`.
- `V31/L2/multichain/src/server.rs` — add `.layer(axum::middleware::from_fn_with_state(..., resolve_auth))` before the route handlers.
- `V31/L2/multichain/src/service.rs` — add a `caller: Option<ZisUser>` to `MultichainService` method calls that need identity.
- `V31/L2/multichain/Cargo.toml` — add `reqwest` and `serde` features if not already present.

**Reference:** current middleware only checks the static API key.

<ref_snippet file="/home/zionserver/2.9.6-main/V31/L2/multichain/src/rate_limit.rs" lines="92-135" />

### 5.2 CORS: allow credentials and expose the cookie

The multichain CORS layer must allow cookies from `app.zionterranova.com` and `oasis.zionterranova.com`.

- Add `.allow_credentials(true)` in `CorsLayer`.
- Keep the origin allow-list but also allow the local dev origins (`http://localhost:3000`, `http://localhost:3001`).
- Add `Cookie` to the allowed headers.

**Files to change**

- `V31/L2/multichain/src/server.rs` around the `CorsLayer` construction.

### 5.3 Protect mutating routes

Update route handlers to require a resolved identity for state-changing operations.

| Route | Auth requirement |
|-------|------------------|
| `POST /v1/swap/quote` | optional (read-only quote) |
| `POST /v1/swap/quote/multi` | optional |
| `POST /v1/swap/execute` | **required** |
| `POST /v1/swap/intent` | **required** |
| `POST /v1/swap/intent/:id/bid` | **required** (solver) |
| `POST /v1/swap/intent/:id/settle` | **required** |
| `POST /v1/swap/intent/:id/execute` | **required** |
| `POST /v1/swap/intent/:id/broadcast` | **required** |
| `POST /v1/swap/solve` | **required** (solver) |
| `POST /v1/bridge/submit` | **required** |
| `POST /v1/multichain/swaps/htlc/lock` | **required** |
| `POST /v1/multichain/swaps/htlc/claim` | **required** |
| `POST /v1/multichain/swaps/htlc/refund` | **required** |
| `POST /v1/wallet/address` | optional but tied to caller if present |
| `POST /v1/wallet/sign` | **required** |
| `POST /v1/swap/pool/deploy` | **required** (admin or DAO key) |

**Implementation detail:** introduce a small helper:

```rust
fn require_user(ext: &Extensions) -> Result<ZisUser, StatusCode> {
    ext.get::<ZisUser>().ok_or(StatusCode::UNAUTHORIZED).map(|u| u.clone())
}
```

### 5.4 Wallet / address derivation tied to ZIS

Current `wallet_address` derives from the multichain service seed. We want an authenticated caller to receive their own address for the requested chain.

- If a `ZisUser` is present and the request `chain` is `zion-l1` or `evm`, look up the first `LinkedAddress` with matching `chainType` (and `chainId` for EVM if provided).
- If no linked address exists, optionally derive one from the user's primary address + chain path, or return `404` and instruct the user to link the address in Web 2.9.
- For cross-chain quotes/executes, the `from` address in the request body must be in the caller's `linkedAddresses`.

**Files to change**

- `V31/L2/multichain/src/server.rs` (`wallet_address` handler).
- `V31/L2/multichain/src/service.rs` (`wallet_address` service method).

### 5.5 Persist DEX and bridge orders per user

The Prisma schema already has `DexOrder` and `BridgeTransaction`. Store order/bridge records when `swap_execute`, `create_intent`, or `bridge_submit` succeeds, keyed by `userId`.

- Add `DexOrder` and `BridgeTransaction` models to `APP&WEB/shared/prisma/schema.prisma` if not already in the generated client.
- Expose a new ZIS route `POST /api/orders/dex` and `POST /api/orders/bridge` for the multichain service to report completed operations.
- Multichain service calls these routes with a service-to-service API key.

### 5.6 Phase 1 acceptance criteria

- `cargo test -p zion-multichain` passes.
- `POST /v1/swap/execute` without a `zion_session` cookie or API key returns `401`.
- With a valid `zion_session` cookie, `GET /v1/multichain/chains` returns the chain list and the resolved user is available to handlers.
- `POST /v1/wallet/address` for an authenticated user returns the user's linked address for the requested chain.
- Mutating endpoints do not require the legacy static `ZION_MULTICHAIN_API_KEY` for browser calls (it can stay for the solver network if needed).

---

## 6. Phase 2 — L4 OASIS integration

### 6.1 Add ZIS auth middleware to the L4 OASIS backend

The L4 backend (`V31/L4/oasis`) is an Axum server. Add a middleware layer that resolves the caller exactly like L2.

- Read `Cookie: zion_session=...` or `Authorization: Bearer <api_key>`.
- Call ZIS and insert `ZisUser` into extensions.
- Reject POST/PUT/DELETE when no identity is resolved.

**Files to change**

- `V31/L4/oasis/src/server.rs` — add auth middleware layer to the sensitive POST router.
- `V31/L4/oasis/src/rate_limit.rs` — optionally use resolved identity as part of the rate-limit key.

### 6.2 Bind player profiles to ZIS users

The OASIS SQLite schema uses `address` as the player primary key. Add a `user_id` column and, on first authenticated request, upsert a `User.oasisPlayer` record in the ZIS Prisma DB.

- On `GET /api/v1/oasis/player/:address`, resolve the caller. If `:address` does not match one of the caller's linked addresses, return `403`.
- On player creation/upsert, write `userId` into the SQLite `players` table and call ZIS `PATCH /api/auth/me` or a new `POST /api/oasis/player` route to create the `OasisPlayer` row.
- The address used as the player key should be the user's primary ZIS address (zion-l1 by default, or the first linked EVM address).

**Files to change**

- `V31/L4/oasis/src/db.rs` — add `user_id` column to `players` and helper `save_player_user_id`.
- `V31/L4/oasis/src/server.rs` — player GET/POST handlers.
- `V31/L4/oasis/src/player.rs` — add `user_id` field to `Player`.
- `APP&WEB/identity/src/routes/auth.ts` or a new `oasis.ts` — add `GET /api/oasis/player` and `POST /api/oasis/player` (or use `/api/auth/me` with `include.oasisPlayer`).

### 6.3 OASIS Web SSO

`APP&WEB/OasisWeb` is a Next.js app with a landing page and game routes under `app/(game)/`.

- Wrap the app in an `OasisAuthProvider` that calls `checkOasisAuth()`.
- Add a login modal (reuse the shared `getChallenge` / `verifyEd25519` / `verifySiwe` flow from `src/lib/zis.ts`).
- In `src/app/(game)/layout.tsx`, check the cookie server-side. If unauthenticated, redirect to `https://app.zionterranova.com/login?redirect=https%3A%2F%2Foasis.zionterranova.com%2Fdashboard`.
- On `app/(landing)/page.tsx`, show "Enter OASIS" CTA that opens the login modal.
- After login, call L4 `/api/v1/oasis/player/:address` to load the player profile and store it in a `GameStore` slice.

**Files to change**

- `APP&WEB/OasisWeb/src/lib/zis.ts` (already exists, may need small helpers).
- `APP&WEB/OasisWeb/src/contexts/AuthContext.tsx` (new).
- `APP&WEB/OasisWeb/src/components/LoginModal.tsx` (new, can mirror Web 2.9 UI).
- `APP&WEB/OasisWeb/src/app/(game)/layout.tsx`.
- `APP&WEB/OasisWeb/src/app/(landing)/page.tsx`.
- `APP&WEB/OasisWeb/src/store/gameStore.ts`.

### 6.4 Phase 2 acceptance criteria

- `cargo test -p zion-oasis` passes.
- `POST /api/v1/oasis/player/:address/xp` without auth returns `401`.
- With auth, the player returned from `GET /api/v1/oasis/player/:address` matches the caller's linked address.
- `OasisWeb` landing page shows a login CTA; unauthenticated users hitting `https://oasis.zionterranova.com/dashboard` are redirected to Web 2.9 login.
- Authenticated OASIS Web can load and display the player's `totalXp` and `level`.

---

## 7. Phase 3 — website-v2.9 auth extension

### 7.1 Complete route protection

The Edge middleware in `src/proxy.ts` already protects `/account` and `/dashboard/private`. Extend the protected prefix list.

Protected paths:

- `/account` (done)
- `/dashboard/private` (done)
- `/dex` and `/multichain`
- `/bridge`
- `/mining/dashboard` (if it requires a logged-in miner profile)
- `/market/*` (if market becomes part of Web 2.9)

Keep public pages unprotected:

- `/`, `/download`, `/roadmap`, `/news`, `/whitepaper`

**Files to change**

- `APP&WEB/website-v2.9/src/proxy.ts`.

### 7.2 Unify `NavAuthButton` redirect behavior

`NavAuthButton` opens the `LoginModal` when unauthenticated. Some CTA buttons link directly to `/login`. Unify them:

- All login entry points should preserve the current `pathname` in `?redirect=`.
- `NavAuthButton` should set `redirect` to `window.location.pathname` before opening the modal.
- The `/login/page.tsx` already reads `redirect` from `useSearchParams`; ensure it is forwarded to `LoginModal`.

**Files to change**

- `APP&WEB/website-v2.9/src/components/NavAuthButton.tsx`.
- `APP&WEB/website-v2.9/src/app/login/page.tsx`.

### 7.3 Feed authenticated identity into DeFi / DEX widgets

`CrossChainSwapWidget` currently calls the local `/api/swap/quote/multi` route or the multichain API directly. It needs to include the `zion_session` cookie and, where useful, the resolved `ZisUser` address.

- In `APP&WEB/website-v2.9/src/lib/zis.ts` and `AuthContext`, make the user's primary address and `linkedAddresses` easily available.
- `WalletContext` (rewritten in the recent DEX audit) should prefer the user's linked addresses if the user is logged in.
- `CrossChainSwapWidget` should:
  - Call L2 API with `credentials: 'include'`.
  - Pre-fill `fromAddress` from the user's linked EVM / zion-l1 address.
  - If the user is not logged in, prompt login before swap execution.
- The local Next.js proxy `/api/swap/*` should forward the `zion_session` cookie to the multichain service so the L2 auth middleware can resolve the caller.

**Files to change**

- `APP&WEB/website-v2.9/src/contexts/AuthContext.tsx`.
- `APP&WEB/website-v2.9/src/components/dex/CrossChainSwapWidget.tsx`.
- `APP&WEB/website-v2.9/src/contexts/WalletContext.tsx`.
- `APP&WEB/website-v2.9/src/lib/zis.ts`.

### 7.4 Surface linked addresses and API keys in the account dashboard

The `SecurityPanel` already shows active sessions and API keys. Add a "Linked Addresses" panel that:

- Lists `ZisUser.linkedAddresses`.
- Allows linking a MetaMask/EVM address via SIWE signature.
- Allows linking a ZION L1 address via Ed25519 signature (for users who logged in with SIWE but want a L1 address too).

**Files to change**

- `APP&WEB/website-v2.9/src/components/dashboard/SecurityPanel.tsx`.
- `APP&WEB/website-v2.9/src/components/dashboard/WalletOverview.tsx`.
- `APP&WEB/website-v2.9/src/app/account/page.tsx`.

### 7.5 Phase 3 acceptance criteria

- `npm run build` in `APP&WEB/website-v2.9` completes with 106 static pages.
- Edge middleware redirects unauthenticated requests to `/dex` and `/bridge` to `/login?redirect=/dex`.
- `NavAuthButton` always preserves the current page in `redirect`.
- `CrossChainSwapWidget` sends the `zion_session` cookie to L2; a logged-out user sees the login modal on swap execution.
- Account dashboard lists linked addresses and supports adding EVM and zion-l1 addresses.

---

## 8. Phase 4 — Shared client and ZIS hardening

### 8.1 Add a public API-key verification endpoint to ZIS

Backend services (L2, L4) cannot verify a ZIS API key without a database lookup or a new endpoint.

**Proposal:** add `POST /api/keys/verify` to `APP&WEB/identity/src/routes/apikey.ts`.

Request:

```json
{ "apiKey": "zis_..." }
```

Response:

```json
{ "valid": true, "user": { "id": "...", "primaryAddress": "..." } }
```

- Hash the key with SHA-256, look up `ApiKey` by `keyHash`, update `lastUsed`, return the owner.
- Return `401` if not found or revoked.
- Rate-limit this endpoint per API key.

**Files to change**

- `APP&WEB/identity/src/routes/apikey.ts`.
- `APP&WEB/shared/zis-client.ts` — add `verifyApiKey(apiKey)` helper for consumers.

### 8.2 Support linked-address verification for all chain types

Currently `LinkedAddress` records are created at first login. We also need explicit verification for users who log in with SIWE and later want to link a ZION L1 wallet, or vice versa.

- `POST /api/auth/link` accepts `{ address, chainType, signature, publicKey? }`.
- Verify the signature against a fresh ZIS challenge for that address.
- Insert `LinkedAddress` and return the updated `ZisUser`.
- Prevent duplicate `address` values; one address can only belong to one user.

**Files to change**

- `APP&WEB/identity/src/routes/auth.ts`.
- `APP&WEB/shared/zis-client.ts` — add `linkAddress(...)`.
- `APP&WEB/identity/src/lib/challenge.ts` — ensure the challenge is bound to the address and chain.

### 8.3 Session refresh / short-term token rotation

The current session is a 7-day signed JWT. Add an optional refresh:

- On every authenticated request, if the session is > 50% through its lifetime, issue a new `zion_session` cookie with a rolling 7-day expiry.
- Keep the same `jwtJti` or rotate it and update the DB row.
- This keeps active users logged in while invalidating stale sessions quickly.

**Files to change**

- `APP&WEB/identity/src/lib/auth.ts` (`requireAuth` preHandler).
- `APP&WEB/identity/src/routes/session.ts`.

### 8.4 Phase 4 acceptance criteria

- `npm run build` in `APP&WEB/identity` succeeds.
- `POST /api/keys/verify` returns the owner for a valid key and `401` for an invalid key.
- Linking a second address updates `ZisUser.linkedAddresses`.
- Rolling refresh works: the cookie expiry extends on activity.

---

## 9. Cross-layer integration tasks

### 9.1 Environment and service wiring

| Service | Change |
|---------|--------|
| `zion-zis.service` | Ensure `APP&WEB/identity` can reach L2 and L4 only if needed for service-to-service calls. |
| `zion-v31-multichain.service` | Add `ZIS_URL=https://auth.zionterranova.com` and `ZION_MULTICHAIN_CORS_ORIGINS` updated with `https://app.zionterranova.com,https://oasis.zionterranova.com` and dev origins. |
| `zion-v31-oasis.service` | Add `ZIS_URL` and `ZION_OASIS_ALLOWED_ORIGINS`. |
| `zion-website.service` | Add `ZIS_URL` and `NEXT_PUBLIC_ZIS_URL` env vars (already done for Web 2.9). |
| `zion-oasis-web.service` | Add `NEXT_PUBLIC_ZIS_URL=https://auth.zionterranova.com`. |

### 9.2 Nginx / CORS

- Multichain and OASIS are proxied by nginx on Edge. Ensure the proxy does not strip the `Cookie` header.
- For `https://app.zionterranova.com` calling `https://zionterranova.com/api/multichain/...` or the multichain origin directly, the CORS setup in `V31/L2/multichain/src/server.rs` must allow credentials.

---

## 10. Testing matrix

| Test | Tool | Expected |
|------|------|----------|
| L2 unit tests | `cargo test -p zion-multichain` | all pass |
| L4 unit tests | `cargo test -p zion-oasis` | all pass |
| Identity tests | `cd APP&WEB/identity && npm test` | pass |
| Web 2.9 build | `cd APP&WEB/website-v2.9 && npm run build` | 106 pages, no type errors |
| OASIS Web build | `cd APP&WEB/OasisWeb && npm run build` | success |
| Auth E2E (L2) | `curl -b zion_session=... -X POST https://zionterranova.com/api/multichain/v1/swap/execute` | returns quote/result for authenticated user |
| Auth E2E (L4) | `curl -b zion_session=... -X POST https://oasis.zionterranova.com/api/v1/oasis/player/:address/xp` | 200 and updates player |
| Logout cross-domain | Log out on Web 2.9, refresh OASIS Web | OASIS Web shows login CTA |

---

## 11. Deployment and rollback

### 11.1 Order of deploy

1. ZIS (`APP&WEB/identity`) — add `/api/keys/verify` and `/api/auth/link`.
2. L2 multichain — deploy new binary, restart `zion-v31-multichain.service`.
3. L4 OASIS — deploy new binary, restart `zion-v31-oasis.service`.
4. Web 2.9 — `npm run build`, rsync, restart `zion-website.service`.
5. OASIS Web — `npm run build`, rsync, restart `zion-oasis-web.service`.

### 11.2 Rollback

- Each Rust service can be rolled back to the previous binary kept in `/opt/zion/V31/target/release/` or rebuilt from the pre-change commit.
- Next.js apps can be redeployed from the previous commit.
- ZIS DB migrations (Prisma) should be additive only for this plan; if a rollback is needed, new columns can remain unused.

---

## 12. Open questions and decision log

| # | Question | Proposed decision | Owner |
|---|----------|-------------------|-------|
| 1 | Should L2 use ZIS API keys for solver network? | Keep a separate solver API key, but also allow ZIS-linked solver identity. | TBD |
| 2 | Should `DexOrder` / `BridgeTransaction` live in ZIS DB or multichain DB? | Use ZIS Prisma as the source of truth for user-facing history; multichain keeps in-memory execution state. | TBD |
| 3 | Which address becomes the OASIS player key? | The user's primary ZION L1 address if available, otherwise the first linked EVM address. | TBD |
| 4 | Should OASIS Web share the same login modal UI as Web 2.9? | Reuse the same flow but with OASIS styling; the shared `zis-client` already supports it. | TBD |

---

## 13. Appendix — file map

### Identity service

- `APP&WEB/identity/src/routes/auth.ts`
- `APP&WEB/identity/src/routes/apikey.ts`
- `APP&WEB/identity/src/routes/session.ts`
- `APP&WEB/identity/src/lib/auth.ts`
- `APP&WEB/identity/src/lib/challenge.ts`

### Shared client

- `APP&WEB/shared/zis-client.ts`
- `APP&WEB/shared/prisma/schema.prisma`

### L2 multichain

- `V31/L2/multichain/src/server.rs`
- `V31/L2/multichain/src/service.rs`
- `V31/L2/multichain/src/rate_limit.rs`
- `V31/L2/multichain/src/wallet/mod.rs`
- `V31/L2/multichain/src/swap/dex/executor.rs`

### L4 OASIS backend

- `V31/L4/oasis/src/server.rs`
- `V31/L4/oasis/src/db.rs`
- `V31/L4/oasis/src/player.rs`
- `V31/L4/oasis/src/rate_limit.rs`

### L4 OASIS web

- `APP&WEB/OasisWeb/src/lib/zis.ts`
- `APP&WEB/OasisWeb/src/app/(game)/layout.tsx`
- `APP&WEB/OasisWeb/src/app/(landing)/page.tsx`
- `APP&WEB/OasisWeb/src/store/gameStore.ts`

### Web 2.9

- `APP&WEB/website-v2.9/src/proxy.ts`
- `APP&WEB/website-v2.9/src/contexts/AuthContext.tsx`
- `APP&WEB/website-v2.9/src/lib/zis.ts`
- `APP&WEB/website-v2.9/src/components/NavAuthButton.tsx`
- `APP&WEB/website-v2.9/src/components/LoginModal.tsx`
- `APP&WEB/website-v2.9/src/app/login/page.tsx`
- `APP&WEB/website-v2.9/src/app/account/page.tsx`
- `APP&WEB/website-v2.9/src/components/dex/CrossChainSwapWidget.tsx`
- `APP&WEB/website-v2.9/src/contexts/WalletContext.tsx`

---

## 12. Progress log

- **2026-08-23 (Web 2.9 auth migration):** Legacy local JWT routes removed; `src/proxy.ts` now validates protected pages against ZIS. `ZION_JWT_SECRET` no longer required by website code.
- **2026-08-23 (Plan update):** Status moved to *In progress*. `POST /api/keys/verify` already exists in `APP&WEB/identity/src/routes/apikey.ts`. `DexOrder` and `BridgeTransaction` models exist in the shared Prisma schema.

*Next: finish Phase 4 hardening (`/api/auth/link`, session refresh, shared client helpers), then close remaining gaps in Phases 1–3.*
