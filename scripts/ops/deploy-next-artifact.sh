#!/usr/bin/env bash
# Stage a tested Next standalone app, then swap it with a recoverable backup.
set -euo pipefail
[[ $# -eq 6 ]] || { echo 'usage: deploy-next-artifact.sh ARTIFACT HOST TARGET SERVICE PORT SITE' >&2; exit 2; }
artifact="$1" host="$2" target="$3" service="$4" port="$5" site="$6"
case "$service" in zion-website.service|zion-nirvana.service) ;; *) echo 'unsupported service' >&2; exit 2;; esac
[[ -f "$artifact/server.js" && -f "$artifact/.next/BUILD_ID" && -d "$artifact/node_modules/next" && -d "$artifact/.next/static" ]] || { echo 'incomplete standalone artifact' >&2; exit 2; }
release="${ZION_DEPLOY_RELEASE:-$(date -u +%Y%m%dT%H%M%SZ)}"
[[ "$release" =~ ^[A-Za-z0-9._-]+$ && "$port" =~ ^[0-9]+$ ]] || exit 2
stage="${target}.stage-${release}" backup="${target}.before-${release}"
printf -v quoted_stage '%q' "$stage"
ssh "$host" "mkdir -p $quoted_stage"
rsync -azs --delete "$artifact/" "$host:$stage/"
printf -v remote_args '%q ' "$stage" "$target" "$backup" "$service" "$port"
ssh "$host" "bash -s -- $remote_args" <<'REMOTE'
set -euo pipefail
stage="$1" target="$2" backup="$3" service="$4" port="$5"
[[ -f "$stage/server.js" && ! -e "$backup" ]] || exit 2
for env_file in .env .env.production .env.local; do
  if [[ -f "$target/$env_file" && ! -f "$stage/$env_file" ]]; then cp -p "$target/$env_file" "$stage/$env_file"; fi
done
chown -R zion:zion "$stage"
swapped=0
rollback() {
  if [[ "$swapped" -eq 1 ]]; then
    systemctl stop "$service" || true
    mv "$target" "${target}.failed-$(date -u +%Y%m%dT%H%M%SZ)"
    mv "$backup" "$target"
    systemctl restart "$service"
    echo 'Restored the previous app after a failed startup.' >&2
  fi
}
trap rollback ERR
mv "$target" "$backup"
if ! mv "$stage" "$target"; then mv "$backup" "$target"; exit 1; fi
swapped=1
systemctl restart "$service"
curl -fsS --retry 10 --retry-all-errors --retry-delay 2 --max-time 10 -o /dev/null "http://127.0.0.1:$port/"
systemctl is-active "$service"
REMOTE
if ! curl -fsS --retry 8 --retry-all-errors --retry-delay 2 --max-time 15 -o /dev/null "$site/"; then
  printf -v rollback_args '%q ' "$target" "$backup" "$service"
  ssh "$host" "bash -s -- $rollback_args" <<'REMOTE'
set -euo pipefail
target="$1" backup="$2" service="$3"
systemctl stop "$service"
mv "$target" "${target}.failed-$(date -u +%Y%m%dT%H%M%SZ)"
mv "$backup" "$target"
systemctl restart "$service"
REMOTE
  echo 'Public health check failed; previous app restored.' >&2
  exit 1
fi
echo "Deployed $release; previous app retained at $backup"
