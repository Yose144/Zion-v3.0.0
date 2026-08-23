# G8 — 30-Day Continuous Run Started

> **Date:** 2026-08-23
> **Gate:** G8 — 30-day continuous run completed
> **Status:** 🔄 In progress

---

## 1. Summary

Gate G8 (30-day continuous run) was started on **2026-08-23 07:00 CET**. The target completion is **2026-09-22 07:00 CET**. A public status UI is live at `https://app.zionterranova.com/g8` and the underlying JSON API is at `https://app.zionterranova.com/api/g8`.

The run was started after fixing a 502 error on `https://app.zionterranova.com/dashboard`, which was caused by the `zion-website` (Next.js) service being stuck in the `deactivating` state and no longer listening on port 3000.

---

## 2. 502 Incident on `app.zionterranova.com/dashboard`

### 2.1 Symptom

`curl https://app.zionterranova.com/dashboard` returned **502 Bad Gateway**.

### 2.2 Root cause

The `zion-website.service` (Next.js standalone on `127.0.0.1:3000`) was stuck in `deactivating (stop-sigterm)` and no longer accepting connections. The service had a high restart counter (12) from earlier errors:

- `EACCES: permission denied, scandir '/opt/zion/APP&WEB/website-v2.9/.next/standalone/public'`
- `MODULE_NOT_FOUND: Cannot find module '../shared/lib/constants'` (Next.js internal file missing in standalone bundle)

A simple stop/start cleared the transient state and the service began responding again. The website has been returning 200 for `/dashboard` since the restart, but the underlying standalone deployment should be rebuilt/redeployed if the errors return.

### 2.3 Fix

- SSH to Edge (IPv6 `2a02:c207:2342:5821::1`, port 2222)
- `systemctl stop zion-website && systemctl start zion-website`
- Verified 5 consecutive 200 responses for `/dashboard`

---

## 3. G8 Public Status UI + Dashboard Integration

### 3.1 Dashboard integration (web2.9 Mission Control)

The G8 widget was integrated into the main web dashboard (`src/components/DashboardMain.tsx`):

- New `G8Run` interface and `G8RunCard` component.
- `DashboardMain` fetches `/api/g8` every 30 s via `usePolling`.
- `MissionControlLite` now renders `G8RunCard` below the 4 core metrics.
- Displays start/end, elapsed, remaining, status badge, and a cyan→purple progress bar.

Built locally with `npm run build` and deployed to Edge (`rsync .next` + restart `zion-website`).

### 3.2 Python ops dashboard

A G8 panel was added to `ZION_OS/dashboard/dashboard.html` directly after the **Mainnet Readiness** card. It auto-refreshes every 30 s from `/api/g8`.

### 3.3 nginx

- `/g8` and `/api/g8` remain proxied to the Python dashboard for the public fallback page.
- `/dashboard` redirect to `/g8` was **reverted** so `app.zionterranova.com/dashboard` serves the Next.js Mission Control again.

### 3.4 State file

`/opt/zion/data/g8_run.json` (Edge):

```json
{
  "started": "2026-08-23T07:00:00+02:00",
  "target_end": "2026-09-22T07:00:00+02:00",
  "status": "running",
  "uptime_percent": null,
  "critical_incidents": [],
  "started_by": "Devin session 2026-08-23"
}
```

---

## 4. Verification

| URL | Expected | Result |
|-----|----------|--------|
| `https://app.zionterranova.com/dashboard` | 200 (Next.js Mission Control with G8 widget) | ✅ 200 |
| `https://app.zionterranova.com/g8` | 200 HTML (public fallback) | ✅ 200 |
| `https://app.zionterranova.com/api/g8` | 200 JSON | ✅ 200 |
| `https://dashboard.zionterranova.com` (`/dashboard`) | 200 (Python ops dashboard with G8 panel) | ✅ 200 |
| `http://127.0.0.1:8766/g8` (dashboard) | 200 HTML | ✅ 200 |
| `http://127.0.0.1:8766/api/g8` (dashboard) | 200 JSON | ✅ 200 |

Sample `/api/g8` response:

```json
{
  "started": "2026-08-23T07:00:00+02:00",
  "target_end": "2026-09-22T07:00:00+02:00",
  "status": "running",
  "elapsed_seconds": 278,
  "remaining_seconds": 2591721,
  "progress_percent": 0.01073,
  "services": [ ... ]
}
```

---

## 5. Next steps for G8

- Monitor the public status page daily.
- Record any critical incidents in `/opt/zion/data/g8_run.json` under `critical_incidents`.
- If the 30-day run is interrupted by a critical incident, the clock resets per the roadmap risk mitigation rules.
- Keep the `zion-website` service under observation; rebuild/redeploy if `EACCES` / `MODULE_NOT_FOUND` recurs.
- When 30 days complete, evaluate uptime ≥99.9% and mark G8 ✅ Complete.

---

## 6. Files changed

- `ZION_OS/dashboard/app.py`
- `ZION_OS/dashboard/g8.html`
- `docs/3.2/ROADMAP.md`
- `V31/STATUS.md`
- `docs/3.2/REPORTS/REPORT_2026-08-23_G8_30DAY_CONTINUOUS_RUN_STARTED.md`

Edge-side changes (not in repo):

- `/etc/nginx/sites-enabled/zion-edge-download.conf`
- `/opt/zion/data/g8_run.json`
