#!/usr/bin/env python3
"""
Marketplace → Nirvana: stíhačky z dřevěných kitů jako herní GLB.

Marketplace prodává **laser-cut skládačky z překližky** (`apps/MarketPlace/
public/shop/models/*.stl`). Každá loď je 1 200–4 400 samostatných destiček
tloušťky 0,4–1 mm, otevřené plochy (žádný objem, nejsou watertight), bez UV,
bez materiálu a bez oddělených částí. Do hry se v téhle podobě vzít nedají:

  * 4 429 destiček = 4 429 meshů = 4 429 draw callů,
  * měřítko se rozchází (x-wing je v mm, zbytek v cm),
  * osy nejsou sjednocené (nos jednou podél X, jinde podél Y).

Skript proto dělá čtyři věci:

1. **Slije destičky do jednoho meshe** (jeden draw call na loď).
2. **Srovná orientaci** — nos = +Z, nahoru = +Y (`SHIPS` níž je ruční tabulka;
   heuristika z tvaru je jen výchozí odhad, rozhoduje pohled na render).
3. **Normalizuje měřítko** — délka trupu = 1,0 jednotky; měřítko do scény
   řeší až `core/fleet/ships.ts`, aby šlo ladit bez přegenerování.
4. **Namaluje panely do vrcholových barev.** Tohle je jádro vizuálu: skládačka
   je *už* rozdělená na destičky, takže každá destička může dostat vlastní
   odstín laku, aniž bychom potřebovali texturu nebo UV. Panelové plátování
   tím vznikne samo — zdarma, jedním draw callem a bez dopadu na strop
   textur (Nirvana má 21/32).

Postup je záměrně **bez textur**: `MeshStandardMaterial` + `vertexColors` +
`side: DoubleSide` (destičky jsou otevřené plochy, takže mezerami mezi nimi
je vidět na rub — a to je přesně ta spára, kterou by jinak kreslila textura).

Použití:
    python3 scripts/ops/starfighter-glb.py              # všech 7 lodí
    python3 scripts/ops/starfighter-glb.py --only xwing # jedna loď
    python3 scripts/ops/starfighter-glb.py --report     # jen tabulka, nic nezapisuje

Vstup:  apps/MarketPlace/public/shop/models/<id>.stl
Výstup: apps/nirvana/public/models/fleet/<id>.glb
        scripts/ops/starfighter-glb.json  (manifest: tris, rozměry, kotvy motorů)
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import struct
import sys

import numpy as np
import trimesh

REPO = pathlib.Path(__file__).resolve().parents[2]
SRC = REPO / 'apps/MarketPlace/public/shop/models'
# Modely musí ležet pod `/models` — jen ten prefix je v middleware veřejný
# (jinak by GLB request dostal 307 na ZAP bránu a loader by načetl HTML).
OUT = REPO / 'apps/nirvana/public/models/fleet'
MANIFEST = REPO / 'scripts/ops/starfighter-glb.json'

# ── tabulka orientace ───────────────────────────────────────────────────────
# `nose`/`up` = která osa zdrojového STL se má stát nosem (+Z) a „nahoru" (+Y).
# `flip` = otočit o 180° kolem osy nahoru (zdroj má nos na opačném konci).
# `roll` = dorovnání křídel do roviny (stupně, kolem nosu).
#
# Hodnoty nejsou odhad z kódu — jsou ověřené pohledem na turnaround render
# (`scripts/ops/fleet-render/`). Když se model vymění, tabulka se musí
# zkontrolovat znovu; špatné znaménko znamená, že loď letí pozadu.
SHIPS: list[dict] = [
    # id            nose up  flip  roll   jméno v marketu
    dict(id='awing', nose='y', up='z', flip=False, roll=0, name='A-Wing'),
    dict(id='bwing', nose='y', up='z', flip=False, roll=0, name='B-Wing'),
    dict(id='ikaruga', nose='y', up='z', flip=True, roll=0, name='Ikaruga'),
    dict(id='snowspeeder', nose='x', up='z', flip=True, roll=0, name='Snowspeeder'),
    dict(id='tiefighter', nose='y', up='z', flip=False, roll=0, name='TIE Fighter'),
    dict(id='tieinterceptor', nose='y', up='z', flip=False, roll=0, name='TIE Interceptor'),
    dict(id='xwing', nose='x', up='z', flip=True, roll=0, name='X-Wing'),
]

AXES = {'x': np.array([1.0, 0.0, 0.0]), 'y': np.array([0.0, 1.0, 0.0]), 'z': np.array([0.0, 0.0, 1.0])}

# ── paleta laku ─────────────────────────────────────────────────────────────
# Ocelová šedá, jak ji má Nabukano (`#22384f` / `#3d5570`) a Issobella
# (`#f0f3f7` / `#e8c56a`): lodě z marketu mají být stejná flotila, ne cizí
# assety. Akcenty (zlato, tmavá modř) jen na malých destičkách — kdyby je
# dostala každá pátá, vznikl by z toho vzor, ne plátování.
HULL = [
    (0.52, 0.56, 0.62),
    (0.44, 0.48, 0.55),
    (0.60, 0.63, 0.68),
    (0.38, 0.42, 0.50),
    (0.48, 0.51, 0.56),
]
DARK = (0.16, 0.19, 0.24)
GOLD = (0.72, 0.55, 0.24)
ENGINE = (0.95, 0.62, 0.28)

# prahy pro regionální pravidla (podíl délky trupu od přídě)
# Cílová velikost LOD vůči plnému modelu (35 % drží vzhled; 20 % už řeže křídla).
LOD_RATIO = 0.35

ENGINE_ZONE = -0.40  # záď: za tuhle hranici (z < ENGINE_ZONE) a blízko osy
ENGINE_RADIUS = 0.10
COCKPIT_ZONE = 0.22  # příď: odsud dopředu a vysoko = sklo


def cluster_lod(
    vertices: np.ndarray,
    faces: np.ndarray,
    colors: np.ndarray,
    target_faces: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Zjednodušení mřížkou (vertex clustering) na cílový počet ploch.

    Proč zrovna clustering: model je soubor tenkých destiček, takže quadrická
    dekurace (z Lumi lucerny) na nich končí na 65 % a vrací nekonzistentní
    indexy. Mřížka je robustní a **říditelná** — hledá se nejmenší kvantum,
    které se vejde do stropu, takže se dá přesně trefit rozpočet.

    Barvy se průměrují po buňkách; jinak by po slití panelů zůstal lak
    z jednoho kusu a model by vypadal flekatě.
    """
    best: tuple[np.ndarray, np.ndarray, np.ndarray] | None = None
    quantum = 0.0025
    while quantum < 0.12:
        keys = np.round(vertices / quantum).astype(np.int64)
        _, first, inverse = np.unique(keys, axis=0, return_index=True, return_inverse=True)
        if len(first) < 3:
            quantum *= 1.35
            continue
        new_colors = np.zeros((len(first), 3), dtype=np.float64)
        counts = np.zeros(len(first), dtype=np.float64)
        np.add.at(new_colors, inverse, colors)
        np.add.at(counts, inverse, 1.0)
        new_colors /= counts[:, None]

        mapped = inverse[faces]
        keep = (
            (mapped[:, 0] != mapped[:, 1])
            & (mapped[:, 1] != mapped[:, 2])
            & (mapped[:, 0] != mapped[:, 2])
        )
        mapped = mapped[keep]
        if len(mapped) == 0:
            quantum *= 1.35
            continue
        # tatáž plocha může vzniknout vícekrát — zahoď duplicity
        _, unique_index = np.unique(np.sort(mapped, axis=1), axis=0, return_index=True)
        mapped = mapped[np.sort(unique_index)]

        best = (vertices[first], mapped, new_colors)
        if len(mapped) <= target_faces:
            break
        quantum *= 1.35

    if best is None:
        return vertices, faces, colors
    return best


def srgb_to_linear(color: np.ndarray) -> np.ndarray:
    """Paleta je napsaná jako sRGB (jak ji vidí oko v CSS), glTF `COLOR_0`
    je ale **lineární**. Bez převodu je lak o dva stupně světlejší a scéna
    je přesvětlená — přesně to byl druhý nález z renderu."""
    color = np.clip(np.asarray(color, dtype=np.float64), 0.0, 1.0)
    return np.where(color <= 0.04045, color / 12.92, ((color + 0.055) / 1.055) ** 2.4)


def hash01(*values: float) -> float:
    """Deterministický šum — stejná loď musí vypadat při každém běhu stejně."""
    h = 2166136261
    for value in values:
        bits = struct.unpack('<Q', struct.pack('<d', float(value)))[0]
        for shift in range(0, 64, 8):
            h ^= (bits >> shift) & 0xFF
            h = (h * 16777619) & 0xFFFFFFFF
    return (h & 0xFFFFFF) / 0xFFFFFF


def rotate_into_place(points: np.ndarray, nose: str, up: str, flip: bool, roll: float) -> np.ndarray:
    """Přenese zdrojové osy na nos=+Z, nahoru=+Y (pravotočivá báze)."""
    nose_vec = AXES[nose].copy()
    up_vec = AXES[up].copy()
    if flip:
        nose_vec = -nose_vec
    side = np.cross(up_vec, nose_vec)
    # v' = (v·side, v·up, v·nose)
    basis = np.stack([side, up_vec, nose_vec])
    out = points @ basis.T
    if roll:
        angle = math.radians(roll)
        cos, sin = math.cos(angle), math.sin(angle)
        matrix = np.array([[cos, -sin, 0.0], [sin, cos, 0.0], [0.0, 0.0, 1.0]])
        out = out @ matrix.T
    return out


def vertex_normals(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Ploché normály po destičkách (plocha je planární, tak se průměr rovná ploše).

    Sousední destičky se nesdílí vrcholy, takže průměrování nikdy nepřeteče
    mezi díly — hrana mezi trupem a křídlem zůstane tvrdá.
    """
    triangles = vertices[faces]
    face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    # délka = 2× plocha, takže větší plochy mají v průměru větší váhu
    normals = np.zeros_like(vertices)
    for corner in range(3):
        np.add.at(normals, faces[:, corner], face_normals)
    lengths = np.linalg.norm(normals, axis=1)
    lengths[lengths == 0] = 1.0
    return normals / lengths[:, None]


def write_glb(
    path: pathlib.Path,
    positions: np.ndarray,
    normals: np.ndarray,
    colors: np.ndarray,
    indices: np.ndarray,
) -> None:
    """Zapíše GLB s pozicemi, normálami, barvami a indexy.

    Proč vlastní writer a ne `trimesh.export`: trimesh 5.2 zapíše do glTF
    **jen `POSITION`** — normály ani vrcholové barvy ne. Model pak ve hře
    nemá odlesky (chybí `NORMAL`) a lak je černý (chybí `COLOR_0`), přesně
    jak to vypadalo na prvním renderu. Dva accessor navíc je jednodušší než
    dohánět chování exportéru.

    Formát: 12b hlavička + JSON chunk + BIN chunk, vše zarovnané na 4 B.
    """
    positions = np.ascontiguousarray(positions, dtype='<f4')
    normals = np.ascontiguousarray(normals, dtype='<f4')
    colors = np.ascontiguousarray(np.clip(colors, 0.0, 1.0), dtype='<f4')
    indices = np.ascontiguousarray(indices.reshape(-1), dtype='<u4')

    blobs = [positions.tobytes(), normals.tobytes(), colors.tobytes(), indices.tobytes()]
    views = []
    offset = 0
    for blob in blobs:
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(blob)})
        padding = (-len(blob)) % 4
        offset += len(blob) + padding
    binary = b''
    for blob in blobs:
        binary += blob + b'\x00' * ((-len(blob)) % 4)

    document = {
        'asset': {'version': '2.0', 'generator': 'scripts/ops/starfighter-glb.py'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': [{'name': path.stem, 'mesh': 0}],
        'meshes': [
            {
                'name': path.stem,
                'primitives': [
                    {
                        'attributes': {'POSITION': 0, 'NORMAL': 1, 'COLOR_0': 2},
                        'indices': 3,
                        'material': 0,
                        'mode': 4,
                    }
                ],
            }
        ],
        # materiál je jen nápověda pro prohlížeče GLB; hra i render si nastavují
        # vlastní `MeshStandardMaterial` (vertexColors + DoubleSide)
        'materials': [
            {
                'name': 'painted-hull',
                'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.3, 'roughnessFactor': 0.42},
                'doubleSided': True,
            }
        ],
        'buffers': [{'byteLength': len(binary)}],
        'bufferViews': views,
        'accessors': [
            {
                'bufferView': 0,
                'componentType': 5126,
                'count': len(positions),
                'type': 'VEC3',
                'min': positions.min(axis=0).tolist(),
                'max': positions.max(axis=0).tolist(),
            },
            {'bufferView': 1, 'componentType': 5126, 'count': len(normals), 'type': 'VEC3'},
            {'bufferView': 2, 'componentType': 5126, 'count': len(colors), 'type': 'VEC3'},
            {'bufferView': 3, 'componentType': 5125, 'count': len(indices), 'type': 'SCALAR'},
        ],
    }

    json_chunk = json.dumps(document, separators=(',', ':')).encode('utf-8')
    json_chunk += b' ' * ((-len(json_chunk)) % 4)
    total = 12 + 8 + len(json_chunk) + 8 + len(binary)
    path.write_bytes(
        struct.pack('<III', 0x46546C67, 2, total)
        + struct.pack('<II', len(json_chunk), 0x4E4F534A)
        + json_chunk
        + struct.pack('<II', len(binary), 0x004E4942)
        + binary
    )


def orient_outward(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Srovná normály destiček tak, aby mířily od středu trupu ven.

    Skládačka je soubor **otevřených** ploch: každá destička je jen mřížka
    trojúhelníků bez rubu a líc, takže polovina jich má normálu obrácenou
    dovnitř. Ve hře se to projeví jako černé fleky — plocha se osvětlí, jako
    by světlo přicházelo z nitra trupu (přesně to bylo vidět na prvním
    renderu: příď černá, záď bílá, přitom obě jsou osvětlené stejně).

    Tohle není fyzikálně správné srovnání (vnitřní strana pláště by měla
    mířit dovnitř), ale je to **vizuálně správné**: loď je zvenku a chceme,
    aby každá destička měla světlo na straně, na kterou se díváme.
    """
    if len(faces) == 0:
        return faces
    triangles = vertices[faces]
    normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    centroids = triangles.mean(axis=1)
    center = (vertices.max(axis=0) + vertices.min(axis=0)) / 2
    outward = np.einsum('ij,ij->i', normals, centroids - center) < 0
    flipped = faces.copy()
    flipped[outward] = flipped[outward][:, [0, 2, 1]]
    return flipped


def weld(vertices: np.ndarray, faces: np.ndarray, quantum: float = 2e-5) -> tuple[np.ndarray, np.ndarray]:
    """Slije shodné vrcholy v rámci jedné destičky (kvantizace na 0,02 mm).

    Destička je planární, takže slití nic nezkazí — naopak z kvádru udělá
    8 vrcholů místo 12 a z plochy 4 místo 6. Bez toho by GLB mělo ~70 k
    vrcholů na loď a zbytečně by se stahovalo.
    """
    if len(faces) == 0:
        return vertices[:0], faces
    keys = np.round(vertices / quantum).astype(np.int64)
    # unikátní řádky + inverzní index
    _, first, inverse = np.unique(keys, axis=0, return_index=True, return_inverse=True)
    order = np.argsort(first)
    remap = np.empty_like(order)
    remap[order] = np.arange(len(order))
    # `inverse` ukazuje do `first`; převeď na indexy v novém (seřazeném) pořadí
    lookup = np.empty(len(first), dtype=np.int64)
    lookup[order] = remap
    new_faces = lookup[inverse][faces]
    return vertices[first[order]], new_faces


def part_color(part: trimesh.Trimesh, centroid: np.ndarray, extent: np.ndarray, area: float) -> np.ndarray:
    """Barva jedné destičky — plátování, regiony a lakování.

    Pořadí pravidel je záměrné: regiony (motor, kabina) mají přednost před
    šumem, jinak by náhodná destička uprostřed trysky zhasla.
    """
    length = max(extent[2], 1e-6)
    z = centroid[2] / length
    lateral = math.hypot(centroid[0], centroid[1])
    small = area < 0.0016

    # 1) motorová sekce — záď blízko osy. Kryt motoru je **tmavý kov**, ne
    #    oheň: světlo trysek dodává až scéna (aditivní sprity). Kdyby záď
    #    svítila už v modelu, půlka trupu vypadá jako pochodeň.
    if z < ENGINE_ZONE and lateral < ENGINE_RADIUS:
        if small:
            return np.array(ENGINE) * (0.8 + 0.2 * hash01(centroid[0], centroid[2], 7.0))
        return np.array((0.19, 0.21, 0.24))

    # 2) kabina — příď, vysoko, ale ne špička
    if z > COCKPIT_ZONE and centroid[1] > 0.10:
        if hash01(centroid[0], centroid[1], 13.0) > 0.55:
            return np.array((0.10, 0.16, 0.24))

    # 3) malé destičky = označení, občas zlato nebo tmavá modř
    if small:
        roll = hash01(centroid[0], centroid[1], 17.0)
        if roll > 0.90:
            return np.array(GOLD)
        if roll > 0.80:
            return np.array(DARK)

    # 4) základní lak: odstín z palety + jemný šum, ať se panely nelesknou stejně
    base = np.array(HULL[int(hash01(centroid[0], centroid[2], 3.0) * len(HULL)) % len(HULL)])
    base = base * (0.94 + 0.12 * hash01(centroid[1], centroid[2], 29.0))

    # 5) fake AO: spodek trupu tmavší, hřbet světlejší (světlo jde shora)
    vertical = centroid[1] / max(extent[1] / 2, 1e-6)
    base = base * (1.0 + 0.10 * max(-1.0, min(1.0, vertical)))

    return np.clip(base, 0.0, 1.0)


def build_ship(spec: dict) -> dict:
    source = SRC / f"{spec['id']}.stl"
    if not source.exists():
        raise SystemExit(f"chybí {source}")

    mesh = trimesh.load(source, force='mesh')
    parts = mesh.split(only_watertight=False)
    if not parts:
        raise SystemExit(f"{source.name}: žádné díly")

    # orientace + normalizace se počítají z celku, aby seděly na všechny díly
    raw = np.vstack([np.asarray(p.vertices) for p in parts])
    rotated = rotate_into_place(raw, spec['nose'], spec['up'], spec['flip'], spec['roll'])
    extent = rotated.max(axis=0) - rotated.min(axis=0)
    length = float(extent[2]) or 1.0
    center = (rotated.max(axis=0) + rotated.min(axis=0)) / 2
    scale = 1.0 / length

    all_vertices: list[np.ndarray] = []
    all_faces: list[np.ndarray] = []
    all_colors: list[np.ndarray] = []
    offset = 0
    panels = 0

    for part in parts:
        vertices = rotate_into_place(np.asarray(part.vertices), spec['nose'], spec['up'], spec['flip'], spec['roll'])
        vertices = (vertices - center) * scale
        faces = np.asarray(part.faces)
        if len(faces) == 0:
            continue

        centroid = vertices.mean(axis=0)
        area = float(part.area) * (scale ** 2)
        color = part_color(part, centroid, np.array([e * scale for e in extent]), area)
        # jiskra po destičkách: sousední kusy laku se nelesknou stejně
        color = np.clip(color * (0.96 + 0.08 * hash01(centroid[0], centroid[1], 5.0)), 0.0, 1.0)

        unique_vertices, unique_faces = weld(vertices, faces)

        all_vertices.append(unique_vertices)
        all_faces.append(unique_faces + offset)
        all_colors.append(np.tile(srgb_to_linear(color), (len(unique_vertices), 1)))
        offset += len(unique_vertices)
        panels += 1

    vertices = np.vstack(all_vertices)
    faces = np.vstack(all_faces)
    colors = np.vstack(all_colors)

    faces = orient_outward(vertices, faces)
    normals = vertex_normals(vertices, faces)

    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{spec['id']}.glb"
    write_glb(target, vertices, normals, colors, faces)

    # ── LOD pro cizí lodě v místnosti ──────────────────────────────────
    # Vlastní loď = plná kvalita, ostatní = ~35 %. Naměřeno: plná místnost
    # (6 pilotů) byla 109 755 tris ze stropu 120 000, takže na mobilu
    # nezbývala rezerva. LOD je jen pro vzdálené/pohyblivé lodě, kde rozdíl
    # není vidět — viz `RemoteFleet` v `FleetScene`.
    lod_target = max(2500, int(len(faces) * LOD_RATIO))
    lod_vertices, lod_faces, lod_colors = cluster_lod(vertices, faces, colors, lod_target)
    lod_faces = orient_outward(lod_vertices, lod_faces)
    lod_normals = vertex_normals(lod_vertices, lod_faces)
    (OUT / 'lod').mkdir(exist_ok=True)
    lod_target_path = OUT / 'lod' / f"{spec['id']}.glb"
    write_glb(lod_target_path, lod_vertices, lod_normals, lod_colors, lod_faces)

    bbox = np.stack([vertices.min(axis=0), vertices.max(axis=0)])

    return {
        'id': spec['id'],
        'name': spec['name'],
        'file': f"/models/fleet/{spec['id']}.glb",
        'triangles': int(len(faces)),
        'vertices': int(len(vertices)),
        'panels': panels,
        # délka trupu = 1,0; šířka/výška v jednotkách délky (pro měřítko ve scéně)
        'width': round(float(bbox[1][0] - bbox[0][0]), 4),
        'height': round(float(bbox[1][1] - bbox[0][1]), 4),
        'length': round(float(bbox[1][2] - bbox[0][2]), 4),
        'bytes': target.stat().st_size,
        'glbLod': f"/models/fleet/lod/{spec['id']}.glb",
        'lodTriangles': int(len(lod_faces)),
        'lodBytes': lod_target_path.stat().st_size,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='STL skládačky → herní GLB pro Nirvanu')
    parser.add_argument('--only', help='jen jedno id')
    parser.add_argument('--report', action='store_true', help='jen tabulka, nic nezapisuje')
    args = parser.parse_args()

    specs = [s for s in SHIPS if not args.only or s['id'] == args.only]
    if not specs:
        raise SystemExit(f"neznámé id: {args.only}")

    if args.report:
        for spec in specs:
            mesh = trimesh.load(SRC / f"{spec['id']}.stl", force='mesh')
            print(f"{spec['id']:16s} tris={len(mesh.faces):6d} bbox={np.round(mesh.extents, 1)}")
        return 0

    entries = []
    for spec in specs:
        entry = build_ship(spec)
        entries.append(entry)
        print(
            f"{entry['id']:16s} tris={entry['triangles']:6d} verts={entry['vertices']:6d} "
            f"panels={entry['panels']:5d} size={entry['bytes'] / 1048576:5.2f} MB "
            f"w×h×l={entry['width']:.2f}×{entry['height']:.2f}×{entry['length']:.2f}"
        )

    if args.only:
        existing = json.loads(MANIFEST.read_text())['ships'] if MANIFEST.exists() else []
        merged = {ship['id']: ship for ship in existing}
        merged.update({ship['id']: ship for ship in entries})
        entries = [merged[key] for key in sorted(merged)]

    MANIFEST.write_text(
        json.dumps(
            {
                'note': 'Marketplace STL skládačky → herní GLB. Generuje scripts/ops/starfighter-glb.py, needitovat ručně.',
                'source': 'apps/MarketPlace/public/shop/models',
                'ships': entries,
            },
            indent=2,
            ensure_ascii=False,
        )
        + '\n'
    )
    total = sum(entry['triangles'] for entry in entries)
    print(f"\nmanifest: {MANIFEST.relative_to(REPO)} · {len(entries)} lodí · {total} trojúhelníků")
    return 0


if __name__ == '__main__':
    sys.exit(main())
