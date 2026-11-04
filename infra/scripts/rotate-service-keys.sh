#!/usr/bin/env bash
# rotate-service-keys.sh — rotace service-to-service klíčů (SEC 2026-11-02, H1).
#
# Co se ROTUJE (držíme obě strany, žádné fondy):
#   ZION_POOL_API_KEY / ZION_POOL_API_ADMIN_KEY  pool (validuje) ↔ dashboard, standby-sync
#   QTC_PAYOUT_ADMIN_KEY / PRL_PAYOUT_ADMIN_KEY   warpd multichain env (EDGE2) =
#                                               kopie ZION_POOL_API_ADMIN_KEY —
#                                               jinak každý /admin/external-payouts
#                                               drain skončí 401 (incident 2026-11-04:
#                                               sweepy mrtvé 2,6 dne, fronta 12 667)
#   ZION_DAO_API_KEY                             dao (validuje) ↔ free-world, issobella
#   FREE_WORLD_API_KEY                            free-world (validuje), žádný interní klient
#   ZION_POOL_ZIS_SERVICE_KEY ↔ ZIS_SERVICE_KEY   pool (posílá) ↔ ZIS (validuje)
#
# Co se NEROTUJE (a proč):
#   WARP_MNEMONIC, ZION_WALLET_MNEMONIC, ZION_POOL_WALLET_KEY, ZION_POOL_PAYOUT_SK_HEX,
#   shop-vault.json, pool-payout-wallet.json → nejsou „klíče", ale peněženky.
#   Rotace = migrace fondů na novou adresu, ne změna řetězce. 👤 rozhodnutí.
#   PRL_RPC_PASS / QTC_* / AUXPOW_PASSWORD_* → credentialy třetích stran (upstream pooly).
#   TLS klíče → spravuje certbot.
#
# Postup: záloha → zápis nových hodnot → restart v pořadí → verifikace.
# Rollback: zkopírovat *.bak-rotate-<ts> zpět a restartovat stejné unity.
set -uo pipefail

EDGE="${EDGE_HOST:-edge}"
EDGE2="${EDGE2_HOST:-zion-edge2}"
SSH_OPTS="${SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=20}"
TS="$(date +%Y%m%dT%H%M%SZ)"
GEN="openssl rand -hex 32"

say() { printf '[rotate] %s\n' "$*"; }
die() { printf '[rotate] CHYBA: %s\n' "$*" >&2; exit 1; }

new_pool_api="$($GEN)"; new_pool_admin="$($GEN)"; new_dao="$($GEN)"
new_fw="$($GEN)"; new_zis="$($GEN)"

say "nové hodnoty vygenerovány (32B hex), cíl: EDGE=$EDGE EDGE2=$EDGE2"

# ── helper: záloha + přepis jedné hodnoty v souboru (běží na vzdáleném boxu) ─
rotate_remote() { # rotate_remote <host> <file> <KEY> <VALUE>
    local host="$1" file="$2" key="$3" val="$4"
    ssh $SSH_OPTS "$host" "
        set -e
        [ -f '$file' ] || { echo 'SKIP (neexistuje): $file'; exit 0; }
        cp -a '$file' '$file.bak-rotate-$TS'
        if grep -q '^$key=' '$file'; then
            # hodnotu nikdy netiskneme; jen ji přepíšeme
            awk -v k='$key' -v v='$val' 'BEGIN{FS=OFS=\"=\"} \$1==k{print k\"=\"v; next} {print}' \
                '$file' > '$file.tmp' && mv '$file.tmp' '$file'
            chmod --reference='$file.bak-rotate-$TS' '$file' 2>/dev/null || true
            echo 'OK: $key @ $file'
        else
            echo 'SKIP (klíč není): $key @ $file'
        fi
    "
}

say "— rotace POOL API klíčů (pool + dashboard + standby) —"
for h in "$EDGE" "$EDGE2"; do
    rotate_remote "$h" /etc/zion/env/zion-v31-pool.env ZION_POOL_API_KEY "$new_pool_api"
    rotate_remote "$h" /etc/zion/env/zion-v31-pool.env ZION_POOL_API_ADMIN_KEY "$new_pool_admin"
    rotate_remote "$h" /etc/zion/env/zion-edge-python-dashboard.env ZION_POOL_API_KEY "$new_pool_api"
    rotate_remote "$h" /etc/zion/env/zion-edge-python-dashboard.env ZION_POOL_API_ADMIN_KEY "$new_pool_admin"
    rotate_remote "$h" /etc/zion/pool-standby.env ZION_POOL_API_KEY "$new_pool_api"
    rotate_remote "$h" /etc/zion/pool-standby.env ZION_POOL_API_ADMIN_KEY "$new_pool_admin"
done

# warpd (EDGE2) podepisuje /admin/* klíčem pojmenovaným po legu — musí být
# stejný jako nový ZION_POOL_API_ADMIN_KEY, jinak sweepy padají na 401.
rotate_remote "$EDGE2" /etc/zion/env/zion-v31-multichain.env QTC_PAYOUT_ADMIN_KEY "$new_pool_admin"
rotate_remote "$EDGE2" /etc/zion/env/zion-v31-multichain.env PRL_PAYOUT_ADMIN_KEY "$new_pool_admin"

say "— rotace DAO klíče (dao + free-world + issobella) —"
for h in "$EDGE" "$EDGE2"; do
    for f in zion-v31-dao zion-v31-free-world zion-v31-issobella; do
        rotate_remote "$h" "/etc/zion/env/$f.env" ZION_DAO_API_KEY "$new_dao"
    done
done

say "— rotace FREE_WORLD_API_KEY —"
for h in "$EDGE" "$EDGE2"; do
    rotate_remote "$h" /etc/zion/env/zion-v31-free-world.env FREE_WORLD_API_KEY "$new_fw"
done

say "— rotace ZIS service key (pool ↔ ZIS) —"
rotate_remote "$EDGE"  /etc/zion/env/zion-v31-pool.env ZION_POOL_ZIS_SERVICE_KEY "$new_zis"
rotate_remote "$EDGE2" /etc/zion/env/zion-v31-pool.env ZION_POOL_ZIS_SERVICE_KEY "$new_zis"
rotate_remote "$EDGE2" /etc/zion/pool-standby.env     ZION_POOL_ZIS_SERVICE_KEY "$new_zis"
rotate_remote "$EDGE2" /opt/zion/identity/.env        ZIS_SERVICE_KEY            "$new_zis"

say "— restarty (EDGE2: ZIS → dao → free-world → issobella → multichain; EDGE: pool → dashboard) —"
ssh $SSH_OPTS "$EDGE2" 'for u in zion-zis zion-v31-dao zion-v31-free-world zion-v31-issobella zion-v31-multichain; do systemctl restart $u; sleep 2; printf "%-26s %s\n" "$u" "$(systemctl is-active $u)"; done'
ssh $SSH_OPTS "$EDGE"  'for u in zion-v31-pool zion-edge-python-dashboard; do systemctl restart $u; sleep 3; printf "%-26s %s\n" "$u" "$(systemctl is-active $u)"; done'

say "— verifikace —"
ssh $SSH_OPTS "$EDGE" 'curl -s -o /dev/null -w "pool /health            -> %{http_code}\n" --max-time 10 http://127.0.0.1:8080/health'
ssh $SSH_OPTS "$EDGE2" 'for p in 8456/api/dao/health 8095/health 8097/health; do printf "%-24s -> " "$p"; curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 "http://127.0.0.1:$p"; done'
ssh $SSH_OPTS "$EDGE" 'cd /opt/zion/ZION_OS/dashboard && (DASHBOARD_PORT=8799 ZION_DESKTOP_EMBEDDED=1 DASHBOARD_HOST=127.0.0.1 nohup python3 app.py >/tmp/rot.log 2>&1 & echo $! > /tmp/rot.pid); sleep 6; curl -s -o /dev/null -w "dashboard /api/ops/overview -> %{http_code}\n" --max-time 25 http://127.0.0.1:8799/api/ops/overview; kill $(cat /tmp/rot.pid) 2>/dev/null'

say "hotovo. Zálohy: /etc/zion/*.bak-rotate-$TS (a /opt/zion/identity/.env.bak-rotate-$TS)"
say "POZOR: hodnoty nejsou nikde vypsané — jsou jen v env souborech (0600/0640)."
