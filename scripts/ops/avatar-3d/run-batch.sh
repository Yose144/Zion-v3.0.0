#!/usr/bin/env bash
# Jedna dávka avatarů: rozbalí listy, ořízne panely, vygeneruje modely (a volitelně riguje).
#
# Použití:
#   bash scripts/ops/avatar-3d/run-batch.sh <sheets-zip> <batch-name> [--force-ratio 001,007]
#
# Proměnné prostředí:
#   AVATAR_ENV   – kořen prostředí (venv + klon TripoSR + HF cache); výchozí ~/.local/share/zion-avatar3d
#   RIG=1        – po generování spustit rig.py v Blenderu pro každý hotový GLB
#   BLENDER      – cesta k Blenderu (výchozí ~/Tools/blender-5.2.3/…)
#   MC / TEXTURE / MAX_TRIS – parametry generátoru (výchozí 320 / 2048 / 15000)
#
# Bezpečné opakování: existující GLB se přeskočí; chyba jedné postavy dávku nezastaví.
# Výstup: .artifacts/avatar-3d/<batch-name>/{inputs,stage}/ a generate.log.

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "použití: run-batch.sh <sheets-zip> <batch-name> [--force-ratio 001,007]" >&2
  exit 2
fi

ZIP_IN="$1"
BATCH="$2"
shift 2

FORCE_RATIO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --force-ratio)
      FORCE_RATIO="${2:-}"
      shift 2
      ;;
    *)
      echo "neznámý argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
W="${AVATAR_ENV:-$HOME/.local/share/zion-avatar3d}"
B="$ROOT/.artifacts/avatar-3d/$BATCH"
VP="$W/venv/bin/python"
MC="${MC:-320}"
TEXTURE="${TEXTURE:-2048}"
MAX_TRIS="${MAX_TRIS:-15000}"

if [ ! -x "$VP" ]; then
  echo "chybí prostředí: $VP (viz docs/3.2/AVATAR-3D-PIPELINE.md §2)" >&2
  exit 2
fi
if [ ! -f "$ZIP_IN" ]; then
  echo "chybí ZIP: $ZIP_IN" >&2
  exit 2
fi

export HF_HOME="$W/hf"
export U2NET_HOME="$W/u2net"
MODEL="$(echo "$W"/hf/hub/models--stabilityai--TripoSR/snapshots/*)"
if [ ! -f "$MODEL/model.ckpt" ]; then
  echo "chybí TripoSR checkpoint v $MODEL" >&2
  exit 2
fi

echo "== dávka $BATCH =="
mkdir -p "$B/sheets_raw" "$B/inputs"

echo "-- 1/3 rozbalení listů"
unzip -q -o -j "$ZIP_IN" '*/avatari/*/*-sheet.png' -d "$B/sheets_raw"

echo "-- 2/3 ořez panelů"
cropped=0
for sheet in "$B"/sheets_raw/*-sheet.png; do
  [ -e "$sheet" ] || continue
  id="$(basename "$sheet" | cut -d- -f1)"
  "$VP" "$ROOT/scripts/ops/avatar-3d/crop-sheet.py" "$sheet" "$B/inputs" --id "$id" >/dev/null
  cropped=$((cropped + 1))
done
if [ -n "$FORCE_RATIO" ]; then
  IFS=',' read -r -a forced <<< "$FORCE_RATIO"
  for id in "${forced[@]}"; do
    id="$(echo "$id" | tr -d '[:space:]')"
    [ -n "$id" ] || continue
    echo "   vynucený ratio ořez: $id"
    "$VP" "$ROOT/scripts/ops/avatar-3d/crop-sheet.py" "$B/sheets_raw/$id-sheet.png" \
      "$B/inputs" --id "$id" --method ratio >/dev/null
  done
fi
echo "   oříznuto listů: $cropped"

echo "-- 3/3 generování (MC=$MC, textura=$TEXTURE, max tris=$MAX_TRIS)"
TRIPOSR_SRC="$W/triposr" TRIPOSR_MODEL="$MODEL" "$VP" \
  "$ROOT/scripts/ops/avatar-3d/generate.py" \
  --input "$B/inputs" --out "$B/stage" \
  --device mps --mc "$MC" --resolution "$TEXTURE" --max-tris "$MAX_TRIS" \
  > "$B/generate.log" 2>&1

ok=$(grep -c '"status": "ok"' "$B/generate.log" || true)
failed=$(grep -c '"status": "failed"' "$B/generate.log" || true)
skipped=$(grep -c '"status": "skipped"' "$B/generate.log" || true)
echo "   hotovo: $ok, přeskočeno: $skipped, chyb: $failed (detail v $B/generate.log)"

if [ "${RIG:-0}" = "1" ]; then
  BLENDER="${BLENDER:-$HOME/Tools/blender-5.2.3/Blender.app/Contents/MacOS/Blender}"
  if [ ! -x "$BLENDER" ]; then
    echo "RIG=1, ale Blender nenalezen: $BLENDER" >&2
    exit 2
  fi
  echo "-- rig"
  for glb in "$B"/stage/*/*.glb; do
    [ -e "$glb" ] || continue
    case "$glb" in *-rigged.glb) continue ;; esac
    out="${glb%.glb}-rigged.glb"
    [ -f "$out" ] && continue
    "$BLENDER" -b --factory-startup --python "$ROOT/scripts/ops/avatar-3d/rig.py" \
      -- --input "$glb" --output "$out" >/dev/null 2>&1 && echo "   rig $(basename "$glb")"
  done
fi

echo "== hotovo: $B =="
