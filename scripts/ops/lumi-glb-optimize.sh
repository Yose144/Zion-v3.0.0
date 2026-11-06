#!/usr/bin/env bash
# Lumi 2 — optimalizace modelu pro web (market).
#
# Zdroj `heros/shop/Lumi/Lumi_2.glb` má 12 MB: pozice i normály v `f32`,
# indexy v `u32` a vrcholy rozdělené mezi 19 primitiv. Pro náhled v prohlížeči
# je to zbytečné — `gltf-transform` model svaří, zkvantuje (`int16` pozice,
# `int8` normály) a zabalí `EXT_meshopt_compression`. Výsledek je ~1,9 MB,
# tedy šestinový, a **tvar zůstává**: `--simplify false`, protože stěny jsou
# tenké laserované ornamenty, kde každá hrana něco drží.
#
# Co se NESMÍ ztratit:
#   1. **tři materiály** (`Překližka` / `Řez` / `Gravír`) — nesou opálenou hranu
#      laseru a tmavý gravír; kdyby se slily do jednoho, lampion zplastovatí,
#   2. **měřítko a orientace** (metry, Y-up, dno v y=0) — `Lantern3D` z bboxu
#      počítá kameru a staví svíčku na dno,
#   3. **DoubleSide** — destičky jsou otevřené plochy, mezerami je vidět rub.
#
# Meshopt znamená, že prohlížeč musí mít dekodér:
# `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)` z
# `three/examples/jsm/libs/meshopt_decoder.module.js` (je součástí `three`,
# nic se nedotahuje ze sítě). Když se model nahradí nekomprimovaným,
# dekodér jen zůstane nevyužitý — nic se nerozbije.
#
# Použití:
#   bash scripts/ops/lumi-glb-optimize.sh
#   bash scripts/ops/lumi-glb-optimize.sh --src <in.glb> --out <out.glb>
#
# Vyžaduje síť jen při prvním běhu (`npx` stáhne `@gltf-transform/cli@4`).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/heros/shop/Lumi/Lumi_2.glb"
OUT="$ROOT/apps/MarketPlace/public/models/lumi-2.glb"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --src) SRC="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    -h|--help) sed -n '1,40p' "$0"; exit 0 ;;
    *) echo "neznámý argument: $1" >&2; exit 2 ;;
  esac
done

[[ -f "$SRC" ]] || { echo "chybí zdroj: $SRC" >&2; exit 1; }
mkdir -p "$(dirname "$OUT")"

echo "zdroj:  ${SRC#"$ROOT"/}"
npx --yes @gltf-transform/cli@4 optimize "$SRC" "$OUT" \
  --compress meshopt \
  --simplify false \
  --texture-compress false

python3 - "$SRC" "$OUT" <<'PY'
"""Kontrola, že optimalizace nezměnila měřítko ani materiály."""
import json
import struct
import sys


def read_glb(path):
    with open(path, 'rb') as handle:
        magic, version, length = struct.unpack('<III', handle.read(12))
        if magic != 0x46546C67 or version != 2:
            raise SystemExit(f'{path}: není GLB 2.0')
        chunk_length, _ = struct.unpack('<II', handle.read(8))
        document = json.loads(handle.read(chunk_length))
    return length, document


def quaternion_matrix(q):
    """Kvaternion (x, y, z, w) → rotační matice 3×3."""
    x, y, z, w = q
    return [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]


def node_transform(node):
    """(matice 3×3, translace) z TRS uzlu."""
    rotation = node.get('rotation')
    matrix = quaternion_matrix(rotation) if rotation else [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    scale = node.get('scale') or [1, 1, 1]
    matrix = [[matrix[row][col] * scale[col] for col in range(3)] for row in range(3)]
    return matrix, node.get('translation') or [0, 0, 0]


def apply(matrix, translation, point):
    return [
        sum(matrix[row][col] * point[col] for col in range(3)) + translation[row]
        for row in range(3)
    ]


def bounds(document):
    """World-space bbox — kvantizace drží měřítko v transformu uzlu."""
    low = [1e9, 1e9, 1e9]
    high = [-1e9, -1e9, -1e9]
    nodes = document.get('nodes', [])

    def walk(index, matrix, translation):
        node = nodes[index]
        local_matrix, local_translation = node_transform(node)
        world_matrix = [
            [sum(matrix[row][k] * local_matrix[k][col] for k in range(3)) for col in range(3)]
            for row in range(3)
        ]
        world_translation = apply(matrix, translation, local_translation)

        if 'mesh' in node:
            for primitive in document['meshes'][node['mesh']].get('primitives', []):
                accessor = document['accessors'][primitive['attributes']['POSITION']]
                # KHR_mesh_quantization: celočíselné pozice se dělí rozsahem
                # podle `normalized`; skutečné měřítko nese transform uzlu.
                divisor = 1.0
                if accessor.get('normalized'):
                    divisor = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}[
                        accessor['componentType']
                    ]
                for corner in range(8):
                    point = [
                        (accessor['max'][axis] if corner & (1 << axis) else accessor['min'][axis])
                        / divisor
                        for axis in range(3)
                    ]
                    world = apply(world_matrix, world_translation, point)
                    for axis in range(3):
                        low[axis] = min(low[axis], world[axis])
                        high[axis] = max(high[axis], world[axis])

        for child in node.get('children', []):
            walk(child, world_matrix, world_translation)

    for scene in document.get('scenes', []):
        for root in scene.get('nodes', []):
            walk(root, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0, 0, 0])

    return low, high


source_bytes, source = read_glb(sys.argv[1])
target_bytes, target = read_glb(sys.argv[2])
source_low, source_high = bounds(source)
target_low, target_high = bounds(target)
drift = max(
    [abs(source_low[axis] - target_low[axis]) for axis in range(3)]
    + [abs(source_high[axis] - target_high[axis]) for axis in range(3)]
)

source_materials = [m.get('name') for m in source.get('materials', [])]
target_materials = [m.get('name') for m in target.get('materials', [])]

print(f'velikost: {source_bytes / 1048576:.2f} MB → {target_bytes / 1048576:.2f} MB '
      f'({100 * target_bytes / source_bytes:.0f} %)')
print(f'bbox drift: {drift * 1000:.3f} mm (kvantizace; musí být < 0,1 mm)')
print(f'materiály: {", ".join(target_materials)}')
print(f'rozšíření: {", ".join(target.get("extensionsUsed", [])) or "žádná"}')

problems = []
if drift > 0.0001:
    problems.append('bbox se posunul víc než 0,1 mm — zkontroluj kvantizaci')
if len(target_materials) != len(source_materials):
    problems.append('počet materiálů se změnil — lampion ztratí opálené hrany')
if 'EXT_meshopt_compression' not in target.get('extensionsUsed', []):
    problems.append('chybí meshopt komprese — model je zbytečně velký')
if target_bytes > 3 * 1048576:
    problems.append('výsledek je nad 3 MB — zkontroluj, co se přibalilo')

if problems:
    for problem in problems:
        print(f'CHYBA: {problem}', file=sys.stderr)
    raise SystemExit(1)

print('OK: model je použitelný pro market.')
PY

echo "zapsáno: ${OUT#"$ROOT"/}"
