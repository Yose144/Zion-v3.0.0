# ZIS — ZION Identity Service

`auth.zionterranova.com` — unified authentication for the ZION ecosystem.

## Overview

ZIS provides single sign-on (SSO) across all `*.zionterranova.com` applications:

| App | Domain | Auth via |
|-----|--------|----------|
| Web 2.9 | `app.zionterranova.com` | ZIS cookie |
| Market | `market.zionterranova.com` | ZIS cookie + API key |
| OASIS | `oasis.zionterranova.com` | ZIS cookie |
| Dashboard | `dashboard.zionterranova.com` | ZIS cookie |

## Auth methods

1. **Ed25519 (ZION L1 native)** — `POST /api/auth/challenge` → sign with wallet → `POST /api/auth/verify/ed25519`
2. **SIWE (Sign-In with Ethereum)** — `POST /api/auth/challenge` → sign SIWE message → `POST /api/auth/verify/siwe`
3. **Google OIDC** — `POST /api/auth/verify/google` with an ID token
4. **WebAuthn / passkeys** — `POST /api/auth/webauthn/login/options` → `login/verify`
5. **Dispatcher** — `POST /api/auth/verify` routes by `{method: "ed25519"|"siwe"|"google"}`

All methods issue a signed JWT (EdDSA in production) stored in an httpOnly
cookie scoped to `.zionterranova.com`. Linked addresses can also authenticate:
an address bound to an account always signs in as that account ("owner wins").

## Endpoints

### Meta

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/health/live` | Liveness (alias) |
| `GET` | `/health/ready` | Readiness (DB check) |
| `GET` | `/.well-known/zion-identity` | Service metadata |
| `GET` | `/.well-known/jwks.json` | Public JWKS (EdDSA mode) |
| `GET` | `/metrics` | Prometheus text exposition |

### Auth & account

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/challenge` | Request auth challenge (DB-backed, 5 min TTL) |
| `POST` | `/api/auth/verify` | Method dispatcher (`ed25519` / `siwe` / `google`) |
| `POST` | `/api/auth/verify/ed25519` | Verify Ed25519 signature |
| `POST` | `/api/auth/verify/siwe` | Verify SIWE message |
| `POST` | `/api/auth/verify/google` | Verify Google ID token |
| `GET` | `/api/auth/me` | Current user (requires auth) |
| `PATCH` | `/api/auth/me` | Update profile (email change clears `emailVerifiedAt`) |
| `DELETE` | `/api/auth/me` | Delete account (fresh proof-of-key or Google idToken) |
| `POST` | `/api/auth/logout` | Revoke current session, clear cookie |
| `POST` | `/api/auth/link` | Link an address (ed25519 / siwe / btc / solana / quantus / pearl / google) |
| `DELETE` | `/api/auth/link/:address` | Unlink a secondary address |
| `POST` | `/api/auth/primary` | Move the primary address |
| `POST` | `/api/auth/email/verify/request` | Send e-mail verification link |
| `GET` | `/api/auth/email/verify` | Consume verification token (mail link target) |

### Avatars

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/avatar/u/:userId` | Public avatar image |
| `POST` | `/api/auth/avatar/upload` | Upload avatar (≤256 KiB) |
| `DELETE` | `/api/auth/avatar/upload` | Remove uploaded avatar |
| `POST` | `/api/auth/avatar/nft` | Bind ERC-1155 NFT as avatar |

### WebAuthn / passkeys

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/webauthn/register/options` | Begin passkey registration |
| `POST` | `/api/auth/webauthn/register/verify` | Finish registration |
| `POST` | `/api/auth/webauthn/login/options` | Begin passkey login |
| `POST` | `/api/auth/webauthn/login/verify` | Finish login → session cookie |
| `GET` | `/api/auth/webauthn/credentials` | List own passkeys |
| `DELETE` | `/api/auth/webauthn/credentials/:id` | Delete a passkey |

### Sessions & API keys

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/session` | List active sessions |
| `DELETE` | `/api/session/:jti` | Revoke a session |
| `POST` | `/api/session/revoke-all` | Revoke all other sessions |
| `POST` | `/api/keys` | Create API key (raw value returned once) |
| `GET` | `/api/keys` | List API keys |
| `DELETE` | `/api/keys/:id` | Revoke API key |
| `POST` | `/api/keys/verify` | Verify a key (service-to-service) |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/notifications` | Push notification (`x-service-key` only) |
| `GET` | `/api/notifications` | List own notifications |
| `GET` | `/api/notifications/unread-count` | Unread count (badge poll) |
| `POST` | `/api/notifications/:id/read` | Mark one as read |
| `POST` | `/api/notifications/read-all` | Mark all as read |
| `DELETE` | `/api/notifications/:id` | Delete one |

### Wallet proxy (L2 multichain)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/wallet/me` | Wallet overview |
| `POST` | `/api/wallet/derive` | Derive deposit address |
| `GET` | `/api/wallet/balances` | Custodial balances |
| `POST` | `/api/wallet/swap` | Execute swap |
| `GET` | `/api/wallet/orders` | Order history |
| `POST` | `/api/wallet/withdraw` | Withdraw externally |
| `GET` | `/api/wallet/deposits` | Deposit history |
| `GET` | `/api/wallet/withdrawals` | Withdrawal history |
| `GET` | `/api/wallet/quote` | Swap quote (public) |

The proxy forwards the caller's credential to L2 (`L2_MULTICHAIN_URL`,
default `http://127.0.0.1:8454`): cookie sessions go as
`Cookie: zion_session=<signed value>`, Bearer callers as
`Authorization`. L2 resolves the cookie by introspection through
`/api/auth/me` — a raw JWT is *not* accepted there.

## Production topology

Two ZIS instances share one PostgreSQL database and one Ed25519 key:

- **edge** (vmi3425821) — public `auth.zionterranova.com` via nginx →
  `127.0.0.1:8096`
- **EDGE2** (vmi3684458) — local `127.0.0.1:8096` serving the EDGE2
  `warpd` multichain (`ZION_MULTICHAIN_ZIS_AUTH=1`,
  `ZIS_URL=http://127.0.0.1:8096`); no public vhost

The L2 `warpd` runs only on EDGE2 — the edge wallet proxy reaches it
through the SSH tunnel at `127.0.0.1:8454`. The systemd unit must run
`/usr/local/bin/node` (Node 22); `/usr/bin/node` is Node 18 and fails
on the Ed25519 PKCS8 key. Store `JWT_PRIVATE_KEY` base64-encoded in
the EnvironmentFile — literal `\n` escapes break `createPrivateKey`.

Deploy: `deploy/deploy-zis.sh` (build → sync → `prisma db push` +
`generate` → restart → health smoke).

### Admin (role `admin` or `x-service-key`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List/search users |
| `GET` | `/api/admin/users/:id` | User detail + audit events |
| `POST` | `/api/admin/users/:id/role` | Set role (last-admin demote refused) |
| `DELETE` | `/api/admin/users/:id` | Delete account (audited) |
| `GET` | `/api/admin/stats` | Headline numbers |
| `GET` | `/api/admin/events` | Audit log view |

## Setup

```bash
cd apps/identity
npm install
npm run db:generate   # generate Prisma client
npm run db:push       # create tables
npm run dev           # start dev server (port 8096)
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8096` | Listen port |
| `HOST` | `0.0.0.0` | Listen host |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_PRIVATE_KEY` | — | Ed25519 PEM (pkcs8) — enables EdDSA JWT signing + real JWKS |
| `JWT_PUBLIC_KEY` | derived | Ed25519 PEM (spki); defaults to pubkey derived from the private key |
| `JWT_KEY_ID` | derived | `kid` for JWK/JWT header (default: `zis-<hash>`) |
| `JWT_SECRET` | `change-me` | Legacy HS256 secret — used as fallback when no private key, and as legacy verifier in EdDSA mode |
| `JWT_LEGACY_SECRET` | `JWT_SECRET` | Retired HS256 secret accepted during the EdDSA migration grace period |
| `ZIS_SERVICE_KEY` | — | Shared secret for `x-service-key` service callers |
| `COOKIE_DOMAIN` | `.zionterranova.com` | SSO cookie scope |
| `GOOGLE_CLIENT_ID` | — | Google OIDC audience |
| `ZIS_PUBLIC_URL` | `https://auth.zionterranova.com` | Base URL for e-mail verification links |
| `ZIS_EMAIL_ENABLED` | `0` | Set `1` to enable e-mail verification flow |
| `EMAIL_FROM` | `ZIS <no-reply@zionterranova.com>` | Sender address |
| `SENDMAIL_PATH` | `/usr/sbin/sendmail` | Local sendmail binary (postfix on Edge) |
| `EMAIL_VERIFY_REDIRECT` | `https://app.zionterranova.com/account` | Post-verify redirect |
| `WEBAUTHN_RP_ID` | `zionterranova.com` | Passkey relying-party ID |
| `WEBAUTHN_RP_NAME` | `ZION` | Passkey relying-party name |
| `WEBAUTHN_ORIGINS` | ZION origin list | Allowed WebAuthn origins (comma-separated) |
| `LOG_LEVEL` | `info` | Pino log level |

## Shared schema

ZIS uses the unified Prisma schema at [`../shared/prisma/schema.prisma`](../shared/prisma/schema.prisma) — the same PostgreSQL instance backs all ZION apps.
