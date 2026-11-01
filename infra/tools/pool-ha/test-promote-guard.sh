#!/usr/bin/env bash
# test-promote-guard.sh — testy fencing guardu (W2.2 / G11).
#
# Nedotýká se produkce: SSH i paritní skript jsou stuby v temp adresáři a
# stratum test míří na zavřený/otevřený lokální port. Běží i na macOS bash 3.2.
set -uo pipefail

GUARD="$(cd "$(dirname "$0")" && pwd)/pool-promote-guard.sh"
[ -r "$GUARD" ] || { echo "guard nenalezen: $GUARD" >&2; exit 2; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
STATE="$TMP/state"; mkdir -p "$STATE"
CLOSED_PORT=45999            # nic na něm neposlouchá
OPEN_PORT=45998              # dočasný listener (test G3 fail)

STUB_SSH="$TMP/stub-ssh"
cat > "$STUB_SSH" <<'EOS'
#!/usr/bin/env bash
case "$1" in
  *is-active*zion-v31-watchdog.timer*) printf '%s\n' "${STUB_TIMER-inactive}" ;;
  *is-active*zion-v31-pool*)           printf '%s\n' "${STUB_UNIT-inactive}" ;;
  *pgrep*)                             printf '%s\n' "${STUB_PROC-}" ;;
  *)                                   printf '\n' ;;
esac
EOS
chmod +x "$STUB_SSH"

STUB_PARITY="$TMP/parity.sh"
cat > "$STUB_PARITY" <<'EOS'
#!/usr/bin/env bash
printf '%s\n' "${STUB_PARITY_OUT-PASS (0 fail, 5 warn)}"
EOS
chmod +x "$STUB_PARITY"

pass=0; fail=0
chk() { # chk <název> <očekáváno> <skutečnost>
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  ✓ %s\n' "$1"
  else fail=$((fail+1)); printf '  ✗ %s (čekáno %s, je %s)\n' "$1" "$2" "$3"; fi
}

run_guard() { # run_guard <port> <args...>  → vypíše exit kód
  local port="$1"; shift
  ZION_POOL_HA_STATE_DIR="$STATE" \
  ZION_POOL_HA_SSH="$STUB_SSH" \
  ZION_DR_PARITY_SCRIPT="$STUB_PARITY" \
  ZION_POOL_EDGE_HOST=127.0.0.1 \
  ZION_POOL_EDGE_STRATUM_PORT="$port" \
  ZION_PROMOTE_COOLDOWN_S="${COOLDOWN-600}" \
  ZION_PROMOTE_TOKEN_TTL_S=900 \
  bash "$GUARD" "$@" >/dev/null 2>&1
  echo $?
}

echo "=== fencing guard ==="

# 1. primár žije → blokováno
COOLDOWN=0 STUB_UNIT=active run_guard "$CLOSED_PORT" --check >/dev/null
chk "primár active → blokováno" 1 "$(STUB_UNIT=active COOLDOWN=0 run_guard "$CLOSED_PORT" --check)"

# 2. primár mrtvý, ale auto-restart timer běží → blokováno
chk "primár dead + timer active → blokováno" 1 "$(STUB_TIMER=active COOLDOWN=0 run_guard "$CLOSED_PORT" --check)"

# 3. primár mrtvý, proces zůstal → blokováno
chk "primár dead + proces žije → blokováno" 1 "$(STUB_PROC='1234 zion-pool --serve' COOLDOWN=0 run_guard "$CLOSED_PORT" --check)"

# 4. SSH nedostupný (prázdný výstup) → blokováno
chk "SSH nedostupný → blokováno" 1 "$(STUB_UNIT='' COOLDOWN=0 run_guard "$CLOSED_PORT" --check)"

# 5. parita FAIL → blokováno
chk "parita FAIL → blokováno" 1 "$(STUB_PARITY_OUT='FAIL store age 20 min' COOLDOWN=0 run_guard "$CLOSED_PORT" --check)"

# 6. stratum na primáru odpovídá → blokováno
python3 - "$OPEN_PORT" <<'PY' &
import socket, sys, time
s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("127.0.0.1", int(sys.argv[1]))); s.listen(1)
time.sleep(12)
PY
LPID=$!
sleep 1
chk "stratum odpovídá → blokováno" 1 "$(COOLDOWN=0 run_guard "$OPEN_PORT" --check)"
kill "$LPID" 2>/dev/null || true; wait "$LPID" 2>/dev/null || true

# 7. všechny guardy OK → povoleno
chk "vše OK → povoleno" 0 "$(COOLDOWN=0 run_guard "$CLOSED_PORT" --check)"

# 8. --promote vydá token a zapíše cooldown
chk "--promote projde" 0 "$(COOLDOWN=0 run_guard "$CLOSED_PORT" --promote)"
chk "token existuje" 1 "$([ -f "$STATE/promote.token" ] && echo 1 || echo 0)"
chk "cooldown zapsán" 1 "$([ -s "$STATE/promote.last" ] && echo 1 || echo 0)"

# 9. druhý promote se aktivním tokenem → blokováno
chk "aktivní token → blokováno" 1 "$(COOLDOWN=0 run_guard "$CLOSED_PORT" --promote)"

# 10. --release token zruší
COOLDOWN=0 run_guard "$CLOSED_PORT" --release >/dev/null
chk "release zrušil token" 0 "$([ -f "$STATE/promote.token" ] && echo 1 || echo 0)"

# 11. cooldown drží (600 s) → blokováno
chk "cooldown blokuje" 1 "$(COOLDOWN=600 run_guard "$CLOSED_PORT" --check)"

# 12. po vypršení cooldownu (posun času v state) → povoleno
printf '%s\n' "$(($(date +%s) - 700))" > "$STATE/promote.last"
chk "po cooldownu povoleno" 0 "$(COOLDOWN=600 run_guard "$CLOSED_PORT" --check)"

# 13. audit má záznamy allowed i blocked
# počty se liší podle průběhu — stačí, že každý druh záznamu existuje
chk "audit: allowed"     1 "$([ "$(grep -c '"verdict":"allowed"' "$STATE/promote-audit.jsonl" 2>/dev/null || echo 0)" -ge 1 ] && echo 1 || echo 0)"
chk "audit: blocked"     1 "$([ "$(grep -c '"verdict":"blocked"' "$STATE/promote-audit.jsonl" 2>/dev/null || echo 0)" -ge 1 ] && echo 1 || echo 0)"
chk "audit: token-issued" 1 "$([ "$(grep -c '"verdict":"token-issued"' "$STATE/promote-audit.jsonl" 2>/dev/null || echo 0)" -ge 1 ] && echo 1 || echo 0)"
chk "audit: released"    1 "$([ "$(grep -c '"verdict":"released"' "$STATE/promote-audit.jsonl" 2>/dev/null || echo 0)" -ge 1 ] && echo 1 || echo 0)"

# 14. režim s omezenou sondou (PROBE_CMD) — jeden dotaz, parsuje unit/proc/timer
PROBE="$TMP/probe.sh"
cat > "$PROBE" <<'EOS'
#!/usr/bin/env bash
# Pozor: jména záměrně SP_* — guard si interně nastavuje P_UNIT/P_PROC/P_TIMER
# a kdyby stub četl ty samé názvy, zdědil by prázdné hodnoty (falešně zelený test).
printf 'unit=%s\nproc=%s\ntimer=%s\n' "${SP_UNIT-inactive}" "${SP_PROC-0}" "${SP_TIMER-inactive}"
EOS
chmod +x "$PROBE"
run_probe() { # run_probe <args...>
  ZION_POOL_HA_STATE_DIR="$STATE" ZION_POOL_HA_PROBE_CMD="$PROBE" \
  ZION_DR_PARITY_SCRIPT="$STUB_PARITY" ZION_POOL_EDGE_HOST=127.0.0.1 \
  ZION_POOL_EDGE_STRATUM_PORT="$CLOSED_PORT" ZION_PROMOTE_COOLDOWN_S=0 \
  bash "$GUARD" "$@" >/dev/null 2>&1
  echo $?
}
chk "sonda: unit=active → blokováno" 1 "$(SP_UNIT=active run_probe --check)"
chk "sonda: proc=1 → blokováno" 1 "$(SP_PROC=1 run_probe --check)"
chk "sonda: timer=active → blokováno" 1 "$(SP_TIMER=active run_probe --check)"
chk "sonda: vše ok → povoleno" 0 "$(run_probe --check)"

echo
echo "RESULT: $pass pass, $fail fail"
[ "$fail" -eq 0 ]
