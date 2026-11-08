# PC-README — generace avatarů na GTX 1070 Ti

Úplný plán a zdůvodnění: `PLAN_3D_AVATARI_1070TI.md` (v tomto ZIPu).
Naměřená M1 pipeline a záplaty: `docs/AVATAR-3D-PIPELINE.md` (v tomto ZIPu).

## 1. Před prvním spuštěním

1. Rozbal ZIP do `C:\zion\avatar3d\` (krátká cesta, kvůli Windows limitu).
2. Vytvoř Python 3.10 venv a nainstaluj CUDA wheel:
   ```
   py -3.10 -m venv .venv
   .venv\Scripts\activate
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
   pip install rembg trimesh xatlas fast_simplification transformers Pillow numpy
   ```
3. Ověř volnou VRAM: `nvidia-smi --query-gpu=memory.used --format=csv`
   (musí být < 200 MiB — jinak zastav `zion-hiran-cuda` a `zion-coder-cuda`).
4. TripoSR váhy: stáhne si je skript sám z HF (1,68 GB) při prvním běhu.
   InstantMesh: `git clone https://github.com/TencentARC/InstantMesh.git`.

## 2. Smoke test (P0)

Trasa B (TripoSR, hotová cesta):
```
python scripts\generate.py --input inputs\sheet-test --out out\b ^
    --device cuda --mc 320 --resolution 2048 --max-tris 15000 --force
```
Trasa A (InstantMesh):
```
python InstantMesh\run.py inputs\sheet-test\000-front.png ^
    --config configs\instant-mesh-base.yaml --device cuda ^
    --output-dir out\a\000\
```

Zaznamenat: špičkovou VRAM, časy infer/mesh/bake, orientaci (Y-up, chodidla na 0).

## 3. Dávka

```
python scripts\generate.py --input inputs\crop\<batch> --out out\<batch> ^
    --device cuda --mc 320 --resolution 2048 --max-tris 15000
```
Skript restartuje bezpečně: hotové postavy přeskočí, chyby zaloguje (report.jsonl).

Upload na EDGE2:
```
scp -i <KEY> -P 22 -r out\<batch>\ root@207.180.217.100:/opt/zion/avatar-staging/<batch>/
```

## 4. Pravidla

- Před dávkou zastavit GPU inference (viz plán §3); po dávce obnovit.
- Mining nezasahujeme (běží na RX 5600 XT).
- Žádný push do repa z PC — jen upload na staging.
- Kvalitativní bránou je člověk (👤) na Macu. Bez schválení se nic nedostane do hry.
