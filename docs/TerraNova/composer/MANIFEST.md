# Composer manifest — pořadí a mapování

## Česká kanonická řada (UNIFIED — zdroj stitch)

Soubory z [`../UNIFIED/`](../UNIFIED/) v tomto pořadí:

| Pořadí | Soubor | Téma (krátce) |
|--------|--------|----------------|
| 00 | [`UNIFIED/00-PROLOG.md`](../UNIFIED/00-PROLOG.md) | Prolog: Záznam Architekta |
| 01 | [`UNIFIED/01-MOST.md`](../UNIFIED/01-MOST.md) | Most čtyř knih |
| 02 | [`UNIFIED/02-KOSMOLOGIE.md`](../UNIFIED/02-KOSMOLOGIE.md) | Kosmologie · Hiranyagarbha · L1–L6 |
| 03 | [`UNIFIED/03-VOLNA-ENERGIE.md`](../UNIFIED/03-VOLNA-ENERGIE.md) | Volná energie |
| 04 | [`UNIFIED/04-KOMUNITY.md`](../UNIFIED/04-KOMUNITY.md) | Komunity |
| 05 | [`UNIFIED/05-AI-NATIVE.md`](../UNIFIED/05-AI-NATIVE.md) | AI Native |
| 06 | [`UNIFIED/06-MEDICINA.md`](../UNIFIED/06-MEDICINA.md) | Medicína Nové Země |
| 07 | [`UNIFIED/07-L1-L4.md`](../UNIFIED/07-L1-L4.md) | Architektura L1→L4 |
| 08 | [`UNIFIED/08-SVOBODA.md`](../UNIFIED/08-SVOBODA.md) | Svět Svobody L5 |
| 09 | [`UNIFIED/09-ISSOBELLA.md`](../UNIFIED/09-ISSOBELLA.md) | Issobella L6 |
| 10 | [`UNIFIED/10-WARP.md`](../UNIFIED/10-WARP.md) | WARP |
| 11 | [`UNIFIED/11-KOMPAS.md`](../UNIFIED/11-KOMPAS.md) | Zlatý Kompas |
| A | [`UNIFIED/A-NVIDIA-COMPUTE.md`](../UNIFIED/A-NVIDIA-COMPUTE.md) | Příloha NVIDIA |
| B | [`UNIFIED/B-PROROCTVI.md`](../UNIFIED/B-PROROCTVI.md) | Příloha Proroctví |
| C | [`UNIFIED/C-ZJEVENI.md`](../UNIFIED/C-ZJEVENI.md) | Příloha Zjevení |
| D | [`UNIFIED/D-BHAGAVAD-GITA.md`](../UNIFIED/D-BHAGAVAD-GITA.md) | Příloha Bhagavad Gītā |

Skript [`scripts/build-unified-md.sh`](./scripts/build-unified-md.sh) používá přesně tuto řadu.

## Legacy: FINAL řada (archivní reference)

Původní kanonická řada v [`../FINAL/`](../FINAL/) zůstává jako archivní reference. Stitch skript: [`scripts/build-full-md.sh`](./scripts/build-full-md.sh).

## Anglická řada

Stejná čísla v [`../FINAL/en/`](../FINAL/en/). Stitch:

```bash
bash docs/TerraNova/composer/scripts/build-full-en-md.sh
```

→ výstup [`edition/Full-en.md`](./edition/Full-en.md).

## Mapování na web (public TS edice)

Export **`CHAPTERS_PUBLIC`**: `APP&WEB/website-v2.9/src/app/terranova/public/chapters/index.ts`. Metadata: `bookMetaPublic.ts`.

| TS modul | Markdown Composer (`UNIFIED/`) |
|----------|-------------------------------|
| `ch00-prolog` … `ch11-kompas` | `00-PROLOG.md` … `11-KOMPAS.md` |
| `chA-nvidia` | `A-NVIDIA-COMPUTE.md` |
| `chB-proroctvi` | `B-PROROCTVI.md` |
| `chC-zjeveni` | `C-ZJEVENI.md` |
| `chD-bhagavad-gita` | `D-BHAGAVAD-GITA.md` |
| `chE-zlata-stredni-cesta`, `chF-zaver-jedno-srdce` | **Jen na webu** — zatím nejsou ve UNIFIED/; přenos je samostatný redakční úkol. |

## Záměrně mimo stitch

- **`ORG/TerraNova-CTENARSKA-EDICE.md`** — jednosouborová čtenářská linie jiného řezu (sedm kroků).
- **`gemini/**`** — paralelní svět; nekomerční stitch bez schválení.
- **`Opus4.7/`** — AI-ko-autorská edice, paralelní k UNIFIED/.
- **`public/`** — veřejná technická edice.
- **`cloude/`** — rozšířené varianty kapitol.
