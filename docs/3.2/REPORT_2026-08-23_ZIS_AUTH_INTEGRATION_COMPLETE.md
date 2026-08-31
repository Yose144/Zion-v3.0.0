# Report: ZIS authentication integration for Web 2.9 (Phases 1–4)

**Date:** 2026-08-23  
**Scope:** `APP&WEB/identity` (ZION Identity Service), `APP&WEB/website-v2.9` (Next.js), `APP&WEB/shared/zis-client.ts`, `APP&WEB/shared/prisma/schema.prisma`  
**Authors:** Devin (agent)  
**Status:** Done, deployed to Edge, pushed to `origin/main`

---

## 1. Summary

Completed the full transition of the Web 2.9 authentication stack to the **ZION Identity Service (ZIS)**. The legacy website JWT flow was replaced by a ZIS-backed, cookie-based SSO session. The work spanned four planned phases:

1. **Phase 1:** Wire `AuthContext` and login flow through a local Next.js proxy to ZIS.
2. **Phase 2:** Harden ZIS (JWT cookies, session management, profile, challenge/cookie cleanup).
3. **Phase 3a:** Add an **Account Security** UI (linked addresses, active sessions, API keys).
3. **Phase 3b:** Add **SIWE / MetaMask** login (EIP-191 `personal_sign` + EIP-4361 message).
4. **Phase 4:** Add Edge middleware route protection for `/account` and `/dashboard/private`, with redirect to `/login?redirect=...`.

All changes are live on `https://app.zionterranova.com` and pushed to `origin/main`.

---

## 2. Architecture

```
Browser
  │
  ├─ /login ── LoginModal / login page
  │      │
  │      ▼
  ├─ AuthContext (React)
  │      │   - loginWithWallet (Ed25519 / ZION L1)
  │      │   - loginWithSiwe (MetaMask / EVM)
  │      │   - logout, updateProfile
  │      ▼
  ├─ lib/zis.ts (client wrappers)
  │      │
  │      ▼
  ├─ Next.js proxy routes (app/api/auth/[...zis], /session/[[...path]], /keys/[[...path]])
  │      │
  │      ▼
  └─ ZIS backend  auth.zionterranova.com  (127.0.0.1:8096)
         │
         ├─ challenge, verify/ed25519, verify/siwe
         ├─ me, logout, profile
         ├─ sessions, apikeys
         └─ Prisma + SQLite (users, linkedAddresses, sessions, apiKeys)

Cookie `zion_session` (httpOnly, secure, SameSite=None, domain .zionterranova.com)
  │
  ▼
Next.js middleware (src/proxy.ts) ─ protects /account and /dashboard/private
```

---

## 3. Phase 1 — AuthContext on ZIS proxy

### What changed

- `APP&WEB/website-v2.9/src/lib/zis.ts` — new browser/client wrappers for all ZIS endpoints.
- `APP&WEB/website-v2.9/src/app/api/auth/[...zis]/route.ts` — catch-all proxy that forwards body, headers and cookies to ZIS and passes the `Set-Cookie` response back.
- `APP&WEB/website-v2.9/src/contexts/AuthContext.tsx` — re-implemented `loginWithWallet` to get a ZIS challenge, sign it with the Zion Wallet private key, call `verify/ed25519`, then fetch the full ZIS user.

### Result

- Login with a ZION wallet now creates the session cookie on `auth.zionterranova.com` and the website reads the same cookie.
- Logout calls ZIS `/api/auth/logout` and clears the cookie.
- Profile updates (`displayName`) call ZIS and refresh local `AuthUser`.

---

## 4. Phase 2 — ZIS server hardening

### What changed

- `APP&WEB/identity/src/lib/auth.ts` — `issueSession` now sets the cookie with the correct `domain`, `path`, `httpOnly`, `secure`, `sameSite=None` flags.
- `APP&WEB/identity/src/routes/auth.ts` —
  - `GET /me` returns the user with `linkedAddresses`.
  - `POST /logout` revokes the current session in the `Session` table.
  - `PATCH /me` updates `displayName`, `email`, `avatar`, `bio`.
- `APP&WEB/identity/src/routes/session.ts` —
  - `GET /sessions` lists active sessions for the current user.
  - `DELETE /sessions/:id` revokes one session.
  - `DELETE /sessions` revokes all sessions for the user.
- `APP&WEB/identity/src/routes/apikey.ts` —
  - `GET /keys` lists API keys.
  - `POST /keys` creates a key and returns the raw key once.
  - `DELETE /keys/:id` revokes a key.
- `APP&WEB/shared/zis-client.ts` — new TypeScript interfaces (`ZisActiveSession`, `ZisApiKey`, `ZisLinkedAddress`) and functions.
- `APP&WEB/shared/prisma/schema.prisma` — added `Session`, `ApiKey` and expanded `User` with profile fields.

### Result

- All session state lives in ZIS.
- Users can list and revoke their own sessions and API keys.

---

## 5. Phase 3a — Account Security UI

### What changed

- `APP&WEB/website-v2.9/src/components/dashboard/SecurityPanel.tsx` (new)
  - Three sections: **Linked addresses**, **Active sessions**, **API keys**.
  - Create / revoke API keys with one-time copy.
  - Revoke individual session or all sessions.
  - Bilingual copy (EN / CS).
- `APP&WEB/website-v2.9/src/app/account/page.tsx` — added a `security` tab.
- `APP&WEB/website-v2.9/src/contexts/AuthContext.tsx` — `AuthUser` now carries `linkedAddresses`.
- `APP&WEB/website-v2.9/src/lib/zis.ts` — added wrappers for session and API key endpoints.
- `APP&WEB/website-v2.9/src/app/api/session/[[...path]]/route.ts` and `src/app/api/keys/[[...path]]/route.ts` — proxy routes for the new backend endpoints.

### Result

- `/account` now has a working Security tab.
- Tested end-to-end on Edge: create/list/delete API key and list sessions all return 200.

---

## 6. Phase 3b — SIWE / MetaMask login

### What changed

- `APP&WEB/identity/src/lib/challenge.ts` — `verifySiwe` is now secure:
  - Parses the SIWE message with the `siwe` package.
  - Verifies the EIP-191 signature and recovers the signer address.
  - Checks the nonce against the active ZIS challenge.
  - Only succeeds if recovered address equals the claimed address.
- `APP&WEB/identity/src/routes/auth.ts` — `POST /verify/siwe` now calls the new `verifySiwe` and no longer trusts a client-supplied `recoveredAddress`.
- `APP&WEB/website-v2.9/src/contexts/AuthContext.tsx` — added `loginWithSiwe`:
  - Detects `window.ethereum`.
  - Requests `eth_requestAccounts`.
  - Fetches a ZIS challenge with `chainType: 'evm'`.
  - Builds an EIP-4361 SIWE message (domain, address, statement, URI, version, chainId, nonce, issuedAt, expirationTime).
  - Signs via `personal_sign`.
  - Submits to `/api/auth/verify/siwe` through the proxy.
  - Fetches the full user from ZIS.
- `APP&WEB/website-v2.9/src/app/login/page.tsx` and `src/components/LoginModal.tsx` — added **Sign in with MetaMask** buttons and loader/error states.

### Result

- Backend SIWE verification tested with a generated EVM wallet — returned 200 and JWT cookie.
- The flow is live on `https://app.zionterranova.com/login`. A user with MetaMask can now authenticate with an Ethereum address.

---

## 7. Phase 4 — Protected routes / middleware

### What changed

- `APP&WEB/website-v2.9/src/proxy.ts` — refactored:
  - `PROTECTED_PATHS = ['/account', '/dashboard/private']`.
  - `isProtected()` and `requireAuthRedirect()` helpers.
  - Verifies the `zion_session` JWT with `ZION_JWT_SECRET`.
  - Redirects unauthenticated or invalid-token requests to `/login?redirect=<pathname>`.
  - Updated `config.matcher` to include `/dashboard/private/:path*`.

### Result

- `https://app.zionterranova.com/account` without cookie → `307` to `/login?redirect=%2Faccount`.
- `https://app.zionterranova.com/dashboard/private` without cookie → `307` to `/login?redirect=%2Fdashboard%2Fprivate`.
- Both pages load with a valid `zion_session` cookie.

---

## 8. Deployment & verification

### Build

- `APP&WEB/identity` → `npm run build` (tsc) passes.
- `APP&WEB/website-v2.9` → `npm run build` (Next.js 16.2.9) generates 113 pages, including the new proxy routes.

### Deploy

- `APP&WEB/identity/dist/` rsynced to `zion-new:/opt/zion/identity/dist/`, `zion-zis.service` restarted.
- `APP&WEB/website-v2.9/` `.next/standalone`, `public`, `src`, config and `package.json` rsynced to `zion-new:/opt/zion/APP&WEB/website-v2.9/`, `zion-website.service` restarted.

### Live verification performed

| Test | Command / flow | Expected | Result |
|------|----------------|----------|--------|
| ZIS health | `curl http://127.0.0.1:8096/health` | `{"status":"ok"}` | ok |
| Ed25519 login | `POST /api/auth/challenge` + `verify/ed25519` + `GET /account` | 200 with cookie | ok |
| SIWE login | `POST /api/auth/challenge` (evm) + `verify/siwe` | 200 with cookie | ok |
| Session list | `GET /api/session` with cookie | 200 | ok |
| API key create/list/delete | `POST/GET/DELETE /api/keys` with cookie | 200 | ok |
| Protected `/account` without cookie | `curl /account` | 307 → `/login?redirect=%2Faccount` | ok |
| Protected `/dashboard/private` without cookie | `curl /dashboard/private` | 307 → `/login?redirect=%2Fdashboard%2Fprivate` | ok |
| `/dashboard/private` with valid cookie | `curl -b zion_session=...` | 200 | ok |

---

## 9. Files changed

### ZIS backend

- `APP&WEB/identity/src/lib/auth.ts`
- `APP&WEB/identity/src/lib/challenge.ts`
- `APP&WEB/identity/src/routes/auth.ts`
- `APP&WEB/identity/src/routes/session.ts` (new)
- `APP&WEB/identity/src/routes/apikey.ts` (new)
- `APP&WEB/identity/package.json`
- `APP&WEB/identity/deploy/deploy-zis.sh`

### Shared client

- `APP&WEB/shared/zis-client.ts`
- `APP&WEB/shared/prisma/schema.prisma`

### Website

- `APP&WEB/website-v2.9/src/app/api/auth/[...zis]/route.ts`
- `APP&WEB/website-v2.9/src/app/api/session/[[...path]]/route.ts` (new)
- `APP&WEB/website-v2.9/src/app/api/keys/[[...path]]/route.ts` (new)
- `APP&WEB/website-v2.9/src/lib/zis-proxy.ts` (new)
- `APP&WEB/website-v2.9/src/lib/zis.ts`
- `APP&WEB/website-v2.9/src/contexts/AuthContext.tsx`
- `APP&WEB/website-v2.9/src/components/dashboard/SecurityPanel.tsx` (new)
- `APP&WEB/website-v2.9/src/app/account/page.tsx`
- `APP&WEB/website-v2.9/src/app/login/page.tsx`
- `APP&WEB/website-v2.9/src/components/LoginModal.tsx`
- `APP&WEB/website-v2.9/src/proxy.ts`
- `APP&WEB/website-v2.9/.gitignore`
- `APP&WEB/website-v2.9/AGENTS.md`
- `APP&WEB/website-v2.9/deploy/deploy-web2.9.sh`

---

## 10. Known issues & follow-up

- `CrossChainSwapWidget.tsx` has a pre-existing TypeScript error (`Cannot find name 'setQuote'`). The build skips TS validation (`ignoreBuildErrors: true` in `next.config.ts`), so it does not block deploy.
- `V31/L1/core/src/genesis.rs` has an uncommitted local change from earlier work that is still untracked.
- The `proxy.ts` middleware currently protects only `/account` and `/dashboard/private`. If more private pages are added (e.g. `/wallet` management, `/defi/portfolio`), add them to `PROTECTED_PATHS` and `config.matcher`.
- `NavAuthButton` does not pass `redirectTo` to `LoginModal`; when opened from a public page the user stays on the same page after login. This is acceptable but can be improved to redirect back to the page that triggered the login.

---

## 11. References

- `APP&WEB/website-v2.9/AGENTS.md` — build and deploy commands.
- Previous conversation summary: `/Users/yeshuae/.local/share/devin/cli/summaries/history_ad75392d74b741f8.md`
