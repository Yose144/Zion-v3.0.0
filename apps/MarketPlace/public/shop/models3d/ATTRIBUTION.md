# 3D modely v marketu — zdroje a licence

Modely v téhle složce jsou **herní GLB** zkonvertované z STL
(`scripts/ops/starfighter-glb.py`). Slouží jako náhled produktu v marketu
a jako tatáž loď ve hře `/fleet` v Nirvaně.

| soubor | zdroj | licence |
|---|---|---|
| `awing.glb`, `bwing.glb`, `xwing.glb`, `ikaruga.glb`, `snowspeeder.glb`, `tiefighter.glb`, `tieinterceptor.glb` | `apps/MarketPlace/public/shop/models/*.stl` (dřevěné kity z marketu) | stejná jako produkt v marketu |
| `falcon.glb` | Thingiverse **thing 967387** (archiv: <https://archive.org/details/thingiverse-967387>), `Falcon.stl` | **CC BY-SA 3.0** — uvést autora a zdroj, odvozeniny pod stejnou licencí |

## Millennium Falcon

* Zdroj: Thingiverse 967387, staženo z archivu Internet Archive (původní
  Thingiverse je za Cloudflare a API vyžaduje token).
* Licence: Creative Commons **Attribution-ShareAlike 3.0**.
* Úprava: konverze STL → GLB (panelový lak do vrcholových barev, srovnání
  normál, LOD pro vzdálené lodě). Geometrie se nemění.
* Uvedení autora: jméno autora není v archivu dostupné (položka má jen název
  „millennium falcon"); před veřejným launchem je potřeba ho dohledat
  a doplnit — do té doby je model vhodný jen pro interní/ZAP-pasované prostředí.

## Poznámka k ostatním lodím

Tvary lodí jsou z franšízy Star Wars a STL podklady pocházejí z cizích kitů
(`handpanda/wooden-starfighter`). Licence kitů nebyla dohledána; je to
**otevřený blocker před veřejným launchem**, dohodnutý s operátorem.
