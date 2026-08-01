# 🌍 OASIS Worlds — Světová dokumentace

Tento adresář obsahuje koncepty jednotlivých světů, dimenzí a prostorů OASIS.

> **Hlavní vizi najdeš v:** [`APP&WEB/OasisWeb/OASIS_UNIVERSE.md`](../../../APP&WEB/OasisWeb/OASIS_UNIVERSE.md)  
> **Technická pravidla pro UE5 import:** [`AGENTS.md`](../../../AGENTS.md)  
> **Vygenerovaný registr světů:** [`APP&WEB/OasisWeb/src/domain/config/worlds.ts`](../../../APP&WEB/OasisWeb/src/domain/config/worlds.ts)

---

## Cíl

Každý soubor `.md` popisuje jeden svět. Může to být:

- hvězdný systém,
- planeta / herní žánr,
- filmový / kulturní sektor,
- dimenze / časová linie / hráčský svět.

Cílem je maximálně rozvinout možnosti OASIS multiverse — každý svět má svou atmosféru, obyvatele, mechaniky, questy a vztah k honbě za Zlatým vejcem.

---

## Struktura souborů

Pro nové světy použij šablonu [`TEMPLATE.md`](TEMPLATE.md).

---

## Kategorie světů

### Hvězdné systémy
- [`ALPHA_CENTAURI.md`](ALPHA_CENTAURI.md) — Alpha Centauri
- [`ANTARES.md`](ANTARES.md) — Antares
- [`ARCTURUS.md`](ARCTURUS.md) — Arcturus
- [`BETELGEUSE.md`](BETELGEUSE.md) — Betelgeuse
- [`ORION.md`](ORION.md) — Orion
- [`PLEIADES.md`](PLEIADES.md) — Pleiady
- [`PROXIMA_CENTAURI.md`](PROXIMA_CENTAURI.md) — Proxima Centauri
- [`SIRIUS.md`](SIRIUS.md) — Sirius
- [`TAU_CETI.md`](TAU_CETI.md) — Tau Ceti
- [`VEGA.md`](VEGA.md) — Vega

### Žánrové planety
- [`PLANET_ATARI.md`](PLANET_ATARI.md) — Pongonia
- [`PLANET_CYBERPUNK.md`](PLANET_CYBERPUNK.md) — Nexus-7
- [`PLANET_DOOM.md`](PLANET_DOOM.md) — Phobetor
- [`PLANET_GTA.md`](PLANET_GTA.md) — Nova Libertalia
- [`PLANET_LOL.md`](PLANET_LOL.md) — Summon
- [`PLANET_MINECRAFT.md`](PLANET_MINECRAFT.md) — Voxelia
- [`PLANET_NO_MANS_SKY.md`](PLANET_NO_MANS_SKY.md) — Procedium
- [`PLANET_POKEMON.md`](PLANET_POKEMON.md) — Creoria
- [`PLANET_PORTAL.md`](PLANET_PORTAL.md) — Aperthia
- [`PLANET_QUAKE.md`](PLANET_QUAKE.md) — Pulzar
- [`PLANET_SIMS.md`](PLANET_SIMS.md) — Vitania
- [`PLANET_WOW.md`](PLANET_WOW.md) — Aethelgard

### Filmové / space-opera sektory
- [`SECTOR_BLADE_RUNNER.md`](SECTOR_BLADE_RUNNER.md) — Blade Runner
- [`SECTOR_DUNE.md`](SECTOR_DUNE.md) — Dune
- [`SECTOR_HALO.md`](SECTOR_HALO.md) — Halo
- [`SECTOR_HARRY_POTTER.md`](SECTOR_HARRY_POTTER.md) — Harry Potter
- [`SECTOR_LORD_OF_THE_RINGS.md`](SECTOR_LORD_OF_THE_RINGS.md) — Lord Of The Rings
- [`SECTOR_MATRIX.md`](SECTOR_MATRIX.md) — Matrix
- [`SECTOR_STARCRAFT.md`](SECTOR_STARCRAFT.md) — Starcraft
- [`SECTOR_STAR_TREK.md`](SECTOR_STAR_TREK.md) — Star Trek
- [`SECTOR_STAR_WARS.md`](SECTOR_STAR_WARS.md) — Star Wars

### Kulturní / historické světy
- [`WORLD_ABORIGINAL_AUSTRALIA.md`](WORLD_ABORIGINAL_AUSTRALIA.md) — Aboriginal Australia
- [`WORLD_AFRICA.md`](WORLD_AFRICA.md) — Africa
- [`WORLD_ANCIENT_EGYPT.md`](WORLD_ANCIENT_EGYPT.md) — Ancient Egypt
- [`WORLD_AOTEAROA.md`](WORLD_AOTEAROA.md) — Aotearoa
- [`WORLD_ATLANTIS.md`](WORLD_ATLANTIS.md) — Atlantis
- [`WORLD_AZTEC.md`](WORLD_AZTEC.md) — Aztec
- [`WORLD_BABYLON.md`](WORLD_BABYLON.md) — Babylon
- [`WORLD_CHINA.md`](WORLD_CHINA.md) — China
- [`WORLD_GREECE_ROME.md`](WORLD_GREECE_ROME.md) — Greece Rome
- [`WORLD_INCA.md`](WORLD_INCA.md) — Inca
- [`WORLD_INDIA.md`](WORLD_INDIA.md) — India
- [`WORLD_INDONESIA.md`](WORLD_INDONESIA.md) — Indonesia
- [`WORLD_JAPAN.md`](WORLD_JAPAN.md) — Japan
- [`WORLD_LEMURIA.md`](WORLD_LEMURIA.md) — Lemuria
- [`WORLD_MAYA.md`](WORLD_MAYA.md) — Maya
- [`WORLD_NORSE_CELTIC.md`](WORLD_NORSE_CELTIC.md) — Norse Celtic
- [`WORLD_TIBET.md`](WORLD_TIBET.md) — Tibet

### Dimenzní / meta světy
- [`DIMENSION_8BIT.md`](DIMENSION_8BIT.md) — Bitová Realita
- [`DIMENSION_AI_FUTURE.md`](DIMENSION_AI_FUTURE.md) — Silicate Bloom
- [`DIMENSION_HORROR.md`](DIMENSION_HORROR.md) — Umbra Fold
- [`DIMENSION_SOLARPUNK.md`](DIMENSION_SOLARPUNK.md) — Solarpunk
- [`DIMENSION_STEAMPUNK.md`](DIMENSION_STEAMPUNK.md) — Steampunk
- [`DIMENSION_UNDERGROUND.md`](DIMENSION_UNDERGROUND.md) — Underground
- [`DIMENSION_WESTERN.md`](DIMENSION_WESTERN.md) — Frontier Belt

---

> **Toto je živý index.** Světy se budou neustále přidávat. Každý soubor má být samostatný koncept, který se dá později převést do `src/domain/config/worlds.ts` a UE5. Tento index se regeneruje skriptem `APP&WEB/OasisWeb/scripts/generate-worlds-config.py`.
