# 3D modely — zdroje, autoři a licence

Modely v téhle složce jsou **herní GLB** zkonvertované z STL
(`scripts/ops/starfighter-glb.py`). Slouží jako náhled produktu v marketu
a jako tatáž loď ve hře `/fleet` v Nirvaně.

## Autoři

| co | autor | zdroj | licence |
|---|---|---|---|
| stíhačky `awing`, `bwing`, `xwing`, `ikaruga`, `snowspeeder`, `tiefighter`, `tieinterceptor` | **Graham Smith** (2014–15) | [eigenbloom.com/woodenstarfighter](https://eigenbloom.com/woodenstarfighter/) · zrcadlo `github.com/handpanda/wooden-starfighter` | v repu ani na webu **není licenční soubor** — dohodnout s autorem |
| `falcon` (Millennium Falcon) | **Graham Smith**, 2014 | Thingiverse **thing 967387**, staženo z archivu <https://archive.org/details/thingiverse-967387> (`Falcon.stl`) | **CC BY-SA 3.0** (Attribution-ShareAlike) |

Uvedení autora je u CC BY-SA **povinné** — při každém veřejném použití musí být
vidět jméno (Graham Smith), rok (2014) a zdroj (eigenbloom.com / Thingiverse 967387).
Odvozeniny (náš přebarvený GLB, LOD) zůstávají pod stejnou licencí.

## Co se s modelem dělalo

* konverze STL → GLB: slití destiček do jednoho meshe, srovnání orientace
  (nos = +Z), normalizace na délku 1,0, **panelový lak do vrcholových barev**
  (žádná textura), srovnání normál od středu trupu, LOD (mřížková kvantizace),
* geometrie se **nemění** — jen se přebarvuje a zjednodušuje pro vzdálené lodě.

## Poznámka k ostatním lodím

Tvary lodí jsou z franšízy Star Wars. Licence kitů (Graham Smith) není
dohledatelná a je to **otevřený blocker před veřejným launchem**, dohodnutý
s operátorem — stejně jako otázka franšízy.
