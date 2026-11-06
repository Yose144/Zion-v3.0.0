# 3D modely pro detail produktu

Sem patří modely, které se zobrazují v interaktivním náhledu na detailu produktu.

## Lampion Lumi 2

```
public/models/lumi-2.glb     (1,9 MB, meshopt, 8 dílů, 214 k trojúhelníků)
```

Zdroj je `heros/shop/Lumi/Lumi_2.glb` (12,1 MB, 19 primitiv, f32 pozice i normály).
Webovou kopii vyrábí **`scripts/ops/lumi-glb-optimize.sh`**:

```bash
bash scripts/ops/lumi-glb-optimize.sh          # heros → apps/MarketPlace/public/models/lumi-2.glb
```

Skript model svaří, zkvantuje a zabalí `EXT_meshopt_compression` (12 MB → 1,9 MB)
a na konci **ověří, že se nezměnil tvar ani materiály** (bbox drift < 0,1 mm,
tři materiály, meshopt přítomen). Kdyby se model posunul nebo zplastovatěl,
skript spadne — místo aby tiše poslal do marketu jiný výrobek.

`--simplify false` je záměr: stěny jsou tenké laserované ornamenty, kde každá
hrana něco drží; kvadrická dekurace z nich dělá kaši.

### Co model nese

- **8 dílů**: šest stěn (čistý lotos, květ života, loď Království srdce, strom
  života, srdcová mandala, Hiranjagarbha), zdobený vršek s otvorem Ø 90 mm, dno.
- **3 materiály** — `Překližka` (světlé dřevo), `Řez` (opálená hrana laseru),
  `Gravír` (tmavý vypálený motiv). Nesmí se slévat do jednoho: bez nich je
  z lampionu papírová krabice (tak vypadal starý model v6 s jediným krémovým
  materiálem a bez normálů).
- **Reálné míry výpalu**: 140 × 126 × 121 mm, metry, Y-up, dno v `y = 0`.
  Komponenta z bboxu počítá kameru i místo pro svíčku, takže měřítko má význam.

### Jak má model vypadat

- formát **glTF binární** (`.glb`), ideálně s meshopt kompresí (dekodér je
  součástí `three`, nic se nedotahuje ze sítě),
- textury nejsou potřeba — barvy nese materiál, detaily geometrie,
- stojí-li lampion na podstavci, nechte ho v modelu.

### Kdo model kreslí

| Kde | Komponenta | Poznámka |
|---|---|---|
| `/vanoce/lampion` | `src/components/xmas/Lantern3D.tsx` | galaxie, svíčka, bloom, sníh |
| karta produktu v `/shop` | `src/components/shop/StarfighterViewer.tsx` | pozná, že GLB nemá vrcholové barvy, a **nechá jeho materiály** |

Oba používají `GLTFLoader` s `setMeshoptDecoder(MeshoptDecoder)`.

### Výkon

`three` se stahuje **až po kliknutí** na „Načíst 3D náhled", takže model
nezpomaluje první vykreslení stránky. Držte `.glb` pod ~2 MB — nad to už
uživatel na mobilních datech čeká.

### Kontrolní render

```bash
node scripts/ops/lumi-render/render.mjs                    # 4 pohledy
node scripts/ops/lumi-render/render.mjs --mode turntable   # šest stěn
node scripts/ops/lumi-render/render.mjs --mode hero        # jeden záběr bez titulků
```

Výstup jde do `.artifacts/render/lumi-2/`. Render používá **materiály modelu**
a svíčku uvnitř — slouží ke kontrole tvaru, orientace a opálených hran,
ne jako finální marketingový obrázek.
