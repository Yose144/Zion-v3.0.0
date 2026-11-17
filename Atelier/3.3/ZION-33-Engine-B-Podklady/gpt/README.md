# GPT zprávy — copy-paste

Tohle je to, co se vkládá do GPT. Každý soubor obstojí **sám** (role + kánon +
negativy + zadání + co vrátit), takže se nepřepíná mezi soubory.

| Soubor | Co to je | Kolik obrázků |
|---|---|---|
| `BATCH-6-ONBOARD-GPT.md` | hero pro /roadmap, /team, /ai-native, /status, /contact | 5 |
| `BATCH-7-NEWS-GPT.md` | hero pro 4 články novinek | 4 |
| `BATCH-8-MINE-GPT.md` | pásy 3:1 do /mine/* | 6 |
| `00-CELY-PAKET-GPT.md` | všechno v jednom (jen když nástroj dávky neumí) | 15 |

**Postup:** zkopíruj celý soubor → vlož do GPT jako jednu zprávu → nech vygenerovat
→ stáhni PNG a pojmenuj přesně podle id (`<id>__master.png`).

**Proč po dávkách:** 15 obrázků v jednom běhu = klesá konzistence i kvalita.
Dávka 6 je první; ideálně začni jedním obrazem (`onboard-roadmap-hero`) na
schválení barvy a zrna, pak zbytek.

**Co pak:** PNG hoď do složky/ZIPu a předej — převezme to
`3.3.0/scripts/ingest-engine-b.mjs` (viz `Atelier/3.3/README.md`).

Generováno z `new-assets.json`; needituj tady.
