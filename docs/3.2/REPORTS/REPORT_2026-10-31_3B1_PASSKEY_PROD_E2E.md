# 3.B1 — Passkey production E2E (real ZIS, no mocks) — PASS

**Date:** 2026-10-31 · **Evidence for:** V33-4 / Registr důkazů
**Suite:** `apps/website-v2.9/e2e/passkey-prod.spec.ts` — Playwright + CDP
virtual authenticator (resident keys, UV), **zero mocked routes** — every
call hits production ZIS through each site's own `/api/auth/*` proxy.

## What ran (24.7 s, 1 test, chromium)

Fresh disposable ZIS user per run (mnemonic → ed25519
challenge-response → `zion_session`; no shared secret, nothing
funds-adjacent).

| Step | Origin | Result |
|---|---|---|
| `register/options` → `credentials.create` → `register/verify` | `app.zionterranova.com` | ✅ credential stored, `{credentialId}` returned |
| `login/options` → `credentials.get` → `login/verify` | app | ✅ session issued; `GET /api/auth/me` = test user |
| `login/options` → `credentials.get` → `login/verify` | `market.zionterranova.com` | ✅ **same passkey** — cross-origin RP |
| `login/options` → `credentials.get` → `login/verify` | `freeworld.zionterranova.com` | ✅ **same passkey** |
| recovery: `DELETE /credentials/:id` → re-register → re-login | app | ✅ full recovery cycle |
| cleanup | app | ✅ all test credentials deleted |

**Cross-origin proof:** one CDP virtual authenticator holds the resident
credential across `page.goto` navigations between subdomains — the same
passkey authenticated on all three origins (rpId `zionterranova.com`,
origins verified server-side against `WEBAUTHN_ORIGINS`/CORS list).

## How to reproduce

```bash
cd apps/website-v2.9
npx playwright test e2e/passkey-prod.spec.ts   # 1 test, ~25s, PASS
```

## Notes / residual

- UI-level (button-driven) flow on `/account` SecurityPanel is covered
  by the mocked `passkey.spec.ts`; this prod suite drives the real API
  surface directly (`navigator.credentials.*` inside live pages) — the
  browser+authenticator+ZIS round trip is genuine.
- Test users are real rows in prod ZIS (disposable; `passkey_*` audit
  events mark them). Credential rows are cleaned up in-suite.
- `WEBAUTHN_ORIGINS` covers app/market/freeworld/dashboard/oasis/pool —
  dashboard+oasis+pool origins can be added to the matrix later if
  needed (same mechanism).
