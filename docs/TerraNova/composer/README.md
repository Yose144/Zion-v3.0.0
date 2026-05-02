# Terra Nova — Composer (sjednocená edice)

Tento adresář je **redakční a strojové centrum** pro jednu čitelnou osu knihy **Terra Nova** v rámci repozitáře.

---

## Co je „composer unified edition“

1. **Právně/próza:** Kanonické znění jsou **jednotlivé markdown soubory** v [`../FINAL/`](../FINAL/README.md) — konsolidace ze složek `cloude/`, `public/` a disciplíny `ORG/` (viz FINAL README).
2. **Jednosouborová čtenářská kopie:** [`edition/Full.md`](./edition/Full.md) (CS) a [`edition/Full-en.md`](./edition/Full-en.md) (EN) vznikají **spojením** kapitol ve [`FINAL/`](../FINAL/README.md) resp. [`FINAL/en/`](../FINAL/en/) — viz [`MANIFEST.md`](./MANIFEST.md).
3. **Mapa všech variant:** [`SOURCES_AND_LINEAGE.md`](./SOURCES_AND_LINEAGE.md) — kde jsou Gemini fork, staré číslování v kořeni `docs/TerraNova/`, Projects a web.

---

## Dokumenty zde

| Soubor | Účel |
|--------|------|
| [`MANIFEST.md`](./MANIFEST.md) | Pořadí kapitol + odkazy na FINÁL + poznámka k webu |
| [`SOURCES_AND_LINEAGE.md`](./SOURCES_AND_LINEAGE.md) | Inventář edic a historických artefaktů |
| [`edition/00-EDITORIAL-CHARTER.md`](./edition/00-EDITORIAL-CHARTER.md) | Jednotný redakční rámec (3 roviny pravdy + řada 4 knih) |
| [`edition/Full.md`](./edition/Full.md) | Vygenerovaný celek CS *(po změnách ve `FINAL/`)* |
| [`edition/Full-en.md`](./edition/Full-en.md) | Vygenerovaný celek EN *(po změnách v `FINAL/en/`)* |
| [`scripts/build-full-md.sh`](./scripts/build-full-md.sh) | Stitch CS → `Full.md` |
| [`scripts/build-full-en-md.sh`](./scripts/build-full-en-md.sh) | Stitch EN → `Full-en.md` |

---

## Regenerovat celek

```bash
bash docs/TerraNova/composer/scripts/build-full-md.sh    # Czech → edition/Full.md
bash docs/TerraNova/composer/scripts/build-full-en-md.sh   # English → edition/Full-en.md
```

Commitujte změny ve `FINAL/` / `FINAL/en/` i případné nové stitch soubory ve stejném PR.

---

## Související plán obsahu

[`../12-PLAN-KNIHY.md`](../12-PLAN-KNIHY.md) — známé driftové body (realita vs roadmap, ekonomika, struktura složky); Composer je nástrojová vrstva, ne náhrada té analýzy.

---

*Terra Nova · ZION · Composer baseline · 2026*
