# Terra Nova — Genealogie zdrojů a edic

Účel: jedna mapa celého `docs/TerraNova/`, aby šlo rozlišit **kanonickou prózu**, **technické rozšíření**, **literární fork** a **historické artefakty**.

---

## 1. Kanonická kniha (markdown)

| Umístění | Role |
|----------|------|
| **[`FINAL/`](../FINAL/)** | Definitivní sloučená próza po konsolidaci cloude + public + ORG (`FINAL/README.md`). Composer bere **jednotlivé kapitoly** jako zdroj pravdy pro stitch. |
| **[`FINAL/en/`](../FINAL/en/)** | Anglické překlady stejné kapitolové struktury. |
| **[`composer/edition/Full.md`](./composer/edition/Full.md)** | Jednosouborová česká „composer unified edition“ — generována skriptem z `FINAL/*.md`. |
| **[`composer/edition/Full-en.md`](./composer/edition/Full-en.md)** | Jednosouborová anglická edice — generována z `FINAL/en/*.md`. |

---

## 2. Vstupy konsolidace (již vstřebané do FINAL)

| Umístění | Charakter |
|----------|-----------|
| **[`cloude/`](../cloude/)** | Rozšířené varianty kapitol (`*-rozsirena.md`), kompilační kusy (`B-C-PROROCTVI-ZJEVENI.md`, `ZAVER-JEDNO-SRDCE.md`). |
| **[`public/`](../public/)** | Veřejná technická edice — TOC blízký FINÁLU; [`public/README.md`](../public/README.md) odkazuje na web `/terranova`. |
| **[`ORG/`](../ORG/)** | Organizační / čtenářská linie; **`ORG/TerraNova-CTENARSKA-EDICE.md`** — dlouhý souvislý rukopis „sedmi kroků“ + přílohy (jiná kompozice než dvanáct kapitol FINÁLU). |

---

## 3. Literární alternativa (explicitně vedle kanonu)

| Umístění | Role |
|----------|------|
| **[`gemini/`](../gemini/README.md)** | „Kód vědomí“ — Gemini edice; vlastní názvy souborů a narativní oblouk (`00-PROLOG-Hvezdny-Zahradnik.md`, …). Nepředpokládá se identické mapování na FINÁL bez ruční redakce. |
| **[`gemini/en/`](../gemini/en/)** | Anglická část Gemini světa. |

---

## 4. Historické a paralelní kapitoly v kořeni `docs/TerraNova/`

Tyto soubory představují **starší osu** nebo **draft rozšíření** před či vedle konsolidovaného FINÁLU. Jsou užitečné pro kontext a audity obsahu; nová práce na „jedné knize“ má vést přes **`FINAL/` + Composer**.

Příklady (ne vyčerpávající):

| Soubor | Poznámka |
|--------|----------|
| [`../00-SCENA.md`](../00-SCENA.md) | Otevření velkého horizontu ([`12-PLAN-KNIHY.md`](../12-PLAN-KNIHY.md) doporučuje jako prologový materiál). |
| [`../00b-MOST-ZE-TRI-KNIH.md`](../00b-MOST-ZE-TRI-KNIH.md) | Most ze tří knih — genealogicky před „čtyři knihy“. |
| [`../01-KOSMOLOGIE.md`](../01-KOSMOLOGIE.md), [`../02-VOLNA-ENERGIE.md`](../02-VOLNA-ENERGIE.md), … | Starší číslování bez sloupce FINÁLU „01 Most“. |
| [`../05-L1-L4.md`](../05-L1-L4.md), [`../05b-MEDICAL.md`](../05b-MEDICAL.md) | Rozštěpení vrstev před sloučením do „Architektura / Medicína“ ve FINAL. |
| [`../06-L5-SVOBODA.md`](../06-L5-SVOBODA.md), [`../07-ISSOBELLA.md`](../07-ISSOBELLA.md), [`../08-WARP-HVEZDY.md`](../08-WARP-HVEZDY.md) | Starší rozklad L5/L6/WARP. |
| [`../10-NVIDIA-COMPUTE.md`](../10-NVIDIA-COMPUTE.md), [`../11-PROROCTVI.md`](../11-PROROCTVI.md) | Později přemapováno do příloh **`FINAL/A-NVIDIA.md`**, **`FINAL/B-PROROCTVI.md`**. |
| [`../KOMPAS.md`](../KOMPAS.md) | Samostatný kompas před integrací do **`FINAL/11-KOMPAS.md`**. |
| [`../Full.md`](../Full.md) | Starší kořenový stitch — není automaticky synchronní s `FINAL/`. |

---

## 5. Projekty (aplikační síť příběhu)

**[`../Projects/`](../Projects/)** — konkrétní lokality / šablony (La Palma, Venus, Zahradní genesis, šablona L5 komunity). Nejsou povinné čtení hlavní osy knihy; propojují text s realizovatelnými scénáři.

---

## 6. Webová aplikace

| Umístění | Role |
|----------|------|
| **`APP&WEB/website-v2.9/src/app/terranova/`** | UI knihy; kapitoly v TS (`public/chapters/*.ts`). Metadata: **`bookMetaPublic.ts`**. |
| **`docs/reports/PLAN_2026-04-21_TERRANOVA_WEB_AND_CLI.md`** | Provozní plán webu / CLI — kontext distribuce. |

Synchronizace web ↔ Markdown je samostatný úkol; Composer manifest uvádí očekávané ID kapitol.

---

## 7. Redakční plán knihy

**[`../12-PLAN-KNIHY.md`](../12-PLAN-KNIHY.md)** — analytický dokument (drifty realita vs roadmap, Prague-only kanon, ekonomické konzistence). Composer charter na něj odkazuje jako na **TODO backlog** obsahu ve FINÁLU.

---

*Tento dokument aktualizujte při přidání nové podsložky edice.*
