# Atelier 3.3 — podklady pro Engine B

Pracovní stůl pro vizuální prvky nového webu **3.3** (`3.3.zionterranova.com`).
Tady jsou **zadání a prompty**; hotové obrázky se vracejí jako ZIP a nasazují
se do `3.3.0`.

> **Proč to není v `3.3.0/design/`:** tam bydlí *hotové* assety a manifest.
> Tady je jen to, co ještě neexistuje — aby se zadání nemíchalo s výstupem.

## Co tu je

```
atelier/3.3/engine-b/
  new-assets.json            ← jediný zdroj zadání (id, cíl, poměr, alt, prompt)
  build-briefs.mjs           ← generátor podkladů (níž)
  00-GPT-MASTER-PROMPT.md    ← role + styl + kánon + negativy (první zpráva do GPT)
  BATCH-6-ONBOARD.md         ← 5 hero ploch, které dnes nemají art
  BATCH-7-NEWS.md            ← 4 hero pro články
  BATCH-8-MINE.md            ← 6 pásů 3:1 do utilitních stránek /mine/*
  prompts.csv                ← přehled pro rychlou kontrolu
  assets.json                ← strojově čitelný seznam pro pipeline
```

Styl, kánon a negativy **nejsou v tomhle adresáři opsané ručně** — generátor je
bere z kanonického `3.3.0/design/engine-b/prompts/prompts.json`. Když se změní
kánon, změní se tam a podklady se vygenerují znovu:

```bash
node atelier/3.3/engine-b/build-briefs.mjs          # přepíše markdown + csv + assets.json
node atelier/3.3/engine-b/build-briefs.mjs --check  # jen ověří, že sedí
```

Zadání se needituje v markdownu — editoval bys ho při každém generování znovu.
**Edituj `new-assets.json`**, pak pusť generátor.

## Co dnes chybí (stav 2026-11-17)

| Batch | Ploch | Co to je | Stav |
|---|---|---|---|
| 6 — Onboard | 5 | `/roadmap`, `/team`, `/ai-native`, `/status`, `/contact` — dnes **jen text, žádný hero** | ⏳ zadání hotové |
| 7 — Novinky | 4 | hero pro články `engine-b-2026-11-12`, `mainnet-beta`, `launch-postponed`, `v3-internal-audit` (vánoční edice hero má) | ⏳ zadání hotové |
| 8 — Těžba | 6 | pásy `3:1` do `/mine/blocks`, `/payouts`, `/miners`, `/calculator`, `/status`, `/faq` | ⏳ zadání hotové |

Hotové plochy (nedělat znovu): Brána, Amenti, Vzestup, Příběh, Svět, Těžit (hero),
Podpora, nové hero Novinek, Kingdom (room/avatars/games/rings), Portal
(explorer/wallet/docs). Přehled: `3.3.0/design/manifest.json`.

## Jak to použít

1. Otevři `00-GPT-MASTER-PROMPT.md`, zkopíruj celý jako první zprávu.
2. Pošli jednu dávku (`BATCH-6…`, `BATCH-7…`, `BATCH-8…`) — **ne všechny najednou**.
3. Obrázky vracej v ZIPu: `heros/3.3/ZION-33-<TÉMA>-Engine-B.zip`
   ```
   ZION-33-ONBOARD-Engine-B/
     images/<id>__master.png      ← PNG, neprůhledné, sRGB, 2048×1152 (strips 2048×683)
     images/<id>-1600.webp        ← hero: 1672×941 / 1600×900, strips: 1600×533
     images/<id>-960.webp         ← hero: 960×540, strips: 960×320
     manifest.json                ← id, soubor, width, height, model, poznámky
     README.md                    ← co je hotové, co chybí, odchylky od zadání
   ```
4. Já to převezmu: `node 3.3.0/scripts/ingest-engine-b.mjs heros/3.3/<balíček>.zip`
   ověří balíček proti `assets.json`, zkopíruje soubory do
   `3.3.0/apps/<app>/public/…` a zapíše je do `3.3.0/design/manifest.json`
   (sha256, bytes). Pak už jen napojím `Hero`/pás v komponentách a nasadím —
   skript vypíše seznam stránek, kde obrázek ještě chybí.

## Co musí obrázek splnit (jinak se vrací)

- **Přesný poměr a minimální rozlišení** podle `assets.json` (hero 16:9 master
  2048×1152, pás 3:1 master 2048×683).
- **Text-safe zóna opravdu tmavá a prázdná** — vlevo (u pásů vlevo), aby na ni
  šel titulek bez stínu. To je jediné pravidlo, které rozhoduje o použitelnosti.
- **Žádný text, logo, UI, watermark, rámeček**; žádné čitelné nápisy ani čísla
  (ani na mapách, knihách, tabulích, vlajkách).
- **Kánon sedí** (`00-GPT-MASTER-PROMPT.md`): Lumi je dítě s lucernou, Hiran je
  zlatá koule světla (ne postava), žádné filmové lodě ani cizí postavy.
- **Paleta enginu B** (inkoust, les, pergamen, jantar, rez); jeden teplý zdroj
  světla, zbytek do inkoustového stínu.

## Poznámky k jednotlivým dávkám

- **Batch 6** — pět ploch drží stejnou kompozici jako ostatní hero (text vlevo).
  `/team` záměrně bez konkrétních portrétů (fiktivní postavy, ne reální lidé).
- **Batch 7** — články jsou starší (12.–13. 11.), obrázky jsou **evergreen**:
  nemají ilustrovat konkrétní číslo ani datum, jen téma.
- **Batch 8** — pásy nejsou hero: na utilitní stránce se nesmí vytlačit tabulka
  pod fold. `3:1` je strop; když bude obrázek nižší, je to plus.
