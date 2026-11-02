# ⚠️ DEPRECATED — Legacy V3 Edge Deploy

This directory (`infra/edge-deploy/`) contains the **legacy V3** edge deployment
infrastructure, which has been **deprecated since 2026-08-04** when V3 was
archived to `archive/V3/`.

## Active deploy

Use **`V31/deploy/`** instead:
- `V31/deploy/deploy-edge.sh` — active V31 Mainnet Alpha deploy script
- `V31/deploy/systemd/` — 29 V31 systemd units
- `V31/deploy/config/edge-environment.sh` — V31 env template

## What's here (legacy)

- `deploy-edge.sh` — V3 deploy script (guarded by `ALLOW_LEGACY_EDGE_DEPLOY=1`)
- `systemd/` — 20 V3 systemd units (zon-edge-*)
- `config/edge-environment.sh` — V3 env template
- `nginx/` (in `infra/nginx/edge-current/`) — V3 ops/legacy vhosty

## Do NOT

- Do NOT run `deploy-edge.sh` without `ALLOW_LEGACY_EDGE_DEPLOY=1`
- Do NOT modify these files for V31 work
- Do NOT install V3 units on the active Edge server (conflicts with V31 units)

## Migration status

V3 → V31 cutover completed 2026-08-04. V3 units are disabled on the live server
(see `V31/deploy/deploy-edge.sh` Step 7 cleanup loop). This directory is kept
for historical reference only.