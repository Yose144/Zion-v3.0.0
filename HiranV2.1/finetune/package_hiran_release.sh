#!/usr/bin/env bash
# =============================================================================
# Hiran / Hiranyagarbha — komplexní release balíček (ZIP) pro jiný stroj
# =============================================================================
# Zabalí GGUF + přenosný Modelfile + manifest + návod. Volitelně LoRA nebo
# celý HF merge adresář (velké). Spouštěj z kořene repa nebo odkudkoliv.
#
#   ./HiranV2.1/finetune/package_hiran_release.sh --help
#   ./HiranV2.1/finetune/package_hiran_release.sh
#   ./HiranV2.1/finetune/package_hiran_release.sh --with-lora --name hiran-v2.1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# Kanonické výstupy tréninku jsou v HiranV2.1; starší běhy mohly zapisovat do scripts/finetune/outputs.
HIRAN_OUTPUTS="${REPO_ROOT}/HiranV2.1/finetune/outputs"
LEGACY_OUTPUTS="${REPO_ROOT}/scripts/finetune/outputs"
OUTPUTS_DIR="${OUTPUTS_DIR-}"
EXPLICIT_OUTPUTS=0
RELEASE_SLUG="${RELEASE_SLUG:-hiran-v2.1}"
WITH_LORA=0
WITH_HF_MERGED=0
GGUF_PATH=""
MODELFILE_PATH=""
LORA_DIR=""
OUT_ZIP=""
NO_ZIP=0

die() { echo "CHYBA: $*" >&2; exit 1; }
info() { echo "[package] $*"; }

usage() {
  sed -n '1,80p' <<'EOF'
Hiran release packager — vytvoří adresář + ZIP pro přenos na jiný stroj.

Použití:
  package_hiran_release.sh [možnosti]

Možnosti:
  --outputs-dir DIR   Kořen s outputs (jinak: auto — nejnovější *.gguf v
                        HiranV2.1/finetune/outputs a scripts/finetune/outputs — vybere se
                        adresář s nejnovějším *.gguf podle času souboru)
  --gguf FILE         Konkrétní GGUF (jinak: nejnovější *.gguf v zvoleném outputs)
  --modelfile FILE    Modelfile.zion (jinak: hledá */Modelfile.zion pod outputs)
  --lora-dir DIR      LoRA adaptér (výchozí při --with-lora: .../outputs/zion-llama-lora)
  --name SLUG         Název release / prefix ZIP (výchozí: hiran-v2.1)
  --with-lora         Přibalí celou LoRA složku (re-merge na cíli; +stovky MB)
  --with-hf-merged    Přibalí HF sloučený model (desítky GB — jen výjimečně)
  --out-zip PATH      Cílový ZIP; výchozí: ~/SLUG-YYYYMMDD-HHMM.zip
  --no-zip            Jen složku v /tmp, nevytvářej ZIP (vypíše cestu)

Env:
  OUTPUTS_DIR, RELEASE_SLUG — totéž jako --outputs-dir / --name
  (Bez OUTPUTS_DIR skript sám najde GGUF v HiranV2.1 nebo legacy scripts/finetune.)

Co je v balíčku (minimální režim):
  - GGUF (přejmenovaný na jednotný název v archivu)
  - Modelfile (FROM ./... — portable)
  - MANIFEST.json (sha256, velikost, base model z LoRA pokud existuje)
  - README_INSTALL.md (Ollama + tipy pro ZION env)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --outputs-dir) OUTPUTS_DIR="$2"; EXPLICIT_OUTPUTS=1; shift 2 ;;
    --gguf) GGUF_PATH="$2"; shift 2 ;;
    --modelfile) MODELFILE_PATH="$2"; shift 2 ;;
    --lora-dir) LORA_DIR="$2"; shift 2 ;;
    --name|--slug) RELEASE_SLUG="$2"; shift 2 ;;
    --with-lora) WITH_LORA=1; shift ;;
    --with-hf-merged) WITH_HF_MERGED=1; shift ;;
    --out-zip) OUT_ZIP="$2"; shift 2 ;;
    --no-zip) NO_ZIP=1; shift ;;
    *) die "Neznámý argument: $1 (zkus --help)" ;;
  esac
done

# --- Automatická volba outputs/ (GGUF může být ještě ve starém scripts/finetune/outputs) ---
_file_mtime() {
  if stat -f%m "$1" >/dev/null 2>&1; then stat -f%m "$1"
  else stat -c%Y "$1" 2>/dev/null || echo 0
  fi
}

_newest_gguf_in_dir() {
  local d="$1" best="" best_mt=0 cur mt
  [[ -d "$d" ]] || { echo ""; return 0; }
  shopt -s nullglob
  for cur in "$d"/*.gguf; do
    [[ -f "$cur" ]] || continue
    mt="$(_file_mtime "$cur")"
    if [[ -z "$best" ]] || [[ "$mt" -gt "$best_mt" ]]; then best_mt=$mt; best=$cur; fi
  done
  shopt -u nullglob
  echo "$best"
}

_dir_has_gguf() {
  local d="$1"
  [[ -d "$d" ]] || return 1
  shopt -s nullglob
  local g=( "$d"/*.gguf )
  shopt -u nullglob
  [[ ${#g[@]} -gt 0 ]]
}

_best_gguf_either_tree() {
  local a b ta tb
  a="$(_newest_gguf_in_dir "$HIRAN_OUTPUTS")"
  b="$(_newest_gguf_in_dir "$LEGACY_OUTPUTS")"
  if [[ -n "$a" && -n "$b" ]]; then
    ta="$(_file_mtime "$a")"; tb="$(_file_mtime "$b")"
    if [[ "$ta" -ge "$tb" ]]; then echo "$a"; else echo "$b"; fi
  elif [[ -n "$a" ]]; then echo "$a"
  else echo "$b"
  fi
}

if [[ "$EXPLICIT_OUTPUTS" -eq 0 ]]; then
  best="$(_best_gguf_either_tree)"
  if [[ -z "${OUTPUTS_DIR}" ]]; then
    if [[ -n "$best" ]]; then
      OUTPUTS_DIR="$(dirname "$best")"
      if [[ "$OUTPUTS_DIR" == "$LEGACY_OUTPUTS" ]]; then
        info "GGUF je v legacy $LEGACY_OUTPUTS — kanon je $HIRAN_OUTPUTS (viz scripts/finetune/README.md)."
      fi
    else
      OUTPUTS_DIR="$HIRAN_OUTPUTS"
    fi
  elif ! _dir_has_gguf "$OUTPUTS_DIR" && [[ -n "$best" ]]; then
    info "V $OUTPUTS_DIR není žádný *.gguf — přepínám na $(dirname "$best")"
    OUTPUTS_DIR="$(dirname "$best")"
  fi
fi

mkdir -p "$OUTPUTS_DIR" 2>/dev/null || true
[[ -d "$OUTPUTS_DIR" ]] || die "Adresář neexistuje: $OUTPUTS_DIR"

if [[ -z "$GGUF_PATH" ]]; then
  shopt -s nullglob
  local_ggufs=( "$OUTPUTS_DIR"/*.gguf )
  shopt -u nullglob
  if [[ ${#local_ggufs[@]} -gt 0 ]]; then
    GGUF_PATH="$(ls -t "${local_ggufs[@]}" | head -1)"
  fi
  [[ -n "$GGUF_PATH" ]] || die "Nenalezen žádný *.gguf v $OUTPUTS_DIR.
Zkontroluj také druhou kanonickou cestu nebo přesuň artefakty:
  mkdir -p \"$HIRAN_OUTPUTS\" && mv \"$LEGACY_OUTPUTS\"/*.gguf \"$HIRAN_OUTPUTS\"/ 2>/dev/null || true
Nebo zadej přímo: --gguf /cesta/k/modelu.gguf
Hledané kořeny: $HIRAN_OUTPUTS , $LEGACY_OUTPUTS"
fi
[[ -f "$GGUF_PATH" ]] || die "GGUF není soubor: $GGUF_PATH"

if [[ -z "$MODELFILE_PATH" ]]; then
  MODELFILE_PATH="$(find "$OUTPUTS_DIR" -name 'Modelfile.zion' -type f 2>/dev/null | head -1 || true)"
fi

STAMP="$(date -u +%Y%m%d-%H%M%S)"
WORK_PARENT="${TMPDIR:-/tmp}/hiran-pack-${STAMP}-$$"
PKG_NAME="${RELEASE_SLUG}-release"
STAGE="${WORK_PARENT}/${PKG_NAME}"
mkdir -p "$STAGE"

# Jednotný název GGUF v archivu (podle kvantizace v názvu nebo genericky)
GGUF_BASENAME="$(basename "$GGUF_PATH")"
# Pokud původní název už začíná release slugem, nech ho
if [[ "$GGUF_BASENAME" == "${RELEASE_SLUG}"* ]]; then
  ARCH_GGUF="$GGUF_BASENAME"
else
  # prefix slug pro přehled v ZIPu
  EXT="${GGUF_BASENAME##*.}"
  STEM="${GGUF_BASENAME%.*}"
  ARCH_GGUF="${RELEASE_SLUG}-${STEM}.gguf"
fi

info "Kopíruji GGUF → $STAGE/$ARCH_GGUF"
cp -f "$GGUF_PATH" "$STAGE/$ARCH_GGUF"

PORTABLE_MODELFILE="${STAGE}/Modelfile"
if [[ -n "$MODELFILE_PATH" && -f "$MODELFILE_PATH" ]]; then
  info "Modelfile ze zdroje: $MODELFILE_PATH"
  # Nahradí první FROM řádek portable cestou
  awk -v gguf="./${ARCH_GGUF}" '
    /^FROM / && !done { print "FROM " gguf; done=1; next }
    { print }
  ' "$MODELFILE_PATH" > "$PORTABLE_MODELFILE"
else
  info "Modelfile.zion nenalezen — generuji výchozí šablonu (doplň SYSTEM dle potřeby)."
  cat > "$PORTABLE_MODELFILE" <<EOF
# Hiran release — uprav SYSTEM podle Hiran_v2.1.md oddíl 3.4
FROM ./${ARCH_GGUF}

SYSTEM """Jsi ZION / Hiranyagarbha doménový agent. Držíš technickou přesnost,
kanon V3/ před legacy, a při nejistotě ji přiznáš. Destruktivní kroky navrhuj
jen po explicitním potvrzení uživatele."""

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
PARAMETER stop "<|eot_id|>"
PARAMETER stop "<|end_of_text|>"
EOF
fi

# Base model z LoRA, pokud je k dispozici
BASE_MODEL="unknown"
DEFAULT_LORA="${OUTPUTS_DIR}/zion-llama-lora"
[[ -n "$LORA_DIR" ]] || LORA_DIR="$DEFAULT_LORA"
if [[ -f "${LORA_DIR}/adapter_config.json" ]]; then
  BASE_MODEL="$(
    ADAPTER_CFG="${LORA_DIR}/adapter_config.json" python3 -c \
      'import json,os; p=os.environ["ADAPTER_CFG"]; c=json.load(open(p)); print(c.get("base_model_name_or_path") or c.get("base_model_name") or "unknown")' \
      2>/dev/null || echo unknown
  )"
fi

cat > "${STAGE}/README_INSTALL.md" <<EOF
# Hiran release balíček — instalace na cílovém stroji

## Obsah

- \`${ARCH_GGUF}\` — model (GGUF) pro llama.cpp / Ollama
- \`Modelfile\` — Ollama definice (\`FROM\` je relativní k tomuto adresáři)
- \`MANIFEST.json\` — SHA-256 a metadata
- \`provenance/\` — pokud existuje \`BUILD.txt\` z buildu kurikula (volitelné)

## Ollama (doporučeno)

\`\`\`bash
cd /cesta/k/rozbalene/slozce/${PKG_NAME}
# např. mkdir -p ~/models && unzip ... && cd ~/models/${PKG_NAME}

ollama create ${RELEASE_SLUG} -f Modelfile
ollama run ${RELEASE_SLUG} "Smoke test: co je ZION node?"
\`\`\`

API (OpenAI-kompatibilní): \`http://localhost:11434/v1\` — model \`${RELEASE_SLUG}\`.

## ZION AI Native (Rust)

Nastav stejný název modelu v prostředí služby, např. \`LLM_MODEL\` / \`ZION_LLM_MODEL\`
(dle dokumentace \`V3/L3/ai-native\`) a URL Ollama instance.

## Ověření integrity

\`\`\`bash
# Linux:
grep ${ARCH_GGUF} MANIFEST.json
sha256sum ${ARCH_GGUF}
# macOS:
shasum -a 256 ${ARCH_GGUF}
\`\`\`

Porovnej SHA-256 s hodnotou v \`MANIFEST.json\`.

## Volitelné rozšíření v archivu

- **lora/** — adaptér pro re-merge s base modelem (stejná verze \`transformers\`/\`peft\` jako při tréninku).
- **hf_merged/** — plný HuggingFace sloučený model (velký); pro vlastní kvantizaci nebo jiný runtime.

## Bezpečnost

Do archivu nepatří API klíče, \`.env\`, wallet exporty ani \`.git\`.
EOF

if [[ "$WITH_LORA" -eq 1 ]]; then
  [[ -d "$LORA_DIR" ]] || die "LoRA adresář neexistuje: $LORA_DIR"
  info "Přidávám LoRA: $LORA_DIR → $STAGE/lora/"
  mkdir -p "$STAGE/lora"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude '__pycache__' "$LORA_DIR/" "$STAGE/lora/" || cp -R "$LORA_DIR/." "$STAGE/lora/"
  else
    cp -R "$LORA_DIR/." "$STAGE/lora/"
  fi
fi

if [[ "$WITH_HF_MERGED" -eq 1 ]]; then
  MERGED_CANDIDATE="${OUTPUTS_DIR}/zion-llama-merged"
  [[ -d "$MERGED_CANDIDATE" ]] || die "HF merged neexistuje: $MERGED_CANDIDATE (zadej ručně úpravou skriptu nebo přidej symlink)"
  info "VAROVÁNÍ: balím celý HF merge — může to být 15+ GB."
  mkdir -p "$STAGE/hf_merged"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$MERGED_CANDIDATE/" "$STAGE/hf_merged/" || die "rsync hf_merged selhal"
  else
    cp -R "$MERGED_CANDIDATE/." "$STAGE/hf_merged/" || die "cp hf_merged selhal"
  fi
fi

if [[ -f "${REPO_ROOT}/HiranV2.1/curriculum/meta/BUILD.txt" ]]; then
  mkdir -p "$STAGE/provenance"
  cp -f "${REPO_ROOT}/HiranV2.1/curriculum/meta/BUILD.txt" "$STAGE/provenance/" || true
fi

export PKG_STAGE="$STAGE"
export PKG_SLUG="$RELEASE_SLUG"
export PKG_SOURCE_GGUF="$GGUF_PATH"
export PKG_BASE_MODEL="$BASE_MODEL"
export PKG_WITH_LORA="$WITH_LORA"
export PKG_WITH_HF="$WITH_HF_MERGED"
python3 <<'PY'
import json, os, pathlib, hashlib, datetime
stage = pathlib.Path(os.environ["PKG_STAGE"])
slug = os.environ["PKG_SLUG"]
src_gguf = os.environ["PKG_SOURCE_GGUF"]
base_model = os.environ["PKG_BASE_MODEL"]
with_lora = os.environ["PKG_WITH_LORA"] == "1"
with_hf = os.environ["PKG_WITH_HF"] == "1"

files = []
for p in sorted(stage.iterdir()):
    if not p.is_file() or p.name == "MANIFEST.json":
        continue
    h = hashlib.sha256(p.read_bytes()).hexdigest()
    files.append({"path": p.name, "sha256": h, "size_bytes": p.stat().st_size})

extras = {
    "optional_includes": {"lora": with_lora, "hf_merged": with_hf},
}
if (stage / "lora").is_dir():
    extras["lora_relative"] = "lora/"
    adapter = stage / "lora" / "adapter_model.safetensors"
    if adapter.is_file():
        extras["lora_adapter_model_sha256"] = hashlib.sha256(adapter.read_bytes()).hexdigest()
        extras["lora_adapter_model_bytes"] = adapter.stat().st_size
if (stage / "hf_merged").is_dir():
    extras["hf_merged_relative"] = "hf_merged/"
    extras["hf_merged_note"] = "Adresář není plně checksumovaný v tomto manifestu (objem)."
if (stage / "provenance").is_dir():
    extras["provenance_relative"] = "provenance/"
    prov_files = []
    for pf in sorted((stage / "provenance").glob("*")):
        if pf.is_file():
            prov_files.append(
                {
                    "path": str(pf.relative_to(stage)).replace("\\", "/"),
                    "sha256": hashlib.sha256(pf.read_bytes()).hexdigest(),
                    "size_bytes": pf.stat().st_size,
                }
            )
    if prov_files:
        extras["provenance_files"] = prov_files

manifest = {
    "package_format": 1,
    "created_utc": datetime.datetime.now(datetime.timezone.utc)
    .isoformat()
    .replace("+00:00", "Z"),
    "release_slug": slug,
    "source_gguf": src_gguf,
    "training": {
        "base_model_or_path": base_model,
        "notes": "Pro dataset_hash a release gate viz HiranV2.1/PLAN_v2.1.md a curriculum/meta.",
    },
    "files": files,
    "extras": extras,
}
(stage / "MANIFEST.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
PY

if [[ -z "$OUT_ZIP" ]]; then
  OUT_ZIP="${HOME}/${RELEASE_SLUG}-${STAMP}.zip"
fi

info "Složka release: $STAGE"
if [[ "$NO_ZIP" -eq 1 ]]; then
  echo "$STAGE"
  exit 0
fi

command -v zip >/dev/null 2>&1 || die "Chybí příkaz zip (brew install zip / apt install zip)."
info "Vytvářím ZIP: $OUT_ZIP"
( cd "$WORK_PARENT" && zip -r -q "$OUT_ZIP" "$PKG_NAME" )
info "Hotovo: $OUT_ZIP ($(du -h "$OUT_ZIP" | cut -f1))"
echo "$OUT_ZIP"
