# Pipeline: 3D avatáři OASIS z portrétů

**Stav:** pilot Krishna (#0) vygenerován, kvalita nedostačuje pro hru. Postup níže je
reprodukovatelný a slouží k výrobě všech 202 postav, až bude k dispozici vhodnější
výpočetní prostředek nebo ruční dočištění.

Cílem je **jeden individuální, rigovaný a optimalizovaný GLB na postavu**, který se
v Nirvaně načítá podle `avatarId` a při chybě spadne na procedurální model.
Výtvarný list z GPT není 3D model; vygenerovaný mesh není rigovaná postava.

---

## 1. Co je potřeba na vstupu

| Vstup | Zdroj | Stav |
|---|---|---|
| Roster | `V31/L4/oasis/data/avatars.json` | 202 záznamů, ID 0–204 s mezerami |
| Oficiální portrét | `apps/website-v2.9/public/oasis-assets/final_portraits/<id>-<slug>.webp` | 202/202 |
| Výtvarný list (front / side / back) | `heros/Avatars/ZION_OASIS_3D_PODKLADY_25_DAVKA_01.zip` | 25 postav hotových |
| Kánon (atributy, paleta) | `apps/nirvana/src/core/avatars/canon.ts` (generovaný) | hotový |

Mapuje se **výhradně podle ID z rosteru**, nikdy podle pořadí v archivu ani podle názvu
souboru. Kontrola, která musí projít před jakoukoli prací:

```bash
python3 - <<'PY'
import json, pathlib
a = json.load(open('V31/L4/oasis/data/avatars.json'))['avatars']
assert len(a) == 202 and len({x['id'] for x in a}) == 202
missing = [x['id'] for x in a if not (pathlib.Path(
  'apps/website-v2.9/public/oasis-assets/final_portraits') / x['image_url'].split('/')[-1]).is_file()]
print('missing:', missing)   # musí být prázdné
PY
```

---

## 2. Prostředí (macOS Apple Silicon)

Systémový Python 3.14 na tomto stroji nestačí (torch nemá kola). Používá se izolované
prostředí s Pythonem 3.11 přes `uv`; nic se neinstaluje globálně.

```bash
WORK=/private/var/folders/_5/_7p3jjw926jbb74rbt7__4h80000gn/T/opencode
uv venv --python 3.11 "$WORK/krishna-triposr"
VPY="$WORK/krishna-triposr/bin/python"

uv pip install --python "$VPY" torch torchvision
uv pip install --python "$VPY" 'numpy<2' 'transformers==4.35.0' 'omegaconf==2.3.0' \
  'einops==0.7.0' 'trimesh==4.0.5' 'huggingface-hub<0.18' 'pillow==10.1.0' \
  rembg onnxruntime xatlas imageio scipy scikit-image
git clone https://github.com/VAST-AI-Research/TripoSR.git "$WORK/triposr-source"
```

Ověření GPU **skutečným výpočtem**, ne jen příznakem:

```bash
"$VPY" -c 'import torch;x=torch.ones(4,device="mps");print(torch.__version__,(x+x).cpu())'
```

Modelové váhy a segmentační model se ukládají mimo repo:

```bash
export HF_HOME=$WORK/krishna-hf U2NET_HOME=$WORK/krishna-u2net
```

### Licence — blokující kontrola

- **TripoSR**: kód i váhy MIT (HuggingFace `stabilityai/TripoSR`, gated formulář).
- **U²-Net (rembg)**: Apache-2.0, ale pozor na alternativní modely v rembg s jinými
  licencemi (např. RMBG-2.0 je CC BY-NC, komerčně nepoužitelné).
- **TRELLIS.2 pro Mac** (`shivampkumar/trellis-mac`): MIT port, ale doporučuje 24 GB RAM
  a výchozí segmentace je nekomerční. Na 8GB stroji nedoporučeno.

Každý model, váhy a knihovna patří do manifestu s verzí a licencí. Nejasná licence =
blokace vydání.

---

## 3. Čtyři opravy, bez kterých to nefunguje

Tyto chyby jsou v upstream repu a na M1 se projeví vždy. Všechny jsou v **lokální
klonované kopii**, ne v repu projektu.

### 3.1 `--device mps` se tiše zahodí

`run.py` má `if not torch.cuda.is_available(): device = "cpu"`. Bez opravy poběží vše na
CPU (a je to pomalé, ale „funguje").

```diff
-if not torch.cuda.is_available():
+if device.startswith('cuda') and not torch.cuda.is_available():
```

### 3.2 `torchmcubes` se na macOS nenačte

Zkompiluje se, ale při importu spadne na nekompatibilní `libtorch` (načte se systémový
PyTorch jiné verze). Nahrazení CPU ekvivalentem:

```python
# tsr/models/isosurface.py
from skimage.measure import marching_cubes as skimage_marching_cubes

def marching_cubes(volume, threshold):
    vertices, faces, _, _ = skimage_marching_cubes(volume.detach().cpu().numpy(), threshold)
    return torch.from_numpy(vertices[:, ::-1].copy()), torch.from_numpy(faces.copy()).long()
```

**Ověření os** (jinak se to nepozná a hledá se chyba jinde): vygeneruj elipsoid, který je
2× vyšší v ose Y, a zkontroluj, že nejdelší rozměr výstupu je index 1. Prošlo.

### 3.3 Model je Z-up, glTF je Y-up

TripoSR vrací objem s postavou podél **Z**; glTF i three.js čekají **Y**. Bez otočení
postava ve hře leží. Před exportem:

```python
mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1.0, 0.0, 0.0]))
```

Kontrola: `extents` musí mít největší hodnotu na ose Y (naměřeno `[0.257, 0.975, 0.400]`).

### 3.4 Bake textury spadne na MPS a vyjde tmavý

Dvě chyby:

1. `grid_sample` dostane `positions` na CPU a triplane na MPS → v `nerf_renderer.py`
   doplnit `positions = positions.to(triplane.device)` a v `bake_texture.py`
   `queried_grid["color"].detach().cpu().numpy()`.
2. Exportér zapíše `baseColorFactor [0.4, 0.4, 0.4, 1]`, takže albedo ztmavne na 40 %.
   Oprava až v hotovém GLB (bezpečná i pro dávkové zpracování):

```python
import json, struct
b = open(path, 'rb').read()
magic, ver, _ = struct.unpack_from('<III', b, 0)
ln, typ = struct.unpack_from('<II', b, 12)
j = json.loads(b[20:20 + ln]); tail = b[20 + ln:]
for m in j.get('materials', []):
    pbr = m.setdefault('pbrMetallicRoughness', {})
    pbr['baseColorFactor'] = [1.0, 1.0, 1.0, 1.0]
    pbr['metallicFactor'] = 0.0
js = json.dumps(j, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
open(path, 'wb').write(struct.pack('<III', magic, ver, 12 + 8 + len(js) + len(tail))
                       + struct.pack('<II', len(js), typ) + js + tail)
```

`metallicFactor = 0` je důležitý: kov bez `scene.environment` je ve three.js černý.

### 3.5 Špatné orámování vstupu nafoukne model

TripoSR očekává **postavu vyplňující ~85 % plátna**. Když se jen zmenší celé
čtvercové plátno i s prázdným okolím, dostane model malý objekt a vygeneruje
nafouklý blob — naměřeno `extents ≈ [0.44, 1.01, 0.99]`, tedy hloubka jako výška,
a v náhledu to vypadá jako placatá deska.

Správně se postupuje jako v originálním `run.py`: odebrat pozadí, oříznout na
ohraničující box postavy a teprve pak škálovat na 0.85.

```python
from tsr.utils import remove_background, resize_foreground
image = resize_foreground(remove_background(Image.open(path), rembg.new_session()), 0.85)
```

Kontrola: `extents` musí mít výšku (osa Y) výrazně větší než hloubku (osa Z),
např. `[0.268, 0.957, 0.397]`.

---

## 4. Generování jedné postavy

```bash
cd "$WORK/triposr-source"
"$VPY" run.py <vstup.png> \
  --device mps --chunk-size 512 --mc-resolution 256 \
  --foreground-ratio 0.75 --bake-texture --texture-resolution 1024 \
  --model-save-format glb --output-dir "$OUT"
```

Potom aplikovat opravu 3.4 (materiál) a zkontrolovat:

```bash
"$VPY" -c "import trimesh,numpy as np;p='$OUT/0/mesh.glb';s=trimesh.load(p,force='scene');\
g=list(s.geometry.values())[0];print(len(g.faces),np.round(g.extents,3),g.visual.uv is not None)"
```

### Volba vstupu

- **Výtvarný list (front)** = nejlepší výsledek, protože jde o celou postavu.
- Portrét samotný dá jen bustu a vymyšlené pozadí — nepoužívat pro herní model.
- `--no-remove-bg` jen s ručně připravenou maskou (segmentace často uřízne korunu,
  paví pero nebo světlé vlasy).

### Naměřené hodnoty (M1, 8 GB)

| Fáze | Čas |
|---|---|
| Inicializace modelu (váhy na disku) | 6–13 s |
| Dopředný výpočet | 4,7 s |
| Extrakce meshe (192) | 25–37 s |
| Extrakce meshe (256) | ~60 s |
| Bake textury 1024² | 12–36 s |
| Výsledek | 47 452 tris, 2,8 MB, 1 draw call |

---

## 5. Kvalitativní brána — proč Krishna neprošel

Vygenerovaný model **splňuje technické požadavky** (stojí, má texturu, správnou osu,
rozumný počet trojúhelníků), ale **nesplňuje výtvarný požadavek**: obličej, koruna, pero
a flétna jsou rozmělněné do nečitelných hmot. Kontrola proto musí být vizuální, ze čtyř
pohledů, proti portrétu — ne jen „soubor existuje“.

Postava se **nepřijímá**, dokud:

- [ ] tvář je na první pohled totožná s portrétem (stejný věk, rysy, pleť, vous/účes),
- [ ] jsou čitelné povinné atributy (Krišna: flétna, diadém, pero) a jdou oddělit,
- [ ] silueta sedí na všech čtyřech pohledech a nic neproplouvá oděvem,
- [ ] mesh je watertight nebo alespoň bez děr v místech, která jsou vidět,
- [ ] má rig a alespoň idle + chůzi,
- [ ] ve hře drží rozpočet (viz §7) a nenačítá se přes 1 MB na postavu.

**TripoSR na 8 GB tento práh u složitých postav nesplní.** Je to nástroj na hrubý
proxy základ, ne na finální hrdinu. Pro produkci je potřeba jedno z:

1. **Lepší generátor** (TRELLIS.2 s ≥24 GB nebo ekvivalent) a stále ruční dočištění.
2. **Ruční modelování** v Blenderu podle výtvarného listu (nejspolehlivější kvalita).
3. **Kombinace**: generátor dodá základ, modelář opraví tvář, ruce, atributy a nariguje.

---

## 6. Co dodat od modeláře (jedna postava)

```text
<id>-<slug>/
  <id>.blend            # editovatelný zdroj
  <id>.glb              # herní export, Y-up, stopy v metrech
  <id>-basecolor.png    # 1024², případně ORM
  <id>-rig.fbx          # volitelně, pokud rig vzniká jinde
  <id>-notes.md         # co je návrh, co není na portrétu jisté
```

Požadavky na export:

- měřítko: výška postavy v metrech, chodidla na `y = 0`, pohled dopředu `+Z`;
- společná humanoidní kostra pro všechny lidské postavy, výjimky (Hanumán ocas,
  Ganéša) dokumentovat;
- atributy jako **oddělitelné objekty** připojené na kosti (`flute`, `vajra`, `bell`…),
- max 1 materiál na postavu, textura ≤1024², `metallicFactor` 0 pokud není prostředí.

---

## 7. Rozpočet pro hru (Nirvana)

Odvozeno z naměřeného univerza a MOBA scény; jde o strop, ne cíl.

| Parametr | Strop |
|---|---|
| Trojúhelníky (herní LOD) | ≤ 20 000 |
| Draw calls na postavu | ≤ 2 (tělo + atribut) |
| Textura | 1024², WebP/PNG s kompresí |
| Velikost GLB | ≤ 1,5 MB |
| Současně viditelných avatarů | 8 (MOBA 5v5 + bot), 12 ve výběru |
| Animace | sdílený `AnimationMixer`, klipy idle/chůze/útok |

Model 47k tris / 2,8 MB je **dvojnásobek** stropu — do hry by šel až po decimaci a
kompresi textury.

---

## 8. Zapojení do Nirvany (až po schválení kvality)

1. Asset do `apps/nirvana/public/models/avatars/<id>.glb` (prefix `/models` je veřejný
   v `middleware.ts`; jinde loader dostane 307 a načte HTML).
2. Manifest `apps/nirvana/src/core/avatars/models.generated.ts`:
   `export const AVATAR_MODELS: Record<number, string> = { 0: '/models/avatars/0.glb' }`.
3. `AvatarModel.tsx` dostane větev: pokud `AVATAR_MODELS[look.id]` existuje, načte GLB,
   jinak použije `buildAvatarMesh(look)`. **Fallback musí být výchozí chování** — chybějící
   soubor nesmí rozbít výběr ani multiplayer.
4. Do snapshotů se **neposílá URL**, jen `avatarId` (identita zůstává na serveru, klient
   si model dohledá lokálně).
5. Každá animovaná instance potřebuje vlastní skeleton; `SkeletonUtils.clone()` při
   sdílení GLB mezi hráči.
6. Ověřit: výběr avatara, MOBA 5v5, Mars multiplayer, výběr bez modelu, chybějící soubor,
   rychlost načtení a draw calls scény před/po.

---

## 9. Dávkové zpracování 202 postav

Autonomní dávku řeší tři skripty v `scripts/ops/avatar-3d/`:

| Skript | Co dělá |
|---|---|
| `crop-sheet.py` | Rozdělí dodaný výtvarný list na `front / side / back / detail`; hranice hledá jako svislé pruhy pozadí, jinak použije proporcionální fallback |
| `generate.py` | Načte TripoSR **jednou** a v cyklu generuje všechny postavy; je opakovatelný (hotové přeskočí), chybu jedné postavy zapíše a pokračuje |
| `qa.mjs` | Vykreslí kontrolní list: portrét + čtyři pohledy pro každé ID, do jednoho PNG |
| `similarity.py` | Měří IoU siluety a ΔE palety proti výtvarnému listu — **diagnostika, ne schvalovací filtr** (viz §9) |

### Spuštění celé dávky

```bash
export TRIPOSR_SRC=$WORK/triposr-source
export HF_HOME=$WORK/krishna-hf U2NET_HOME=$WORK/krishna-u2net
VPY=$WORK/krishna-triposr/bin/python

# 1) Rozbalit dávku a rozdělit listy na pohledy
mkdir -p "$WORK/in"
unzip -q heros/Avatars/ZION_OASIS_3D_PODKLADY_25_DAVKA_01.zip -d "$WORK/raw"
for sheet in "$WORK"/raw/*/avatari/*/*-sheet.png; do
  id=$(basename "$(dirname "$sheet")")
  "$VPY" scripts/ops/avatar-3d/crop-sheet.py "$sheet" "$WORK/in" --id "$id"
done

# 2) Vygenerovat (lze pustit na noc; report je append-only JSONL)
"$VPY" scripts/ops/avatar-3d/generate.py \
  --input "$WORK/in" --out .artifacts/avatar-3d/stage \
  --device mps --mc 192 --resolution 1024 --max-tris 15000

# 3) Zkontrolovat
node scripts/ops/avatar-3d/qa.mjs --ids 000,003,051 --out .artifacts/avatar-3d/qa
"$VPY" scripts/ops/avatar-3d/similarity.py \
  --qa .artifacts/avatar-3d/qa/<stamp>.png --refs "$WORK/in"
```

`qa.mjs` potřebuje statický server nad repem (`python3 -m http.server 8769`)
a `puppeteer-core` s nainstalovaným Chrome.

### Naměřená propustnost (M1, 8 GB, mc 192, textura 1024)

| | Čas |
|---|---|
| První postava (včetně načtení modelu) | 60 s |
| Další postavy (model v paměti) | **35–43 s** |
| Celá dávka 202 postav | **~2–2,5 h** bez obsluhy |
| Disk (staging) | ~2,5 MB / postava → ~500 MB |

**Model se načítá jednou.** Kdyby se pouštěl `run.py` per postava, připlatilo by se
6–13 s na každé — u 202 postav téměř hodina navíc.

### Co dávka ještě neumí (otevřené)

- **Decimace na herní rozpočet.** Řešeno přepínačem `--max-tris`: decimuje se
  **před** zapékáním textury, takže UV i barvy zůstanou správné. Ověřeno na Krišnovi:
  24 856 → **15 000 trojúhelníků**, 2,07 → **1,65 MB**, vzhled beze změny.
- **Rig a animace.** Není součástí image-to-3D. Samostatný krok v Blenderu
  (headless + auto-rig), pro blobovitou síť nespolehlivý.
- **Automatické hodnocení podoby.** `similarity.py` měří IoU siluety a ΔE palety
  proti **výtvarnému listu** (ne portrétu — ten je jen poprsí). **Změřeno: nefunguje
  jako filtr.** Známý vadný model dostal IoU 0,456 / hlava 0,248, dobré modely
  0,508–0,578 / hlava 0,208–0,477. Rozpětí se překrývá, takže metrika nerozliší
  použitelný model od nepoužitelného a **nesmí** sama schvalovat dávku.

**Důsledek pro autonomii:** bez spolehlivého hodnocení musí dávku projít člověk,
nebo se musí použít sémantické embeddingy (CLIP) místo geometrických metrik.
Do té doby je bezpečný režim „vygenerovat dávku + kontrolní listy + rozhodnout“.



Pořadí je dané a nedoporučuji ho přeskakovat:

1. **Pilot** (1 postava) → schválit kvalitu a rozpočet. Hotovo pro Krišnu: technicky
   prošel (stojí, má texturu, správné proporce), **výtvarně je na hraně** — tvář je
   měkká a detaily nečitelné.
2. **Reprezentativní sada 6–8 postav** s odlišnou anatomií: Hanumán (ocas, zvířecí hlava),
   Ganéša (sloní hlava), Maitréja (dítě), Dalaí Lama (stařec, brýle), Vadžrasattva
   (atributy), Panna Maria (závoj), bojovník se zbrojí.
3. **Dávky po 25** (odpovídá dodaným ZIPům) s kontrolou po každé dávce.
4. Každá dávka: generování → kontrola ze čtyř pohledů → rig → optimalizace → zápis do
   manifestu → test ve hře → report.

Pro dvě stě postav je **rig a dočištění výrazně dražší než samotné generování**
(inference je sekundy, lidská práce desítky minut na postavu). Plánovat podle toho, ne
podle rychlosti GPU.

### Co se dá zautomatizovat

- párování ID ↔ portrét ↔ hotový GLB, kontrola SHA-256,
- materiálové opravy a validace GLB,
- decimace a komprese textur,
- kontrola rozpočtu (tris, draw calls, velikost),
- render čtyř pohledů pro vizuální kontrolu.

### Co automatizovat nelze

- posouzení podoby s portrétem,
- oprava tváře, rukou a atributů,
- rig a váhování,
- rozhodnutí, že model je dost dobrý pro hru.

---

## 10. Rychlý troubleshooting

| Projev | Příčina | Řešení |
|---|---|---|
| Vše běží pomalu, GPU je idle | `--device mps` shozeno na CPU | oprava 3.1, ověřit výpočtem |
| `Symbol not found ... cuptiMonitorBufferCompleted` | torchmcubes vs systémový torch | oprava 3.2 |
| Model ve hře leží | Z-up vs Y-up | oprava 3.3 |
| Model je černý | `metallicFactor` 1 bez prostředí | oprava 3.4 + `scene.environment` |
| Model je tmavý, ale ne černý | `baseColorFactor` 0,4 | oprava 3.4 |
| `grid_sampler ... same device` | positions na CPU, triplane na MPS | oprava 3.4 |
| Chybí koruna / pero | segmentace odstranila světlé partie | ruční maska + `--no-remove-bg` |
| Vyšlo jen torzo | vstup byl portrét, ne celá postava | použít výtvarný list |
| `No such file or directory ... mesh.glb` | TripoSR nevytvoří cílový adresář | `mkdir -p <out>/0` |
| Model je placatá deska / nafouklý | vstup nemá postavu na 85 % plátna | oprava 3.5 |
| V QA listu sedí pohledy k jiné postavě | WebGL má počátek vlevo dole | flip `y` podle počtu řádků |

---

## 11. Stav a historie

- 2026-11-07: první pokus (portrét) → busta, rozbitá orientace a povrch.
- 2026-11-07: oprava os, materiálu a bake textury; vstup z výtvarného listu (dávka 01).
- 2026-11-07: autonomní dávka (`crop-sheet.py`, `generate.py`, `qa.mjs`) a pátá oprava
  orámování. Tři postavy (Krišna, Hanumán, Dalaí Lama) prošly technicky: 25–35 tis.
  trojúhelníků, 2–2,6 MB, 35–60 s na postavu, správné proporce, čitelné barvy.
  **Do hry nezapojeno** — chybí decimace, rig a schválení podoby.
- Artefakty: `.artifacts/avatar-3d/stage/` (modely), `.artifacts/avatar-3d/qa/`
  (kontrolní listy), `.artifacts/krishna-triposr-pilot/` (první pokusy).
