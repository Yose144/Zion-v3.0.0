#!/bin/bash
# ZION — manifest tréninkových dat Hirana (EDGE1)
# ============================================================================
# Proč: /opt/zion/hiran (23 GB) drží base model ve fp16, konvertované gguf,
# natrénované LoRA adaptery a datasety. **Nikde jinde nejsou** — než se začne
# se zálohou na node PC, musí existovat otisk, proti kterému se obnovená data
# dají ověřit (sha256 po souborech, ne jen "velikost sedí").
#
# Co dělá:
#   - spočítá sha256 + velikost každého souboru pod $HIRAN_ROOT
#   - zapíše je do $HIRAN_MANIFEST (atomicky: .tmp -> mv)
#   - vypíše souhrn (počet souborů, bajty, čas)
#
# Použití:
#   sudo bash /opt/zion/scripts/hiran-training-manifest.sh
#   HIRAN_ROOT=/opt/zion/hiran HIRAN_MANIFEST=/tmp/m.sha256 bash ...
#
# Ověření po obnovení (na node PC i na serveru):
#   cd /opt/zion/hiran && sha256sum -c MANIFEST.sha256
# ============================================================================

set -uo pipefail

ROOT="${HIRAN_ROOT:-/opt/zion/hiran}"
OUT="${HIRAN_MANIFEST:-${ROOT}/MANIFEST.sha256}"
TMP="${OUT}.tmp.$$"

if [[ ! -d "${ROOT}" ]]; then
  echo "[manifest] chyba: ${ROOT} neexistuje" >&2
  exit 1
fi

echo "[manifest] root=${ROOT}"
echo "[manifest] out=${OUT}"

cd "${ROOT}" || exit 1
START=$(date +%s)

# Manifest sám sebe nehashuje (jinak by nešel reprodukovat).
find . -type f ! -name 'MANIFEST.sha256' ! -name 'MANIFEST.sha256.tmp.*' -print0 \
  | sort -z \
  | xargs -0 -r sha256sum > "${TMP}" || { echo "[manifest] sha256sum selhal" >&2; rm -f "${TMP}"; exit 1; }

mv -f "${TMP}" "${OUT}"

FILES=$(wc -l < "${OUT}" | tr -d ' ')
BYTES=$(find . -type f ! -name 'MANIFEST.sha256' ! -name 'MANIFEST.sha256.tmp.*' -printf '%s\n' | awk '{s+=$1} END {print s+0}')
DUR=$(( $(date +%s) - START ))

printf '[manifest] hotovo: %s souborů, %.2f GiB, %ss\n' \
  "${FILES}" "$(awk -v b="${BYTES}" 'BEGIN{print b/1073741824}')" "${DUR}"
echo "[manifest] ověření: cd ${ROOT} && sha256sum -c MANIFEST.sha256"
