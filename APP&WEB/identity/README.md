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

Both methods issue a signed JWT stored in an httpOnly cookie scoped to `.zionterranova.com`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/health/ready` | Readiness (DB check) |
| `GET` | `/.well-known/zion-identity` | Service metadata |
| `GET` | `/.well-known/jwks.json` | JWT verification keys |
| `POST` | `/api/auth/challenge` | Request auth challenge |
| `POST` | `/api/auth/verify/ed25519` | Verify Ed25519 signature |
| `POST` | `/api/auth/verify/siwe` | Verify SIWE message |
| `GET` | `/api/auth/me` | Current user (requires auth) |
| `POST` | `/api/auth/logout` | Revoke current session |
| `GET` | `/api/session` | List active sessions |
| `DELETE` | `/api/session/:jti` | Revoke a session |
| `POST` | `/api/session/revoke-all` | Revoke all sessions |
| `POST` | `/api/keys` | Create API key |
| `GET` | `/api/keys` | List API keys |
| `DELETE` | `/api/keys/:id` | Revoke API key |

## Setup

```bash
cd APP&WEB/identity
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
| `JWT_SECRET` | `change-me` | HMAC secret for JWT signing |
| `COOKIE_DOMAIN` | `.zionterranova.com` | SSO cookie scope |
| `LOG_LEVEL` | `info` | Pino log level |

## Shared schema

ZIS uses the unified Prisma schema at [`../shared/prisma/schema.prisma`](../shared/prisma/schema.prisma) — the same PostgreSQL instance backs all ZION apps.
