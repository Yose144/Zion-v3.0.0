# ZION Web v3.x — Deployment Guide

> Last verified production deploy: 10 July 2026 (performance + mobile hotfix)

## Current Production Status

- **Live URL:** https://zionterranova.com
- **Host:** New Edge server `62.171.141.136` (decommissioned: `77.42.71.94`)
- **SSH:** `ssh zion-new` (key: `~/.ssh/zion-new-server`)
- **Runtime:** Docker container `zion-web-next` (host network mode, port 3000)
- **Reverse proxy:** Caddy → `localhost:3000`
- **Runtime source on server:** `/root/zion-web-runtime`
- **Current image:** `zion-web:runtime`

## Build Requirements

> **CRITICAL:** Next.js 16 defaults to Turbopack, which cannot resolve the local `zion-wallet-sdk` `.tgz` dependency. **Always use `--webpack` flag** for production builds:

```bash
npm run build   # package.json already adds --webpack
# or explicitly:
npx next build --webpack
```

`next.config.ts` uses `output: "standalone"`, which produces:
- `.next/standalone/` — complete runtime (server.js + node_modules)
- `.next/static/` — static assets
- `public/` — public assets

The project is therefore deployed by **building locally**, syncing the standalone output to the server, and running a tiny **runtime-only** Docker image.

## Deployment Steps

### Method 1: Fast runtime deploy (recommended)

Build locally, then ship only the pre-built standalone output. The server-side Docker build is now only a few COPY layers and takes ~10–15 seconds.

```bash
# 1. Build locally (this is the slow part; run on dev machine)
cd APP\&WEB/website-v2.9
npm run build

# 2. Sync standalone output + public assets to server
rsync -avz --delete -e "ssh -i ~/.ssh/zion-new-server" \
  .next/standalone .next/static public Dockerfile.runtime \
  root@62.171.141.136:/root/zion-web-runtime/

# 3. On server: stop old container, build tiny runtime image, restart
ssh -i ~/.ssh/zion-new-server root@62.171.141.136 <<'REMOTECMD'
cd /root/zion-web-runtime
docker stop zion-web-next || true
docker rm zion-web-next || true
DOCKER_BUILDKIT=1 docker build -f Dockerfile.runtime -t zion-web:runtime .
docker run -d --network host --name zion-web-next zion-web:runtime
REMOTECMD

# 4. Verify
sleep 2
curl -s https://zionterranova.com/api/health | jq
```

### Method 2: One-liner (local + remote)

```bash
ssh -i ~/.ssh/zion-new-server root@62.171.141.136 "rm -rf /root/zion-web-runtime && mkdir -p /root/zion-web-runtime" && \
rsync -avz --delete -e "ssh -i ~/.ssh/zion-new-server" \
  .next/standalone .next/static public Dockerfile.runtime \
  root@62.171.141.136:/root/zion-web-runtime/ && \
ssh -i ~/.ssh/zion-new-server root@62.171.141.136 \
  "cd /root/zion-web-runtime && docker stop zion-web-next || true && docker rm zion-web-next || true && \
   DOCKER_BUILDKIT=1 docker build -f Dockerfile.runtime -t zion-web:runtime . && \
   docker run -d --network host --name zion-web-next zion-web:runtime"
```

### Runtime Dockerfile

`Dockerfile.runtime` (committed in repo):

```dockerfile
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
COPY standalone ./
COPY static ./.next/static
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> **Why this is fast:** no `npm install`, no `next build`, no source copy. The heavy build runs once on the dev machine; the server only copies pre-built artifacts into a Node image.

## Verification

```bash
# Health check (from anywhere)
curl -s https://zionterranova.com/api/health | jq

# Container status (on server)
ssh -i ~/.ssh/zion-new-server root@62.171.141.136 \
  "docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep zion-web-next"

# Public URL
curl -I https://zionterranova.com/

# Specific pages
curl -s https://zionterranova.com/ | head -5
curl -s https://zionterranova.com/zohar | head -5
```

## Rollback

The previous image is overwritten on every deploy. To keep a rollback image, tag it before deploying:

```bash
ssh -i ~/.ssh/zion-new-server root@62.171.141.136 \
  "docker tag zion-web:runtime zion-web:runtime-backup-$(date +%Y%m%d-%H%M)"
```

Or simply re-run the deploy with the previous git commit checked out locally.

## Dockerfiles

| File | Purpose |
|---|---|
| `Dockerfile` | Legacy multi-stage build — installs deps and builds inside Docker. **Slow on server.** |
| `Dockerfile.runtime` | **Current** — runtime-only, copies locally built `.next/standalone`, `.next/static`, and `public`. |

Use `Dockerfile` only if you must build on the server (not recommended). `Dockerfile.runtime` is the production path.

## Connecting to Edge Server

```bash
ssh zion-new   # configured in ~/.ssh/config with IdentityFile ~/.ssh/zion-new-server
# or explicitly:
ssh -i ~/.ssh/zion-new-server root@62.171.141.136
```

## Deployment History

| Date | Version | Changes |
|---|---|---|
| 2026-07-10 | v3.0.5-hotfix | Mobile stargate sizing, nav + footer cleanup, lazy HolographicEarth/StargateLogo, smaller homepage HTML/JS bundle |
| 2026-07-10 | v3.0.5 | Rasta navigation redesign, `.zion-page` layout system, fast runtime deploy |
| 2026-06-27 | v3.7.5-quantum-revolution | New /quantum-revolution page + gold StoryTriptych card |
| 2026-06-27 | v3.7.4-doge-fix | Fix Doge ATH timeline (7.5 years, not 2) |
| 2026-06-27 | v3.7.3-rainbow-theme | ZION rainbow-card theme across all 53 pages |
| 2026-06-26 | v3.7.2-doge-price-fork | Doge vs ZION $0.0002 seed price + 3.0.3 fork news |

---

**Version:** v3.0.5  
**Last updated:** 10 July 2026  
**Status:** ✅ Deployed and verified on 62.171.141.136
