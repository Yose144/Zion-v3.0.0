#!/usr/bin/env bash
# ZION MarketPlace deploy — Next.js standalone to market.zionterranova.com
#
# Builds locally, rsyncs to /opt/zion/APP&WEB/MarketPlace on EDGE2 (web ingress
# after the 2026-10-22 cutover), fixes ownership, restarts zion-marketplace
# and runs a smoke check.
#
# Prisma note: `npx prisma generate` runs BEFORE `next build` so the generated
# client + debian-openssl-3.0.x engine (binaryTargets in prisma/schema.prisma)
# get traced into .next/standalone — the remote needs no npm install.
#
# Invoice PDF prerequisite (server, one-time — done on EDGE2 2026-10-27):
#   sudo -u zion HOME=/home/zion npx --prefix .next/standalone puppeteer browsers install chrome
#   apt-get install libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 \
#     libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
#     libasound2t64 libpango-1.0-0 libcairo2 libnss3 libnspr4 libx11-xcb1 libxcb-dri3-0
# Without Chrome in ~zion/.cache/puppeteer, /api/invoice/[id]/download?format=pdf → 500.
#
# Usage:
#   bash apps/MarketPlace/deploy/deploy-marketplace.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-edge2}"
EDGE_USER="${ZION_EDGE_USER:-root}"
SSH_KEY="${ZION_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
SSH_EXTRA="${ZION_SSH_OPTS:-}"
REMOTE_DIR="/opt/zion/APP&WEB/MarketPlace"
SERVICE="zion-marketplace.service"

SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new ${SSH_EXTRA}"
SSH() { ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "$@"; }

echo "[deploy-marketplace] Installing deps + generating Prisma client..."
# K1.2: root workspace — jeden lockfile a jeden node_modules v rootu repa.
# `npm ci` uvnitř appky by vytvořil druhý strom a rozbil workspace.
cd "$ROOT_DIR"
# --ignore-scripts: postinstall `db:generate -w zion-marketplace` běží dřív,
# než je .bin/prisma na místě → ENOENT/127 (2026-11-02). Client se generuje
# explicitně na dalším řádku.
(cd ../.. && npm ci --ignore-scripts)
npm run db:generate

echo "[deploy-marketplace] Building (standalone)..."
# Local .env pins NEXT_PUBLIC_SITE_URL to localhost for dev. Next inlines that
# into the server bundle, so a production build must override it or Stripe
# success/cancel URLs send the customer back to the builder's machine.
NEXT_PUBLIC_SITE_URL=https://market.zionterranova.com npm run build

if [[ ! -f "${ROOT_DIR}/.next/standalone/server.js" ]]; then
  echo "[deploy-marketplace] ERROR: .next/standalone/server.js missing" >&2
  exit 1
fi
if [[ ! -d "${ROOT_DIR}/.next/standalone/node_modules/.prisma" ]]; then
  echo "[deploy-marketplace] ERROR: standalone is missing .prisma client (did 'npx prisma generate' run before build?)" >&2
  exit 1
fi

# Standalone server si static ani public nekopíruje sám — když postbuild tiše
# selže (build bez npm lifecycle, flatten exit 1), rsync --delete smaže i
# poslední funkční kopii na serveru a celý web jede bez CSS/JS (2026-11-01:
# všechny /_next/static/* → 404, stránky „rozbité"). Pojistka: dokopírovat
# zdroje tady, fail když zdroj chybí.
if [[ ! -d "${ROOT_DIR}/.next/standalone/.next/static" ]]; then
  echo "[deploy-marketplace] WARN: standalone/.next/static chybí — dokopírovávám z .next/static"
  [[ -d "${ROOT_DIR}/.next/static" ]] || { echo "[deploy-marketplace] ERROR: .next/static neexistuje — build je rozbitý" >&2; exit 1; }
  cp -a "${ROOT_DIR}/.next/static" "${ROOT_DIR}/.next/standalone/.next/static"
fi
if [[ ! -d "${ROOT_DIR}/.next/standalone/public" ]]; then
  echo "[deploy-marketplace] WARN: standalone/public chybí — dokopírovávám z public/"
  mkdir -p "${ROOT_DIR}/.next/standalone/public"
  cp -rL "${ROOT_DIR}/public/." "${ROOT_DIR}/.next/standalone/public/"
fi

# Remote pre-flight: refuse to --delete into a directory that does not look
# like the MarketPlace app root (guards against wrong REMOTE_DIR / empty dirs).
if ! SSH "test -f '${REMOTE_DIR}/package.json'"; then
  echo "[deploy-marketplace] ERROR: ${REMOTE_DIR}/package.json missing on ${EDGE_HOST} — refusing rsync --delete" >&2
  exit 1
fi

# Digital downloads guard: public/shop/downloads/ je v .gitignore (65 MB ZIP
# s celou ediční sadou Království srdce). Kdyby se deploy spustil z klonu bez
# tohoto adresáře, rsync --delete ho na serveru smaže a zákazník, který už
# produkt koupil, dostane v e-mailu mrtvý odkaz. Proto radši zastavit.
DOWNLOADS_DIR="${ROOT_DIR}/public/shop/downloads"
if [[ ! -d "${DOWNLOADS_DIR}" ]]; then
  echo "[deploy-marketplace] ERROR: ${DOWNLOADS_DIR} chybí." >&2
  echo "[deploy-marketplace] Sestav ho: python3 scripts/ops/build-kralovstvi-bundle.py" >&2
  echo "[deploy-marketplace] (nebo nasazuj s ZION_SKIP_DOWNLOADS_CHECK=1, pokud je oblika záměrně mimo)" >&2
  [[ "${ZION_SKIP_DOWNLOADS_CHECK:-0}" == "1" ]] || exit 1
fi

# Safety net: snapshot remote .env before sync (excludes keep it untouched and
# undeleted — this is only insurance against operator-side edits).
SSH "cp -a '${REMOTE_DIR}/.env' '${REMOTE_DIR}/.env.pre-deploy-\$(date +%Y%m%d-%H%M%S)' 2>/dev/null || true"

echo "[deploy-marketplace] Syncing to ${EDGE_HOST}:${REMOTE_DIR}"
# NOTE: source is the WHOLE app dir — the unit ExecStart expects the standalone
# runtime at .next/standalone/server.js inside the source tree. NEVER rsync
# .next/standalone/ directly into REMOTE_DIR: it deletes src/, scripts/,
# prisma/ AND ships the traced dev .env over the production one (2026-10-30).
#
# `--exclude='/node_modules'` je ZÁMĚRNĚ kotvené na kořen appky. Bez kotvy
# vzor matchuje i vnořené cesty, takže se nepřenese:
#   .next/standalone/node_modules            (runtime deps bundlu)
#   .next/standalone/.next/node_modules      (Turbopack aliasy, např. symlink
#                                             @prisma/client-<hash> → @prisma/client)
# Následek je tichý: na serveru zůstane stará generace Next a běží mix
# (2026-11-01: next 14 runtime + next 16 manifesty → pád na `canonicalBase`),
# resp. `Cannot find module '@prisma/client-<hash>'`.
rsync -avz --delete \
  --exclude='/node_modules' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.l1-watcher-state.json' \
  --exclude='.next/cache' \
  --exclude='.next/trace' \
  -e "ssh ${SSH_OPTS}" \
  "${ROOT_DIR}/" \
  "${EDGE_USER}@${EDGE_HOST}:${REMOTE_DIR}/"

echo "[deploy-marketplace] Verifying bundled Next matches the local build"
LOCAL_NEXT="$(node -p "require('${ROOT_DIR}/.next/standalone/node_modules/next/package.json').version" 2>/dev/null || echo missing)"
REMOTE_NEXT="$(SSH "node -p \"require('${REMOTE_DIR}/.next/standalone/node_modules/next/package.json').version\"" 2>/dev/null | tr -d '\r' || echo missing)"
if [[ "${LOCAL_NEXT}" != "${REMOTE_NEXT}" ]]; then
  echo "[deploy-marketplace] ERROR: bundled Next mismatch (local=${LOCAL_NEXT} remote=${REMOTE_NEXT})." >&2
  echo "[deploy-marketplace] Refusing to restart — prod keeps running the previous build in memory." >&2
  exit 1
fi
echo "[deploy-marketplace] Bundled Next ${LOCAL_NEXT} OK"

echo "[deploy-marketplace] Regenerating Prisma client on ${EDGE_HOST}"
# Regenerace na serveru: engine se musí sestavit pro platformu serveru
# (binaryTargets v prisma/schema.prisma) a node_modules/@prisma/client je
# v rsyncu záměrně vynechaný.
SSH "cd '${REMOTE_DIR}' && npx prisma generate >/dev/null 2>&1 && \
  mkdir -p .next/standalone/node_modules/.prisma/client && \
  cp -a node_modules/.prisma/client/. .next/standalone/node_modules/.prisma/client/"

echo "[deploy-marketplace] Relativizing absolute symlinks in the bundle"
# Turbopack zapisuje alias externích modulů jako symlink. Když build běží v git
# worktree (ne v hlavním stromu), resolved realpath je **absolutní** a míří na
# builderův /tmp — na serveru pak `Cannot find module '@prisma/client-<hash>'`
# nebo `puppeteer-<hash>` a spadnou VŠECHNY API routy (stránky dál servíruje
# staticky, takže se to snadno přehlédne).
#
# Cesty se do vzdáleného skriptu vkládají přes placeholder, protože REMOTE_DIR
# obsahuje `&` a argument by se v remote shellu rozpadl.
REMOTE_SCRIPT=$(cat <<'EOS'
set -eu
cd '@REMOTE@'
remote=$(pwd); app=$(basename "$remote"); builder='@BUILDER@'
# Builder cesta obsahuje i podadresář appky:
#   <builder>/apps/<app>/.next/standalone/...  ->  <remote>/.next/standalone/...
prefix="$builder/apps/$app"
fixed=0
for link in $(find .next/standalone -type l); do
  target=$(readlink "$link")
  # `case`+`;;` uvnitř heredocu v $( ) nedokáže sparsovat bash 3.2 (macOS) —
  # proto prefix-match přes [[ = glob ]] místo case.
  if [[ "$target" != "$prefix"* ]]; then
    continue
  fi
  rest=${target#"$prefix"}
  resolved="$remote$rest"
  if [ -e "$resolved" ]; then
    rel=$(realpath --relative-to="$(dirname "$link")" "$resolved")
    ln -sfn "$rel" "$link"
    fixed=$((fixed + 1))
  else
    echo "  CHYBA: cíl $rest v bundlu není" >&2
  fi
done
echo "  přepsáno absolutních odkazů: $fixed"
dangling=0
for link in $(find .next/standalone -type l); do
  [ -e "$link" ] || { echo "  CHYBA: visící symlink $link -> $(readlink "$link")" >&2; dangling=$((dangling + 1)); }
done
if [ "$dangling" -gt 0 ]; then
  echo "  $dangling visících symlinků — nerestartuji, API by spadly" >&2
  exit 1
fi
EOS
)
# bash 5.2+ žere `&` v náhradě (patsub_replacement) a REMOTE_DIR obsahuje `&`.
shopt -u patsub_replacement 2>/dev/null || true
# ROOT_DIR je v tomhle skriptu adresář appky; builder cesty v symlinkách míří
# z kořene workspace (root package.json je o dvě úrovně výš).
REPO_ROOT="$(cd "${ROOT_DIR}/../.." && pwd)"
REMOTE_SCRIPT="${REMOTE_SCRIPT//@REMOTE@/${REMOTE_DIR}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//@BUILDER@/${REPO_ROOT}}"
SSH bash -s <<<"${REMOTE_SCRIPT}"

echo "[deploy-marketplace] Fixing ownership and restarting ${SERVICE} + zion-l1-watcher"
SSH "chown -R zion:zion '${REMOTE_DIR}' && systemctl daemon-reload && systemctl restart ${SERVICE} zion-l1-watcher.service"

echo "[deploy-marketplace] Smoke check..."
sleep 3
local_code=$(SSH "curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3100/" || echo 000)
live_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 'https://market.zionterranova.com/')
# 200 na / nestačí — HTML se servíruje i bez static bundlu. Vytáhni z něj
# skutečný /_next/static/* asset a ověř, že se servíruje (2026-11-01 incident).
asset_path=$(curl -s --max-time 15 'https://market.zionterranova.com/' | grep -o '/_next/static/[^"]*' | head -1 || true)
if [[ -n "$asset_path" ]]; then
  asset_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://market.zionterranova.com${asset_path}")
else
  asset_code=000
fi
if [[ "$local_code" == "200" && "$live_code" == "200" && "$asset_code" == "200" ]]; then
  echo "[deploy-marketplace] OK — local :3100=$local_code, live=$live_code, static=$asset_code ($asset_path). Deploy verified."
else
  echo "[deploy-marketplace] FAIL — local :3100=$local_code, live=$live_code, static=$asset_code ($asset_path) (want 200/200/200)" >&2
  SSH "systemctl status ${SERVICE} --no-pager -l | tail -15" || true
  exit 1
fi
