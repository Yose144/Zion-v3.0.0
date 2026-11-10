# Plán: generace 202 3D avatarů na GTX 1070 Ti (PC)

**Stav: návrh (2026-11-08), čeká na bránu G0.** Kořenový plán výroby celé dávky
202 postav na operátorově PC s GTX 1070 Ti (8 GB VRAM, CUDA), zatímco QA, rig a
nasazení zůstávají na M1. Doplňuje `PLAN_3D_AVATARI_NIRVANA.md` (cíle, licence,
herní rozpočet) a `docs/3.2/AVATAR-3D-PIPELINE.md` (naměřená M1 pipeline).
Automat nespouští žádný krok mimo brány uvedené níže.

## 0. Proč PC a co tenhle plán řeší

- **M1 strop.** Sweep šesti variant TripoSR (MC 192–384, textura 1024–2048,
  15k/24k tris) skončil na průměrném CLIP skóre 0,569 (runbook §9c). Více
  polygonů ani vyšší MC nepomohlo — tvář a atributy (flétna, peříčko) zůstávají
  rozmazané, protože TripoSR vidí jen jeden pohled a vnitřní pole má rozlišení 256³.
- **Co potřebujeme:** vícepohledovou rekonstrukci. Bezplatná open-source volba
  vhodná pro 8 GB CUDA je **InstantMesh** (Zero123++ generuje šest pohledů,
  FlexiCubes postaví síť).
- **Cíl:** generovat na PC v dávkách po 25 (podle dodaných ZIPů listů), na Macu
  QA a rig, do hry jen po lidském schválení.


## 0b. Stav pilotu (2026-11-08)

- **M1 série 01–03 (hotovo 2026-11-09):** tři dávky, **74 modelů** vygenerováno
  a rignuto (MC 320 + textura 2048, 15k tris) s QA a CLIP:
  dávka 01 **25/25** (CLIP 0,600), dávka 02 **24/24** (0,624), dávka 03 **25/25**
  (0,627). Manifesty: `.artifacts/avatar-3d/batch-0{1,2,3}/manifest.json`,
  kontrolní listy `qa-1..3/`. Do hry zatím nic — čeká na schválení podoby.
- **Výjimky série:** 037 Gándhí nemá list (generátor odmítl; jen originál a
  zadání), 055 Hunahpú & Xbalanqué jsou dvě postavy v jednom listu (bez rigu),
  044 Hiranyagarbha je artefakt (bez rigu).
- **Nasaženo 2026-11-10** do Nirvany: commit `df9e77870` (74 GLB +
  `models.ts`), deploy `20261110T090830Z` z čistého worktree na HEAD
  (proto 32 = živý net), smoke OK; produkce servíruje
  `/models/avatars/<id>.glb` (ověřeno 206 na 0/23/44/55/74/77).
- **TRELLIS.2 pilot (Krišna):** ověřen přes oficiální HF Space — kvalitativně
  jasně lepší (CLIP průměr **0,688** vs 0,569 M1; anatomicky správná postava).
  Detail v `docs/3.2/AVATAR-3D-PIPELINE.md` §9d.
- **Blokátor:** TRELLIS.2 táhne gated `facebook/dinov3-vitl16`; účet má žádost
  odeslanou, čeká na schválení. Bez ní nejde vlastní GPU běh (Space má denní
  kvótu 1 běh).
- **Po schválení:** pronajmout 4090, spustit `scripts/ops/avatar-3d/vast/trellis-setup.sh`,
  projet 003 a 051 + export 30k/2048 (Space má minimum decimace 100k).
- Náklady pilotu: **~4 USD** (dvě 4090 instance; druhá běžela omylem ~10 h —
  vast ji zrušil až po vyčerpání kreditu). Nyní 0 instancí a **kredit vyčerpán**:
  další GPU běh vyžaduje dobití (řádově $5–10 stačí na celou dávku 202).
- **Hunyuan3D-2.1** odzkoušen funkčně (shape 27–30 s, textura 148–221 s), ale
  výstupy se ztratily při zrušení instance; setup je hotový a opakovatelný
  (`scripts/ops/avatar-3d/vast/hunyuan-setup2.sh`).

## 1. Výchozí fakta (naměřená, ne odvozená)

| Co | Hodnota |
|---|---|
| M1 strop kvality (best CLIP avg) | 0,569 (TripoSR MC 320 + textura 2048, 15k tris) |
| M1 čas na jednu postavu | 292 s (infer 2,3 s + MC extraction 147 s + bake 139 s) |
| TripoSR checkpoint | 1,68 GB (`stabilityai/TripoSR`) |
| InstantMesh stahování | ~4–5 GB (Zero123++ + InstantMesh-base) |
| GTX 1070 Ti | 8 GB VRAM, Pascal (CC 6.1), Windows |
| Disk na Macu | ~11 GiB volné; na PC musí být ≥ 12 GB volné |

## 2. Role strojů

| Role | Stroj | Území |
|---|---|---|
| **Generace** | PC (GTX 1070 Ti) | generuje modely v dávkách (P0–P3), uploaduje na EDGE2 |
| **Postprocessing** | Mac (M1, tato session) | QA mosaiky, CLIP sort, rig, nasazení do Nirvany |
| **Přeprava** | EDGE2 `/opt/zion/avatar-staging/` | přeprava PC→Mac (scp/rsync); nic z PC nepushuje přímo do repa |
| **Rozhodnutí** | 👤 operátor | brány G0/G1/G2 (schvaluje podobu a dávky) |

## 3. Kritické pravidlo: sdílení GPU

GTX 1070 Ti je obsazená Hiran inference (~6,9 GB VRAM, `zion-hiran-cuda` :8071)
a coder modelem (:8072). Před generací:

1. Zastavit `zion-hiran-cuda` a `zion-coder-cuda`
   (`net stop …`, nebo vypnout jejich `llama-server.exe` process).
2. Mining nezasahujeme — běží na RX 5600 XT, na 1070 Ti se v tu dobu nic netěží.
3. Hiran chat nikdy nevypneme — EDGE2 CPU fallback (LLM_BASE_URL :8002)
   zůstává běžet, takže chat přežije outage inference na PC.
4. Ověření před startem: `nvidia-smi --query-gpu=memory.used --format=csv`
   musí být < 200 MiB.

## 4. Dvě trasy generátora

### Trasa A — InstantMesh (preferovaná kvalita)

- Upstream: `https://github.com/TencentARC/InstantMesh` (licence Apache-2.0 —
  ověřit `LICENSE` v klonu); váhy z HF (Zero123++ + InstantMesh-base).
- PLUS: výrazně čitelnější tvář, silueta i pravotočení (více pohledů místo
  jedné fotografie) — dosud nejkvalitnější bezplatná cesta pro slabší GPU.
- Riziko 1: VRAM — InstantMesh-base potřebuje ~6–8 GB; držet se `base` configu,
  `large` zkusit jen když P0 prokáže dostatečnou rezervu.
- Riziko 2: bake textury používá nvdiffrast → na Windows vyžaduje MSVC + CUDA
  SDK. **Plán B:** generovat síť bez textury (`--no-texture`, vertex colors)
  a případný bake přenechat trase B.

### Trasa B — Fallback: TripoSR na CUDA

- Stejný patchovaný klon TripoSR, co na M1 — jediné změny: CUDA wheel +
  `--device cuda`.
- Expected: **30–60 s / postava** → dávka 25 ≈ 15–30 min, celé 202 ≈ 2–3 h
  na jednom PC. Kvalita = strop M1 (0,569), slouží jako pojistná cesta a jako
  **základní model pro batch, až když trasa A neudrží VRAM / build selže**.

Trasy sdílí stejný postprocess (decimace, bake, rig, QA). Výstupy mají keš
`<out>/<batch>/<id>/<id>.glb` + `<id>-metrics.json`.

## 5. Rozdělení kódu na PC — balíček

Na Macu:

```bash
python3 scripts/ops/avatar-3d/make-pc-bundle.py \
  --out .artifacts/avatar-3d/pc-bundle/avatar3d-pc-bundle.zip
```

Balíček obsahuje: pipeline skripty (`generate.py`, `rig.py`, `crop-sheet.py`,
`similarity.py`, `clip_score.py`, `compare_variants.py`, `qa.mjs`), patchovaný
TripoSR klon (`tsr/` + LICENSE), vstupní ZIP
(`heros/Avatars/ZION_OASIS_3D_PODKLADY_25_DAVKA_01.zip`), roster
(`V31/L4/oasis/data/avatars.json`) a `PC-README.md` s příkazy.
**Váhy se do balíčku nedávají** — stahuje si je PC z HF (TripoSR 1,68 GB,
InstantMesh ~4–5 GB).

PC setup (PowerShell):

```powershell
mkdir C:\zion\avatar3d ; cd C:\zion\avatar3d
Expand-Archive avatar3d-pc-bundle.zip -DestinationPath .
py -3.10 -m venv .venv
.venv\Scripts\activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install rembg trimesh xatlas fast_simplification transformers Pillow numpy
# trasa A:
git clone https://github.com/TencentARC/InstantMesh.git
```

## 6. Generace na PC — krok za krokem

### P0 — smoke (1 postava, ~30 min, měření)

```powershell
# trasa B (fallback, hotový kód)
python scripts/ops/avatar-3d/generate.py --input sheet-test `
    --out out\b --device cuda --mc 320 --resolution 2048 `
    --max-tris 15000 --force

# trasa A (InstantMesh) — jeden vstup
python InstantMesh\run.py sheet-test\000-front.png `
   --config configs/instant-mesh-base.yaml --device cuda `
   --output-dir out\a\000\
```

Měřit a stabilizovat:

- `nvidia-smi` špičková VRAM (limit 7,2 GB), časy infer/mesh/bake,
- orientace (Y-up, chodidla na 0), API kontrakt výstupů.

**Brána G0:** na Macu QA mosaic + CLIP, srovnat **trasa A vs trasa B vs M1
strop**; 👤 schvaluje. Dle měření se vybere trasa pro dávky.

### P1 — dávka 25 (batch checkpoint, ~1–2 h)

1. `crop-sheet.py` rozřízne 25 sheetů z ZIPu na `sheet-<id>-front/side/back.png`.
2. Běh dávky (trasa z G0), **checkpoint po každé postavě** (generate.py už to
   umí: existující podklady přeskočí, chybu zapíše do report.jsonl a pokračuje).
3. Upload: `scp -i <KEY> -P 22 -r out\<batch>\ root@207.180.217.100:/opt/zion/avatar-staging/<batch>/`

### P2 — zpracování na Macu

```bash
rsync -az zion-edge2:/opt/zion/avatar-staging/<batch>/ .artifacts/avatar-3d/gpu/<batch>/
python3 scripts/ops/avatar-3d/compare_variants.py ...     # CLIP sort + mosaic
node scripts/ops/avatar-3d/qa.mjs --stage .artifacts/avatar-3d/gpu/<batch> ... # kontrola + přehlídka
```

Následuje stejné rig/QA/nasazení jako na M1 (runbook §8, §8b, §9b).

**Brána G1:** 👤 schvaluje dávku po kontrolním listu. Neschválené se vracejí na
PC s poznámkami; **žádné automatické zapínání do hry**.

### P3+ — další dávky

Postupovat podle dodaných listů (25 listů / ZIP). **Brána G2:** 202/202 v manifestu
(id, SHA-256 vstupů, model, parametr generace, odsouhlasení, deployment).

## 7. Rozpočet a časy

| Zařízení | Jedna postava | Dávka 25 | Celé 202 |
|---|---|---|---|
| M1 (současný strop) | 292 s | ~2,0 h | ~17 h |
| PC trasa B (TripoSR-CUDA, odhad) | 30–60 s | 15–30 min | 2–3 h |
| PC trasa A (InstantMesh, odhad) | 90–240 s | 1–1,7 h | 8–14 h |

Časy trasy A/B jsou **odhady**; P0 je měření na PC. Po P0 se plán upraví podle
skutečných hodnot.

## 8. Rizika a meze

1. **VRAM OOM** na trase A na 8 GB — hlavní známé riziko. P0 musí registrovat
   `nvidia-smi` v reálném čase; pokud vrátí OOM, jde plán B.
2. **nvdiffrast na Windows** (potřeba MSVC + CUDA SDK pro bake) — pak
   `--no-texture` a bake na Macu, nebo rovnou trasa B.
3. **torchmcubes na Windows** — pip wheel podpora; P0 musí ověřit, jinak
   fallback na CPU marching cubes jako v M1.
4. **Disk na PC** ≥ 12 GB (váhy + klon + výstupy).
5. **Antivirus na Windows** — vyloučit Python venv z real-time kontroly.
6. **Dlouhé běhy** — batch skripty musí přežít přerušení (checkpoint per postava).
7. **Kvalita trasy B** = strop M1 — obrys a paleta jsou herně použitelné, tvář
   zůstává měkká; okamžitě nasaditelná záloha, ale ne finální tvar.

## 9. Co plán NEŘEŠÍ

- **Chůze/útok animace** — jen idle (stejné jako M1).
- **LOD mobilu/vzdálenosti** — až po schválení kvality, jiné kolo.
- **Postavy bez listů** (nevyřešený subset z 202): vyžaduje samostatné
  rozhodnutí (vstup jen z portrétu = nižší kvalita).
- **Produkční deploy** — samostatná brána v root plánu.
- **Licence třetích stran** — přehled licencí řídí runbook §2; před batchem
  ověřit licence InstantMesh repa.

## 10. Změnový log

- 2026-11-08: TRELLIS.2 pilot ověřen (Space), gated DINOv3 blokuje vlastní GPU běh.
- 2026-11-08: plán vznikl; vychází z naměřeného M1 sweepu (runbook §9c) a z
  odhadů trasy A/B. P0 je povinná před dávkovým během.
