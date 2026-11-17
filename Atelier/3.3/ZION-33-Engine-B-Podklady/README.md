# ZION 3.3 · Engine B

Pracovní podklady k ilustracím a jejich zapojení na Bráně. Stav ověřený proti GitHubu 17. listopadu 2026.

## Kde se co tvoří

| Část | Zdroj a role |
| --- | --- |
| Tvůrčí zadání | `Zion-v3.0.0/Atelier/3.3/engine-b/new-assets.json` drží ID, scény, cílové soubory, rozměry a alternativní texty. Generátor z něj odvozuje tři dávky, CSV a importní specifikaci. |
| Výtvarný kánon a implementace | `Zion-3.3Nirvana/design/engine-b/prompts/prompts.json` je zdroj stylu a kánonu pro generátor. `packages/ui` drží vizuální komponenty a tokeny. `design/manifest.json` eviduje hotové assety. |
| Brána | `apps/onboard` je cíl všech 15 ilustrací z tohoto zadání. |
| Ostatní části 3.3 | `apps/portal` je dokumentace a uživatelská vrstva, `apps/kingdom` je 3D a sociální klient, `apps/market` je obchod, `apps/ops` je provozní přehled. ZIS a realtime běží jako samostatné služby. |

[Zadání Ateliéru](https://github.com/Yose144/Zion-v3.0.0/blob/25f7f4ebace7ce58f3c1a5810a79e4b6a10aaeef/Atelier/3.3/README.md) · [Master plán 3.3](https://github.com/Yose144/Zion-3.3Nirvana/blob/a9221f39669ab39daa071c5bb3c24241ae6ba2ef/v3.3Nirvana.md) · [Vizuální standard](https://github.com/Yose144/Zion-3.3Nirvana/blob/a9221f39669ab39daa071c5bb3c24241ae6ba2ef/docs/architecture/ENGINE-B.md)

## Výrobní pořadí

| Dávka | Plochy | Obrazový výstup | Zapojení |
| --- | --- | --- | --- |
| 6 · Onboard | `/roadmap`, `/team`, `/ai-native`, `/status`, `/contact` | 5 hero. PNG 2048 × 1152. WebP 1672 × 941 a 960 × 540. | Roadmap, Team a AI-native sdílejí `ArticlePage`. Status a Contact mají vlastní stránky. |
| 7 · Novinky | Články Engine B, Mainnet Beta, odložený launch a interní audit | 4 hero. PNG 2048 × 1152. WebP 1600 × 900 a 960 × 540. | Vyplnit čtyři vlastnosti `hero` v `apps/onboard/src/content/news.json`. Šablona článku čte `image` a `alt`. Pro zobrazení mobilního souboru zapojit i `imageMobile`. |
| 8 · Těžba | `/mine/blocks`, `/mine/payouts`, `/mine/miners`, `/mine/calculator`, `/mine/status`, `/mine/faq` | 6 pásů 3:1. PNG 2048 × 683. WebP 1600 × 533 a 960 × 320. | Nízký pás nad obsahem s kontrolou čitelnosti a polohy tabulky na mobilu. |

Jako první obraz z dávky 6 je vybraný `onboard-roadmap-hero`. Rozložená mapa letu a dřevěné modely lodí mají vyprávět o etapách cesty. Scénu drží jediná jantarová lucerna nad prací v pravé části obrazu. Levá třetina zůstává tmavá a klidná pro HTML titulek. Po schválení barvy, zrna a kontrastu se podle tohoto vzoru doladí další čtyři obrazy dávky.

Přehled `/news` už čte `news-index-engine-b-1600.webp` a mobilní variantu. Vánoční článek už má vlastní hero. Hlavní `/mine` má vlastní hero a šest důlních pásů patří do podstránek.

[Šablona statických článků](https://github.com/Yose144/Zion-3.3Nirvana/blob/a9221f39669ab39daa071c5bb3c24241ae6ba2ef/apps/onboard/src/components/ArticlePage.tsx) · [Data Novinek](https://github.com/Yose144/Zion-3.3Nirvana/blob/a9221f39669ab39daa071c5bb3c24241ae6ba2ef/apps/onboard/src/content/news.json)

## Výtvarná pravidla

Malované prostředí s viditelnou texturou, výběrová komiksová linka, čitelná silueta a jedna hlavní akce. Hlavní světelný bod je jantarový. Paleta je inkoust `#101C2B`, les `#344A36`, pergamen `#F0E1BE`, jantar `#E7AA4B` a rez `#9D493D`. Rasta je značková vrstva, zejména na Bráně a Marketu. Pro aktuálních 15 obrazů platí kompozice z master promptu a zadání jednotlivých ploch.

Držet tmavou levou třetinu bez detailů, ověřit ji s titulkem a mobilní variantou. Vynechat text, čísla, značky, UI a rámy. Zvlášť zkontrolovat ruce u roadmapy, auditora a výplat. Lampy na stavových výjevech slouží jako obrazová metafora. Aktuální stav sítě patří do živých dat a textu stránky.

One Love 3.2 je technický a příběhový základ. Sůl této země propojuje podobenství s ověřitelnými fakty. Mise Amenti dává 3.3 rámec důkazu, stavby, horizontu a příběhu. Nirvana a orbitální Issobella jsou v příslušných scénách horizont a vize. Hiran je ve výtvarném standardu zlatá sféra světla.

[One Love 3.2](https://github.com/Yose144/Zion-v3.0.0/blob/25f7f4ebace7ce58f3c1a5810a79e4b6a10aaeef/canon/books/ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_CZ.md) · [Sůl této země](https://github.com/Yose144/Zion-v3.0.0/blob/25f7f4ebace7ce58f3c1a5810a79e4b6a10aaeef/canon/books/SulZeme/00-README.md) · [Mise Amenti](https://github.com/Yose144/Zion-v3.0.0/blob/25f7f4ebace7ce58f3c1a5810a79e4b6a10aaeef/canon/books/MiseAmenti/README.md)

## Betlém a existující 3D modely

Herní roster ve `V31/L4/oasis/data/avatars.json` má 202 záznamů a registr `apps/nirvana/src/core/avatars/models.ts` má 201 modelů. Jediná mezera je Mahatma Gandhi, herní ID 37, s procedurální zálohou. Vizuální identitu postav v detailu ověřovat proti portrétu, autorskému zadání a modelu. Dnešní prostorová studie Betlému načítá 200 položek z vlastního rosteru a staví jejich siluety v JavaScriptu.

| Postava | Klíč Betlému | Model 3.2 |
| --- | --- | --- |
| Krishna-Maitreya | `OASIS-001` | `/models/avatars/0.glb` |
| Rama | `OASIS-002` | `/models/avatars/1.glb` |
| Sita | `OASIS-003` | `/models/avatars/2.glb` |
| Maitreya | `OASIS-005` | `/models/avatars/4.glb` |
| Radha | `OASIS-016` | `/models/avatars/16.glb` |
| Malý princ | `OASIS-046` | `/models/avatars/43.glb` |
| Lumi / Elizabet | `OASIS-049` | `/models/avatars/40.glb` |

Párovat podle identity a portrétu, protože převod čísla není jednotný. U Maitreyi má přednost pozdější autorská reference z Betlému a V2, kde je třináctiletý a světlovlasý. Světlovlasá Sarah Issobela stojí po jeho boku. Její totožnost se musí před použitím jakéhokoli GLB ověřit vůči autorské referenci, stejně jako identita dalších předních figur. Orbitální Issobella je prstencová stavba v pozadí vize. U dřevěné V2 je samostatným výstupem řezaná silueta a gravírovaný detail. Rozpočet je 16 A3 na model, jedna zkušební a jedna rezervní deska. Konečné rozmístění výrobních křivek a tolerance spojů přijdou v další fázi.

[Scéna Betléma](https://github.com/Yose144/Zion-v3.0.0/blob/25f7f4ebace7ce58f3c1a5810a79e4b6a10aaeef/Atelier/Betlem/README.md) · [Dřevěná V2](https://github.com/Yose144/Zion-v3.0.0/blob/25f7f4ebace7ce58f3c1a5810a79e4b6a10aaeef/Atelier/Betlem/laser-v2/Navrh.md) · [Registr GLB](https://github.com/Yose144/Zion-v3.0.0/blob/25f7f4ebace7ce58f3c1a5810a79e4b6a10aaeef/apps/nirvana/src/core/avatars/models.ts)

## Předání obrazové dávky

1. Použít původní master prompt ze složky `podklady/` společně s jedním dokumentem dávky. Prompty a popisy jsou původní snapshot z GitHubu. Při změně zadání upravit `new-assets.json` ve zdrojovém repozitáři a přegenerovat odvozené soubory.
2. Pro jednotlivé obrazy použít `images/<id>__master.png`, `images/<id>-1600.webp` a `images/<id>-960.webp`. Přípona webové varianty odpovídá projektu, skutečný rozměr určuje specifikace. Onboard tedy může mít `-1600.webp` široký 1672 px. Přiložit manifest dávky s ID, rozměry a modelovým původem. Exportovat neprůhledný sRGB master a optimalizované WebP do 500 kB na soubor.
3. Pro import jedné dávky použít odpovídající soubor ze složky `spec/`. Import iteruje přes všechna ID ve specifikaci, takže s úplnou specifikací by u dílčího ZIPu ohlásil ostatní dávky jako chybějící. Skript v aktuálním commitu načítá `sharp` z `../node_modules/sharp`, tedy z nadřazeného workspace vůči kořenu 3.3.
4. Spustit kontrolní import z repozitáře 3.3 s absolutními cestami. `--dry-run` může založit cílové adresáře, ale nekopíruje soubory a nepřepisuje manifest. Po schválení zopakovat příkaz bez `--dry-run`, napojit obrázky v komponentách a ověřit desktop i mobil.

```bash
node scripts/ingest-engine-b.mjs /cesta/ZION-33-ONBOARD-Engine-B.zip --dry-run --spec /cesta/spec/batch-6-onboard.json
```

[Importní skript](https://github.com/Yose144/Zion-3.3Nirvana/blob/a9221f39669ab39daa071c5bb3c24241ae6ba2ef/scripts/ingest-engine-b.mjs)

## Cílové soubory

Všechny cesty v tabulce vedou pod `apps/onboard/public/`.

| Dávka | ID | Desktop | Mobil |
| --- | --- | --- | --- |
| 6 | `onboard-roadmap-hero` | `images/roadmap/hero.webp` | `images/roadmap/hero-m.webp` |
| 6 | `onboard-team-hero` | `images/team/hero.webp` | `images/team/hero-m.webp` |
| 6 | `onboard-ai-native-hero` | `images/ai-native/hero.webp` | `images/ai-native/hero-m.webp` |
| 6 | `onboard-status-hero` | `images/status/hero.webp` | `images/status/hero-m.webp` |
| 6 | `onboard-contact-hero` | `images/contact/hero.webp` | `images/contact/hero-m.webp` |
| 7 | `news-engine-b-hero` | `images/news/engine-b-2026-11-12/hero-1600.webp` | `images/news/engine-b-2026-11-12/hero-960.webp` |
| 7 | `news-mainnet-beta-hero` | `images/news/mainnet-beta/hero-1600.webp` | `images/news/mainnet-beta/hero-960.webp` |
| 7 | `news-launch-postponed-hero` | `images/news/launch-postponed/hero-1600.webp` | `images/news/launch-postponed/hero-960.webp` |
| 7 | `news-v3-internal-audit-hero` | `images/news/v3-internal-audit/hero-1600.webp` | `images/news/v3-internal-audit/hero-960.webp` |
| 8 | `mine-blocks-strip` | `images/mine/blocks.webp` | `images/mine/blocks-m.webp` |
| 8 | `mine-payouts-strip` | `images/mine/payouts.webp` | `images/mine/payouts-m.webp` |
| 8 | `mine-miners-strip` | `images/mine/miners.webp` | `images/mine/miners-m.webp` |
| 8 | `mine-calculator-strip` | `images/mine/calculator.webp` | `images/mine/calculator-m.webp` |
| 8 | `mine-status-strip` | `images/mine/status.webp` | `images/mine/status-m.webp` |
| 8 | `mine-faq-strip` | `images/mine/faq.webp` | `images/mine/faq-m.webp` |

Ověřeno vůči zdrojům obou repozitářů a referenčním archivům Engine B. Původní generátor `build-briefs.mjs --check` potvrdil shodu všech 15 zadání. Specifikace v `spec/` jsou odvozené beze změny jednotlivých záznamů. Tento balíček obsahuje produkční zadání, mapu souborů a postup předání. Generování ilustrací, import s reálnými obrazy a kontrola živého webu jsou další fáze.
