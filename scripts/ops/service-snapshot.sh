#!/usr/bin/env bash
# service-snapshot.sh — rollback artefakt pro každý produkční deploy.
#
# Proč: deploye na EDGE1/EDGE2 dělá několik skriptů (pool build+rsync, node
# rsync, artefaktový deploy webu, marketplace). Zálohy vznikaly ad-hoc a nikdo
# neměl jistotu, že k běžící binárce existuje cesta zpět — pool neměl binární
# rollback vůbec, jen „rebuild ze zálohovaných zdrojů“, což rollback není.
#
# Co to umí:
#   snapshot  — uloží binárku (nebo app tree) + unit + manifest do
#               /opt/zion/backups/services/<unit>/<UTC>/ a drží posledních N.
#   list      — co je k dispozici (unit, čas, sha, velikost, druh).
#   restore   — vrátí konkrétní snapshot: NEJDŘÍV uloží běžící verzi jako safety
#               snapshot, pak stop → výměna → start → kontrola. Když kontrola
#               neprojde, vrátí safety snapshot a skončí chybou.
#
# Použití (z repo, přes SSH):
#   bash scripts/ops/service-snapshot.sh snapshot                  # oba hosty
#   bash scripts/ops/service-snapshot.sh snapshot --host edge1 --keep 3
#   bash scripts/ops/service-snapshot.sh list --host edge2
#   bash scripts/ops/service-snapshot.sh restore --host edge2 \
#        --service zion-v31-dao --to 20261108T101500Z             # dry-run
#   bash scripts/ops/service-snapshot.sh restore ... --confirm    # provede
#
# Next aplikace (artefakt = .next/standalone + .next/static, ne celé .next):
#   ... snapshot --host edge2 --service zion-website --kind nextapp \
#       --path '/opt/zion/APP&WEB/website-v2.9'
#   (public/ se záměrně nesnapshotuje — je to obsah z repa, ne build.)
#
# Bezpečnost:
#   - restore je defaultně DRY-RUN; bez `--confirm` se nic nemění,
#   - před každou změnou vzniká safety snapshot běžící verze,
#   - služba se jen stop/start; nemění se unit soubor, env ani DB,
#   - bez `--health-url` se kontroluje jen `systemctl is-active`.
set -uo pipefail

SNAPSHOT_DIR="${ZION_SNAPSHOT_DIR:-/opt/zion/backups/services}"
KEEP="${ZION_SNAPSHOT_KEEP:-5}"
SYSTEMCTL="${ZION_SYSTEMCTL:-systemctl}"
HOST_EDGE1="${ZION_HOST_EDGE1:-zion-v6}"
HOST_EDGE2="${ZION_HOST_EDGE2:-zion-edge2}"

# Interprety a skripty: snapshot jejich binárky nemá smysl, rollback patří tree.
INTERPRETERS="node python3 python bash sh tsx ssh env"

die() { echo "ERROR: $*" >&2; exit 1; }
say() { echo "[service-snapshot] $*"; }

# GNU coreutils a BSD se liší v `stat`; skript běží na Linuxu, ale self-test
# běží i na macOS, takže obojí.
file_size()  { stat -c%s "$1" 2>/dev/null || stat -f%z "$1"; }
file_mode()  { stat -c%a "$1" 2>/dev/null || stat -f%Lp "$1"; }
file_owner() { stat -c%U:%G "$1" 2>/dev/null || stat -f"%Su:%Sg" "$1"; }

exec_path_of() { "$SYSTEMCTL" show -p ExecStart --value "$1" 2>/dev/null | sed -E 's/.*path=([^ ;]+).*/\1/' | head -1; }

is_interpreter() {
  local base; base="$(basename "$1")"
  for i in $INTERPRETERS; do [[ "$base" == "$i" || "$base" == "$i".sh ]] && return 0; done
  [[ "$base" == *.sh ]] && return 0
  [[ "$1" == /usr/bin/* ]] && return 0
  return 1
}

running_units() { "$SYSTEMCTL" list-units 'zion-*' --state=running --no-legend --no-pager 2>/dev/null | awk '{print $1}'; }

# Cizí software (bitcoind, quantus, pearl, llama-server) nemá smysl
# snapshotovat — jeho „rollback" není náš deploy a jen to zapleveluje seznam.
is_third_party() {
  local ex="$1" base; base="$(basename "$ex")"
  case "$ex" in /opt/quantus/*|/opt/pearl/*|/opt/zion/bitcoin/*|/opt/zion/llama-*) return 0 ;; esac
  case "$base" in bitcoind|quantus-node|pearld|oyster|pearl-gateway|llama-server) return 0 ;; esac
  return 1
}

auto_units() {
  local u ex
  while read -r u; do
    [[ -z "$u" ]] && continue
    ex="$(exec_path_of "$u")"
    [[ -n "$ex" && -e "$ex" ]] || continue
    is_interpreter "$ex" && continue
    is_third_party "$ex" && continue
    echo "$u"
  done < <(running_units)
}

NEXTAPP_MEMBERS=".next/standalone .next/static package.json"

snapshot_one() {  # <unit> <kind: binary|tree|nextapp> [path]
  local unit="$1" kind="$2" path="${3:-}" ex ts dir sha size mode owner artifact git_commit="" all=() oldest
  ex="$path"; [[ -z "$ex" ]] && ex="$(exec_path_of "$unit")"
  [[ -n "$ex" && -e "$ex" ]] || { say "skip $unit: cesta neexistuje ($ex)"; return 1; }

  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  dir="$SNAPSHOT_DIR/$unit/$ts"
  # dvě operace v jedné sekundě (safety snapshot + restore) nesmí sdílet adresář:
  # jinak safety snapshot přepíše snapshot, který se má obnovit.
  local n=1
  while [[ -e "$dir" ]]; do dir="$SNAPSHOT_DIR/$unit/${ts}-$n"; n=$((n + 1)); done
  mkdir -p "$dir" || return 1

  if [[ "$kind" == "nextapp" ]]; then
    local present=() m
    for m in $NEXTAPP_MEMBERS; do [[ -e "$ex/$m" ]] && present+=("$m"); done
    [[ ${#present[@]} -gt 0 ]] || { say "skip $unit: v $ex není .next/standalone"; return 1; }
    tar -C "$ex" -czf "$dir/app.tar.gz" "${present[@]}" || return 1
    sha="$(sha256sum "$dir/app.tar.gz" | awk '{print $1}')"
    size="$(file_size "$dir/app.tar.gz")"
    mode="nextapp"
  elif [[ "$kind" == "tree" ]]; then
    tar -C "$(dirname "$ex")" -czf "$dir/tree.tar.gz" "$(basename "$ex")" || return 1
    sha="$(sha256sum "$dir/tree.tar.gz" | awk '{print $1}')"
    size="$(file_size "$dir/tree.tar.gz")"
    mode="tree"
  else
    cp -a "$ex" "$dir/$(basename "$ex")" || return 1
    sha="$(sha256sum "$dir/$(basename "$ex")" | awk '{print $1}')"
    size="$(file_size "$ex")"
    mode="$(file_mode "$ex")"
  fi
  owner="$(file_owner "$ex")"
  "$SYSTEMCTL" cat "$unit" > "$dir/unit.txt" 2>/dev/null
  case "$kind" in
    nextapp) artifact="app.tar.gz" ;;
    tree)    artifact="tree.tar.gz" ;;
    *)       artifact="$(basename "$ex")" ;;
  esac
  [[ -d /opt/zion/V31/.git ]] && git_commit="$(git -C /opt/zion/V31 rev-parse --short=9 HEAD 2>/dev/null || true)"

  cat > "$dir/manifest.json" <<JSON
{
  "captured_at": "$ts",
  "host": "$(hostname)",
  "unit": "$unit",
  "kind": "$kind",
  "exec_path": "$ex",
  "artifact": "$artifact",
  "sha256": "$sha",
  "size_bytes": $size,
  "mode": "$mode",
  "owner": "$owner",
  "active_since": "$("$SYSTEMCTL" show -p ActiveEnterTimestamp --value "$unit" 2>/dev/null | tr -d '\n')",
  "unit_file_sha256": "$(sha256sum "$dir/unit.txt" 2>/dev/null | awk '{print $1}')",
  "git_commit": "$git_commit"
}
JSON

  all=(); while IFS= read -r x; do all+=("$x"); done < <(ls -1 "$SNAPSHOT_DIR/$unit" 2>/dev/null | sort)
  while (( ${#all[@]} > KEEP )); do
    oldest="${all[0]}"
    [[ "$oldest" == "$ts" ]] && break
    rm -rf "${SNAPSHOT_DIR:?}/$unit/$oldest"
    all=("${all[@]:1}")
  done
  LAST_SNAPSHOT_DIR="$dir"
  echo "snapshot $unit -> $dir ($kind, ${size}B, $(echo "$sha" | cut -c1-12))"
}

# `--service pool` i `--service zion-v31-pool.service` mají fungovat.
normalize_service() {
  local s="$1"
  [[ "$s" == *.* ]] && { echo "$s"; return; }
  if "$SYSTEMCTL" cat "$s.service" >/dev/null 2>&1 || [[ -d "$SNAPSHOT_DIR/$s.service" ]]; then
    echo "$s.service"
  else
    echo "$s"
  fi
}

manifest_field() { python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get(sys.argv[2],""))' "$1" "$2"; }

apply_artifact() {  # <snapshot dir> <kind> <exec_path> <manifest>
  local src="$1" kind="$2" ex="$3" manifest="$4" artifact mode owner
  artifact="$(manifest_field "$manifest" artifact)"
  if [[ "$kind" == "nextapp" ]]; then
    local m
    for m in .next/standalone .next/static; do
      [[ -e "$ex/$m" ]] && mv "$ex/$m" "$ex/$m.rollback-out-$(date -u +%Y%m%dT%H%M%SZ)"
    done
    tar -C "$ex" -xzf "$src/$artifact"
  elif [[ "$kind" == "tree" ]]; then
    local parent; parent="$(dirname "$ex")"
    [[ -e "$ex" ]] && mv "$ex" "${ex}.rollback-out-$(date -u +%Y%m%dT%H%M%SZ)"
    tar -C "$parent" -xzf "$src/$artifact"
  else
    mode="$(manifest_field "$manifest" mode)"; owner="$(manifest_field "$manifest" owner)"
    cp -f "$src/$artifact" "${ex}.new" && chmod "$mode" "${ex}.new" && chown "$owner" "${ex}.new" && mv -f "${ex}.new" "$ex"
  fi
}

wait_active() {  # <unit>
  local i
  for i in $(seq 1 15); do "$SYSTEMCTL" is-active --quiet "$1" && return 0; sleep 1; done
  return 1
}

cmd_snapshot() {
  local units=() s rc=0 x
  if [[ -n "${SERVICES:-}" ]]; then IFS=',' read -r -a units <<< "$SERVICES"
  else while IFS= read -r x; do units+=("$x"); done < <(auto_units); fi
  [[ ${#units[@]} -eq 0 ]] && { say "žádné služby ke snapshotu"; return 0; }
  for s in "${units[@]}"; do
    snapshot_one "$(normalize_service "$s")" "${KIND:-binary}" "${PATH_OVERRIDE:-}" || rc=1
  done
  return $rc
}

cmd_verify() {
  local units=() u newest rc=0 kind want cur ex artifact
  # union: co běží (binárky) + co má snapshot (třeba nextapp, které auto_units
  # nezachytí, protože ExecStart je node)
  while IFS= read -r u; do units+=("$u"); done < <(auto_units)
  if [[ -d "$SNAPSHOT_DIR" ]]; then
    for d in "$SNAPSHOT_DIR"/*/; do
      [[ -d "$d" ]] || continue
      u="$(basename "$d")"
      [[ " ${units[*]-} " == *" $u "* ]] || units+=("$u")
    done
  fi
  [[ ${#units[@]} -eq 0 ]] && { say "žádné služby k ověření"; return 0; }

  printf '%-32s %-9s %s\n' UNIT STATE DETAIL
  for u in "${units[@]}"; do
    newest=""
    while IFS= read -r d; do newest="$d"; done < <(ls -1d "$SNAPSHOT_DIR/$u"/*/ 2>/dev/null | sort)
    if [[ -z "$newest" ]]; then
      printf '%-32s %-9s %s\n' "$u" MISSING "žádný snapshot — deploy bez cesty zpět"
      rc=1; continue
    fi
    newest="${newest%/}"
    kind="$(manifest_field "$newest/manifest.json" kind)"
    artifact="$(manifest_field "$newest/manifest.json" artifact)"
    if [[ ! -f "$newest/$artifact" ]]; then
      printf '%-32s %-9s %s\n' "$u" BROKEN "artefakt chybí: $newest/$artifact"
      rc=1; continue
    fi
    if [[ "$kind" == "binary" ]]; then
      want="$(manifest_field "$newest/manifest.json" sha256)"
      ex="$(manifest_field "$newest/manifest.json" exec_path)"
      cur="$(sha256sum "$ex" 2>/dev/null | awk '{print $1}')"
      if [[ "$want" == "$cur" ]]; then
        printf '%-32s %-9s %s\n' "$u" OK "$(basename "$newest")"
      else
        printf '%-32s %-9s %s\n' "$u" DRIFT "běžící $(echo "$cur" | cut -c1-12) != snapshot $(echo "$want" | cut -c1-12)"
        rc=1
      fi
    else
      printf '%-32s %-9s %s\n' "$u" OK "$(basename "$newest") ($kind, $(manifest_field "$newest/manifest.json" size_bytes)B)"
    fi
  done
  return $rc
}

cmd_list() {
  [[ -d "$SNAPSHOT_DIR" ]] || { echo "žádné snapshoty ($SNAPSHOT_DIR)"; return 0; }
  printf '%-30s %-18s %-14s %-12s %s\n' UNIT CAPTURED SHA12 SIZE KIND
  local m
  for m in "$SNAPSHOT_DIR"/*/*/manifest.json; do
    [[ -f "$m" ]] || continue
    python3 - "$m" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
print(f'{d["unit"]:<30} {d["captured_at"]:<18} {d["sha256"][:12]:<14} {d["size_bytes"]:<12} {d["kind"]}')
PY
  done
}

cmd_restore() {
  local unit="${SERVICES:-}" to="${TO:-}" health="${HEALTH_URL:-}" kind="${KIND:-binary}"
  [[ -n "$unit" ]] || die "restore potřebuje --service"
  unit="$(normalize_service "$unit")"
  local base="$SNAPSHOT_DIR/$unit"
  [[ -d "$base" ]] || die "žádné snapshoty pro $unit"

  local src
  if [[ -n "$to" ]]; then
    src="$base/$to"; [[ -d "$src" ]] || die "snapshot $to neexistuje"
  else
    src="$(ls -1d "$base"/*/ 2>/dev/null | sort | tail -2 | head -1)"; src="${src%/}"
    [[ -n "$src" && -d "$src" ]] || die "chybí předchozí snapshot (je jen jeden)"
  fi

  local manifest="$src/manifest.json"
  [[ -f "$manifest" ]] || die "chybí manifest v $src"
  local exec_path; exec_path="$(manifest_field "$manifest" exec_path)"
  kind="$(manifest_field "$manifest" kind)"

  say "unit:     $unit"
  say "snapshot: $src ($(manifest_field "$manifest" captured_at))"
  say "cíl:      $exec_path"
  say "artefakt: $(manifest_field "$manifest" artifact)"

  if [[ "${CONFIRM:-0}" != "1" ]]; then
    cat <<EOF
DRY-RUN — nic se nemění. Kroky, které by proběhly:
  1) safety snapshot běžící verze -> $SNAPSHOT_DIR/$unit/<new ts>/
  2) $SYSTEMCTL stop $unit
  3) výměna artefaktu na $exec_path
  4) $SYSTEMCTL start $unit
  5) čekání na is-active${health:+ + health $health}
  6) při neúspěchu návrat safety snapshotu
Pro provedení přidej --confirm.
EOF
    return 0
  fi

  say "1/5 safety snapshot běžící verze"
  LAST_SNAPSHOT_DIR=""
  snapshot_one "$unit" "$kind" "" >/dev/null || die "safety snapshot selhal — restore nepokračuje"
  # ber přesně ten adresář, který vznikl — odvozovat ho z `sort` je křehké
  # (stejná sekunda, jiné pořadí `-1` suffixu)
  local safety="$LAST_SNAPSHOT_DIR"
  [[ -d "$safety" ]] || die "safety snapshot se nepodařilo určit"
  say "     safety: $safety"

  say "2/5 stop $unit"
  "$SYSTEMCTL" stop "$unit" || die "stop selhal"

  say "3/5 výměna artefaktu"
  if ! apply_artifact "$src" "$kind" "$exec_path" "$manifest"; then
    say "výměna selhala — vracím safety snapshot"
    apply_artifact "$safety" "$kind" "$exec_path" "$safety/manifest.json"
    "$SYSTEMCTL" start "$unit" || true
    die "restore selhal při výměně (původní verze vrácena)"
  fi

  say "4/5 start $unit"
  "$SYSTEMCTL" start "$unit" || true

  say "5/5 kontrola"
  if wait_active "$unit" && { [[ -z "$health" ]] || curl -fsS -m 5 "$health" >/dev/null; }; then
    say "OK — $unit běží na snapshotu $(basename "$src")"
    return 0
  fi

  say "kontrola SELHALA — vracím safety snapshot $(basename "$safety")"
  "$SYSTEMCTL" stop "$unit" || true
  apply_artifact "$safety" "$kind" "$exec_path" "$safety/manifest.json" || true
  "$SYSTEMCTL" start "$unit" || true
  die "restore neprošel kontrolou; vrácena původní verze — zkontroluj $unit ručně"
}

# ── vstup ──────────────────────────────────────────────────────────────────
MODE="${1:-}"; shift || true
HOST_ARG=""; SERVICES=""; TO=""; HEALTH_URL=""; KIND=""; PATH_OVERRIDE=""; CONFIRM=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)       HOST_ARG="$2"; shift 2 ;;
    --service)    SERVICES="$2"; shift 2 ;;
    --to)         TO="$2"; shift 2 ;;
    --keep)       KEEP="$2"; shift 2 ;;
    --kind)       KIND="$2"; shift 2 ;;
    --path)       PATH_OVERRIDE="$2"; shift 2 ;;
    --health-url) HEALTH_URL="$2"; shift 2 ;;
    --confirm)    CONFIRM=1; shift ;;
    *) die "neznámý argument: $1" ;;
  esac
done

host_for() {
  case "$1" in
    edge1) echo "$HOST_EDGE1" ;;
    edge2) echo "$HOST_EDGE2" ;;
    *) echo "$1" ;;
  esac
}

remote_run() {  # <host> <mode> <args...>
  local h="$1"; shift
  local mode="$1"; shift
  local args="$mode"
  local a
  for a in "$@"; do args+=" $(printf %q "$a")"; done
  ssh -o BatchMode=yes "$h" "ZION_REMOTE=1 bash -s -- $args" < "$0"
}

if [[ "${ZION_REMOTE:-0}" != "1" ]]; then
  # předej jen explicitně zadané volby (prázdné nezapisuj)
  fwd=()
  [[ -n "$KEEP" ]] && fwd+=(--keep "$KEEP")
  [[ -n "$SERVICES" ]] && fwd+=(--service "$SERVICES")
  [[ -n "$KIND" ]] && fwd+=(--kind "$KIND")
  [[ -n "$PATH_OVERRIDE" ]] && fwd+=(--path "$PATH_OVERRIDE")
  [[ -n "$TO" ]] && fwd+=(--to "$TO")
  [[ -n "$HEALTH_URL" ]] && fwd+=(--health-url "$HEALTH_URL")
  [[ "$CONFIRM" == "1" ]] && fwd+=(--confirm)

  case "$MODE" in
    snapshot|list|verify)
      if [[ -n "$HOST_ARG" && "$HOST_ARG" != "all" ]]; then
        remote_run "$(host_for "$HOST_ARG")" "$MODE" "${fwd[@]}"; exit $?
      fi
      rc=0
      for h in "$HOST_EDGE1" "$HOST_EDGE2"; do
        echo "=== $h ==="
        remote_run "$h" "$MODE" "${fwd[@]}" || rc=$?
      done
      exit $rc
      ;;
    restore)
      [[ -n "$HOST_ARG" ]] || die "restore potřebuje --host edge1|edge2|<ssh alias>"
      remote_run "$(host_for "$HOST_ARG")" "$MODE" "${fwd[@]}"; exit $?
      ;;
    ""|-h|--help) sed -n '2,36p' "$0"; exit 0 ;;
    *) die "neznámý režim: $MODE (snapshot|list|restore)" ;;
  esac
fi

case "$MODE" in
  snapshot) cmd_snapshot ;;
  list)     cmd_list ;;
  verify)   cmd_verify ;;
  restore)  cmd_restore ;;
  *) die "neznámý režim: $MODE" ;;
esac
