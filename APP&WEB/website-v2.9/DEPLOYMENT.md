# ZION Web v3.x — Deployment Guide

> Last verified production deploy: 10 July 2026 (v3.0.5 E2E — pool/explorer/network update)

## Current Production Status

> **2026-07-31 update:** ZION public web runs as a **quartet of separate services**:
> 1. `https://zionterranova.com` — OASIS intro landing page (static `maintenance.html` in `/var/www/maintenance/`).
> 2. `https://app.zionterranova.com` — full Next.js web2.9 (systemd `zion-website.service` on `127.0.0.1:3000`, nginx proxy).
> 3. `https://oasis.zionterranova.com` — separate visual OASIS web (build in `/var/www/oasis/`).
> 4. `https://www.newearth.cz` — legacy V2 archive; root redirects to `https://zionterranova.com/`, `/V2/` is served from `/var/www/newearth/` (added 2026-08-03).

- **Host:** New Edge server `62.171.141.136` (decommissioned: `77.42.71.94`)
- **SSH:** `ssh zion-post-wipe` (key: `~/.ssh/zion-edge-post-wipe-2026-07-29`)
- **Intro source:** `APP&WEB/website-v2.9/public/maintenance.html`
- **Web2.9 source on server:** `/opt/zion/APP&WEB/website-v2.9/`
- **Web2.9 service:** `zion-website.service` → `127.0.0.1:3000`
- **Reverse proxy:** system `nginx` (`/etc/nginx/sites-enabled/zion.conf` / `zion-edge-download.conf` / `oasis.zionterranova.com.conf` / `newearth.cz.conf`)
- **Live topology:** 3-node P2P mesh — Edge 1 (primary + pool), Edge 2 (follower), Local Backup (Prague via SSH tunnel)

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

## OASIS Intro Landing Page (current public page)

The file `public/maintenance.html` is the canonical one-page intro for the ZION multichain ecosystem and the Stargate portal to OASIS. It is served directly by the Edge nginx as `https://zionterranova.com`.

### Deploy OASIS Web

```bash
cd APP\&WEB/OasisWeb
bash deploy/deploy-oasis-web.sh
```

This builds the static Next.js export and rsyncs it to `/var/www/oasis/` on the Edge server, then reloads nginx.

### Deploy Web2.9 (Next.js)

```bash
cd APP\&WEB/website-v2.9
bash deploy/deploy-web2.9.sh
```

This builds locally with `npm run build` (using `--webpack`), rsyncs the result to `/opt/zion/APP&WEB/website-v2.9/` on the Edge server (excluding `node_modules` and local env files), fixes ownership to the `zion` user, and restarts `zion-website.service`. The service runs `next start` on `127.0.0.1:3000`; nginx for `app.zionterranova.com` proxies to it.

### Deploy the OASIS intro

```bash
cd APP\&WEB/website-v2.9
bash deploy/deploy-oasis-intro.sh
```

This rsyncs `public/maintenance.html` and `public/stargate/` to `/var/www/maintenance/` on the Edge server, validates nginx, and reloads.

### All public services run together

No need to switch nginx between intro and web2.9. They use different domains:

- `https://zionterranova.com` → `root /var/www/maintenance;` (OASIS intro)
- `https://app.zionterranova.com` → `proxy_pass http://127.0.0.1:3000;` (Next.js web2.9)
- `https://oasis.zionterranova.com` → `root /var/www/oasis;` (OASIS web)
- `https://www.newearth.cz` → `root /var/www/newearth;` with root `/` returning `301 https://zionterranova.com/` and `/V2/` served directly (legacy archive)

To take web2.9 offline, stop the service:

```bash
ssh zion-post-wipe 'systemctl stop zion-website.service'
```

To bring it back:

```bash
bash deploy/deploy-web2.9.sh
```

---

## Deploy scripts

### Summary

| Service | Domain | Deploy script |
|---------|--------|---------------|
| OASIS intro | `https://zionterranova.com` | `deploy/deploy-oasis-intro.sh` |
| Web2.9 | `https://app.zionterranova.com` | `deploy/deploy-web2.9.sh` |
| Legacy newearth archive | `https://www.newearth.cz` | `APP&WEB/public_html/deploy/deploy-newearth.sh` |
| OASIS Web | `https://oasis.zionterranova.com` | `APP&WEB/OasisWeb/deploy/deploy-oasis-web.sh` |

### `deploy-web2.9.sh`

Builds locally (`npm run build` with `--webpack`), rsyncs source + `.next` to `/opt/zion/APP&WEB/website-v2.9/`, fixes ownership for the `zion` user, and restarts `zion-website.service`.

```bash
cd APP\&WEB/website-v2.9
bash deploy/deploy-web2.9.sh
```

### `deploy-oasis-intro.sh`

Rsyncs `public/maintenance.html` + `public/stargate/` to `/var/www/maintenance/`, validates nginx, and reloads.

```bash
cd APP\&WEB/website-v2.9
bash deploy/deploy-oasis-intro.sh
```

### `deploy-oasis-web.sh`

Builds `APP&WEB/OasisWeb` as a static Next.js export and rsyncs `dist/` to `/var/www/oasis/`, then reloads nginx.

```bash
cd APP\&WEB/OasisWeb
bash deploy/deploy-oasis-web.sh
```

### `deploy-newearth.sh`

Deploys `APP&WEB/public_html` (legacy V2 web archive) to `/var/www/newearth/` on Edge, installs `nginx-newearth.conf`, obtains/renews Let's Encrypt certificate for `newearth.cz` + `www.newearth.cz`, and reloads nginx. Root `/` redirects to `https://zionterranova.com/`; `/V2/` paths are served directly.

```bash
cd APP\&WEB/public_html
bash deploy/deploy-newearth.sh
```

## Verification

```bash
# Intro page
curl -I https://zionterranova.com/

# Web2.9
curl -I https://app.zionterranova.com/
curl -s https://app.zionterranova.com/api/health | jq

# OASIS Web
curl -I https://oasis.zionterranova.com/

# newearth archive
curl -I https://www.newearth.cz/
curl -I https://www.newearth.cz/V2/main.html

# Service status on server
ssh zion-post-wipe 'systemctl status zion-website.service --no-pager'
```

## Connecting to Edge Server

```bash
ssh zion-post-wipe   # configured in ~/.ssh/config with IdentityFile ~/.ssh/zion-edge-post-wipe-2026-07-29
# or explicitly:
ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@62.171.141.136
```

## Deployment History

| Date | Version | Changes |
|---|---|---|
| 2026-07-10 | v3.0.5-pool-fix | Fixed pool routing metrics `/api/v1/miner/:address/stats` to resolve by payout address and aggregate PPLNS balances/shares/payouts; updated `/api/miner/[address]` to use real miner data and compute active state |
| 2026-07-10 | v3.0.5-miner-ui | Added amber inactive-miner state and pending-balance banner to MinerDashboard and MinerStatsClient; corrected Czech diacritics across miner stats UI |
| 2026-07-10 | v3.0.5-e2e-fix | Added canonical redirects for Explorer detail pages (`/explorer/tx/:hash`, `/explorer/address/:addr`, `/explorer/block/:id`); hardened pool miner search and `/miner-stats` query-param handling; full CZ/EN language correction across UI and docs |
| 2026-07-10 | v3.0.5-e2e | Pool, Explorer, Network pages updated to v3.0.5 E2E All Green; 3-node P2P mesh (Edge 1, Edge 2, Local Backup) added to network config/map; E2E memo block 752, F4.7/F5, 11/11 services surfaced |
| 2026-07-10 | v3.0.5-hotfix | Mobile stargate sizing, nav + footer cleanup, lazy HolographicEarth/StargateLogo, smaller homepage HTML/JS bundle |
| 2026-07-10 | v3.0.5 | Rasta navigation redesign, `.zion-page` layout system, fast runtime deploy |
| 2026-06-27 | v3.7.5-quantum-revolution | New /quantum-revolution page + gold StoryTriptych card |
| 2026-06-27 | v3.7.4-doge-fix | Fix Doge ATH timeline (7.5 years, not 2) |
| 2026-06-27 | v3.7.3-rainbow-theme | ZION rainbow-card theme across all 53 pages |
| 2026-06-26 | v3.7.2-doge-price-fork | Doge vs ZION $0.0002 seed price + 3.0.3 fork news |
| 2026-07-31 | v3.0.7-oasis-intro | OASIS intro landing page (glass/rainbow, Stargate to oasis.zionterranova.com) deployed as the public face of zionterranova.com; full Next.js web2.9 built and ready but offline |

---

**Version:** v3.0.7  
**Last updated:** 31 July 2026  
**Status:** OASIS intro landing page active; full Next.js v2.9.6 built and ready on 62.171.141.136
