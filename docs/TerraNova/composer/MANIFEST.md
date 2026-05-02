# Composer manifest — pořadí a mapování

## Česká kanonická řada (zdroj stitch)

Soubory z [`../FINAL/`](../FINAL/) v tomto pořadí:

| Pořadí | Soubor | Téma (krátce) |
|--------|--------|----------------|
| 00 | [`FINAL/00-PROLOG.md`](../FINAL/00-PROLOG.md) | Prolog Issobella |
| 01 | [`FINAL/01-MOST.md`](../FINAL/01-MOST.md) | Most čtyř knih |
| 02 | [`FINAL/02-KOSMOLOGIE.md`](../FINAL/02-KOSMOLOGIE.md) | Kosmologie · Hiranyagarbha · L1–L6 |
| 03 | [`FINAL/03-VOLNA-ENERGIE.md`](../FINAL/03-VOLNA-ENERGIE.md) | Volná energie |
| 04 | [`FINAL/04-KOMUNITY.md`](../FINAL/04-KOMUNITY.md) | Komunity |
| 05 | [`FINAL/05-AI-NATIVE.md`](../FINAL/05-AI-NATIVE.md) | AI Native |
| 06 | [`FINAL/06-MEDICINA.md`](../FINAL/06-MEDICINA.md) | Medicína Nové Země |
| 07 | [`FINAL/07-ARCHITEKTURA.md`](../FINAL/07-ARCHITEKTURA.md) | Architektura L1→L4 |
| 08 | [`FINAL/08-SVOBODA.md`](../FINAL/08-SVOBODA.md) | Svět Svobody L5 |
| 09 | [`FINAL/09-ISSOBELLA.md`](../FINAL/09-ISSOBELLA.md) | Issobella L6 |
| 10 | [`FINAL/10-WARP.md`](../FINAL/10-WARP.md) | WARP |
| 11 | [`FINAL/11-KOMPAS.md`](../FINAL/11-KOMPAS.md) | Zlatý Kompas |
| A | [`FINAL/A-NVIDIA.md`](../FINAL/A-NVIDIA.md) | Příloha NVIDIA |
| B | [`FINAL/B-PROROCTVI.md`](../FINAL/B-PROROCTVI.md) | Příloha Proroctví |
| C | [`FINAL/C-ZJEVENI.md`](../FINAL/C-ZJEVENI.md) | Příloha Zjevení |
| D | [`FINAL/D-BHAGAVAD-GITA.md`](../FINAL/D-BHAGAVAD-GITA.md) | Příloha Bhagavad Gītā |

Skript [`scripts/build-full-md.sh`](./scripts/build-full-md.sh) používá přesně tuto řadu.

## Anglická řada

Stejná čísla v [`../FINAL/en/`](../FINAL/en/). Stitch:

```bash
bash docs/TerraNova/composer/scripts/build-full-en-md.sh
```

→ výstup [`edition/Full-en.md`](./edition/Full-en.md).

## Mapování na web (public TS edice)

Export **`CHAPTERS_PUBLIC`**: `APP&WEB/website-v2.9/src/app/terranova/public/chapters/index.ts`. Metadata: `bookMetaPublic.ts`.

| TS modul | Markdown Composer (`FINAL/`) |
|----------|-------------------------------|
| `ch00-prolog` … `ch11-kompas` | `00-PROLOG.md` … `11-KOMPAS.md` |
| `chA-nvidia` | `A-NVIDIA.md` |
| `chB-proroctvi` | `B-PROROCTVI.md` |
| `chC-zjeveni` | `C-ZJEVENI.md` |
| `chD-bhagavad-gita` | `D-BHAGAVAD-GITA.md` |
| `chE-zlata-stredni-cesta`, `chF-zaver-jedno-srdce` | **Jen na webu** — zatím nejsou ve FINÁLU ani ve stitch `edition/Full.md`; přenos je samostatný redakční úkol. |

Samostatná „unified web“ linie (`bookData.ts`) může mít jiné složení příloh — synchronizaci s markdown kanálem řešte jen pokud je produktově nutná.

## Záměrně mimo stitch

- **`ORG/TerraNova-CTENARSKA-EDICE.md`** — jednosouborová čtenářská linie jiného řezu (sedm kroků); merge do FINAL jen cíleným redakčním tahem.
- **`gemini/**`** — paralelní svět; nekomerční stitch bez schválení.
