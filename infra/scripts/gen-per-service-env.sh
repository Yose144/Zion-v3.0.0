#!/bin/bash
# ZION P0-3 — per-service env subsety (bez rotace klíčů)
# ============================================================================
# Problém: /etc/zion/edge-environment.sh (176 proměnných, mode 0644) čte ~12
# služeb. Každá vidí cizí secrety (pool payout key, WARP mnemonic, DB hesla).
#
# Co tento skript dělá:
#   1. vytvoří /etc/zion/env/<service>.env obsahující JEN secrety, které daná
#      služba skutečně čte (mapování níže vychází z kódu: `env::var(...)`,
#      clap `env = "..."`, a u poolu z dynamického `ZION_POOL_AUXPOW_PASSWORD_<TICKER>`)
#   2. zapíše systemd drop-in, který soubor načte AŽ PO sdíleném env (override)
#   3. s --strip odstraní ty secrety ze sdíleného souboru (záloha předem)
#
# **Rotace klíčů se nedělá** — hodnoty se kopírují 1:1, jen se zúží viditelnost.
#
# Použití:
#   bash gen-per-service-env.sh --check     # co by se stalo (jen jména)
#   bash gen-per-service-env.sh --apply     # vytvoř soubory + drop-iny
#   bash gen-per-service-env.sh --strip     # vyjmi secrety ze sdíleného souboru
#   bash gen-per-service-env.sh --verify    # co každá služba reálně vidí
# ============================================================================

set -uo pipefail

SHARED="${ZION_SHARED_ENV:-/etc/zion/edge-environment.sh}"
ENV_DIR="${ZION_ENV_DIR:-/etc/zion/env}"
DROPIN_DIR_SUFFIX="10-p03-env-isolation.conf"
MODE="${1:---check}"

# ── mapování secret → služba (zdroj: V31 kód, viz report) ──────────────────
POOL_SECRETS=(
  ZION_POOL_API_KEY ZION_POOL_API_ADMIN_KEY ZION_POOL_WALLET_KEY ZION_POOL_TLS_KEY
  ZION_POOL_ZIS_SERVICE_KEY QTC_NATIVE_TOKEN_FILE
  ZION_POOL_AUXPOW_PASSWORD_EVR ZION_POOL_AUXPOW_PASSWORD_KRX ZION_POOL_AUXPOW_PASSWORD_MEWC
  ZION_POOL_AUXPOW_PASSWORD_PHX ZION_POOL_AUXPOW_PASSWORD_RTM ZION_POOL_AUXPOW_PASSWORD_ZCL
  ZION_POOL_AUXPOW_PASSWORD_ZEC
)
WARP_SECRETS=(
  WARP_MNEMONIC WARP_EVM_RELAY_KEY WARP_VALIDATOR_KEYS WARP_BTC_RELAY_KEY
  WARP_BTC_SWAP_OFFER_KEY WARP_BTC_SWAP_ZION_SECRET ZION_WALLET_MNEMONIC
  ZION_HTLC_PREIMAGE_KEY PRL_PAYOUT_ADMIN_KEY PRL_RPC_PASS QTC_PAYOUT_ADMIN_KEY
)
NODE_SECRETS=(ZION_BRIDGE_VALIDATOR_PUBKEYS)

declare -A SERVICE_SECRETS=(
  [zion-v31-pool]="${POOL_SECRETS[*]}"
  [zion-v31-multichain]="${WARP_SECRETS[*]}"
  [zion-v31-dao]="ZION_DAO_API_KEY"
  [zion-v31-free-world]="FREE_WORLD_API_KEY ZION_DAO_API_KEY"
  [zion-v31-issobella]="ZION_DAO_API_KEY"
  [zion-v31-node]="${NODE_SECRETS[*]}"
  [zion-v31-node2]="${NODE_SECRETS[*]}"
  [zion-v31-node3]="${NODE_SECRETS[*]}"
  [zion-edge-python-dashboard]="ZION_POOL_API_KEY ZION_POOL_API_ADMIN_KEY"
)

# Secret, který žádný běžící kód nečte (ověřeno grepem) — do sdíleného env
# nepatří, ale nesmí se ztratit: jde do root-only legacy souboru.
LEGACY_SECRETS=(ZION_SWAP_BEARER_TOKEN ZION_SWAP_ESCROW_KEY ZION_POOL_PAYOUT_SK_HEX)

say() { printf '[p0-3] %s\n' "$*"; }
die() { printf '[p0-3] CHYBA: %s\n' "$*" >&2; exit 1; }

[[ -r "${SHARED}" ]] || die "nelze číst ${SHARED}"

# ── vyber jen ty VAR=value řádky, jejichž jméno je v seznamu ───────────────
extract() { # $1 = seznam jmen, $2 = cílový soubor
  local names="$1" out="$2" n hit=0
  : > "${out}.tmp"
  for n in ${names}; do
    if grep -qE "^${n}=" "${SHARED}"; then
      grep -E "^${n}=" "${SHARED}" >> "${out}.tmp"
      hit=$((hit+1))
    else
      say "  ! ${n} ve sdíleném env není (přeskočeno)"
    fi
  done
  chmod 0640 "${out}.tmp"
  chown "root:zion" "${out}.tmp" 2>/dev/null || true
  mv -f "${out}.tmp" "${out}"
  echo "${hit}"
}

case "${MODE}" in
  --check)
    say "shared=${SHARED} ($(grep -cE '^[A-Z0-9_]+=' "${SHARED}") proměnných)"
    for svc in "${!SERVICE_SECRETS[@]}"; do
      printf '  %-30s %s\n' "${svc}" "${SERVICE_SECRETS[$svc]}"
    done
    say "legacy (nikdo nečte, přesune se mimo): ${LEGACY_SECRETS[*]}"
    ;;

  --apply)
    mkdir -p "${ENV_DIR}" || die "mkdir ${ENV_DIR}"
    chmod 0700 "${ENV_DIR}"
    for svc in "${!SERVICE_SECRETS[@]}"; do
      names="${SERVICE_SECRETS[$svc]}"
      [[ -z "${names}" ]] && continue
      cnt=$(extract "${names}" "${ENV_DIR}/${svc}.env")
      say "${svc}: ${cnt} secretů → ${ENV_DIR}/${svc}.env"
      unit_path=$(systemctl show "${svc}.service" -p FragmentPath --value 2>/dev/null)
      if [[ -z "${unit_path}" || ! -f "${unit_path}" ]]; then
        say "  ! unit ${svc}.service nenalezen — drop-in přeskočen"
        continue
      fi
      ddir="/etc/systemd/system/${svc}.service.d"
      mkdir -p "${ddir}"
      cat > "${ddir}/${DROPIN_DIR_SUFFIX}" <<EOF
# P0-3 (2026-11-01) — per-service secrety, načteno PO sdíleném env.
# Hodnoty jsou 1:1 kopie z edge-environment.sh (žádná rotace), jen se zúžil
# okruh služeb, které je vidí. Rollback: smazat tento drop-in + daemon-reload.
[Service]
EnvironmentFile=-${ENV_DIR}/${svc}.env
EOF
      say "  drop-in: ${ddir}/${DROPIN_DIR_SUFFIX}"
    done
    cnt=$(extract "${LEGACY_SECRETS[*]}" "${ENV_DIR}/legacy-unused.env")
    chmod 0600 "${ENV_DIR}/legacy-unused.env"; chown root:root "${ENV_DIR}/legacy-unused.env"
    say "legacy-unused.env: ${cnt} nepoužívaných secretů (root-only, nenačítá se)"
    systemctl daemon-reload && say "daemon-reload OK"
    ;;

  --strip)
    BAK="/root/edge-environment.sh.bak-p03-strip-$(date +%Y%m%dT%H%M%SZ)"
    cp -a "${SHARED}" "${BAK}" || die "záloha selhala"
    chmod 0600 "${BAK}"
    say "záloha: ${BAK}"
    ALL="${LEGACY_SECRETS[*]}"
    for svc in "${!SERVICE_SECRETS[@]}"; do ALL="${ALL} ${SERVICE_SECRETS[$svc]}"; done
    keep_tmp="${SHARED}.tmp.$$"
    cp -a "${SHARED}" "${keep_tmp}"
    for n in ${ALL}; do
      sed -i "/^${n}=/d" "${keep_tmp}"
    done
    mv -f "${keep_tmp}" "${SHARED}"
    chmod 0640 "${SHARED}"; chown root:zion "${SHARED}"
    say "odebráno secretů: $(echo ${ALL} | tr ' ' '\n' | sort -u | wc -l | tr -d ' '); zůstalo proměnných: $(grep -cE '^[A-Z0-9_]+=' "${SHARED}")"
    ;;

  --verify)
    # `systemctl show -p Environment` ukazuje jen inline `Environment=`,
    # ne obsah EnvironmentFile — secret je proto nutné hledat v prostředí
    # běžícího procesu. Tiskneme jen jména (✓/✗), nikdy hodnoty.
    for svc in "${!SERVICE_SECRETS[@]}"; do
      pid=$(systemctl show "${svc}.service" -p MainPID --value 2>/dev/null)
      if [[ -z "${pid}" || "${pid}" == "0" ]]; then
        printf '%-30s (neběží)\n' "${svc}"
        continue
      fi
      envs=$(tr '\0' '\n' < "/proc/${pid}/environ" 2>/dev/null)
      printf '%-30s ' "${svc}"
      for n in ${SERVICE_SECRETS[$svc]}; do
        if echo "${envs}" | grep -q "^${n}="; then printf '%s✓ ' "${n}"; else printf '%s✗ ' "${n}"; fi
      done
      echo
    done
    # kontrola izolace: co služba vidí z CIZÍCH secretů
    echo "--- cizí secrety v prostředí (má být prázdné) ---"
    for svc in "${!SERVICE_SECRETS[@]}"; do
      pid=$(systemctl show "${svc}.service" -p MainPID --value 2>/dev/null)
      [[ -z "${pid}" || "${pid}" == "0" ]] && continue
      envs=$(tr '\0' '\n' < "/proc/${pid}/environ" 2>/dev/null)
      own=" ${SERVICE_SECRETS[$svc]} "
      foreign=""
      for n in "${LEGACY_SECRETS[@]}" ${POOL_SECRETS[*]} ${WARP_SECRETS[*]}; do
        [[ "${own}" == *" ${n} "* ]] && continue
        echo "${envs}" | grep -q "^${n}=" && foreign="${foreign}${n} "
      done
      [[ -n "${foreign}" ]] && printf '%-30s %s\n' "${svc}" "${foreign}"
    done
    echo "(konec)"
    ;;

  *) die "neznámý režim ${MODE} (--check|--apply|--strip|--verify)" ;;
esac
