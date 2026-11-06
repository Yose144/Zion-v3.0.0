# REPORT 2026-11-06 — 5 jazyků: F2 hotová (269 klíčů) + F3 dávka 1 (karty avatarů)

> **Zadání 👤 (2026-11-05):** „cely ecosystem by mel podporovat nativne prepinani 5 jazyku,
> cz, en, sp, ptg, fr" + „jasny cestni cista ale preklady pak do jinych jazyku take".
> **Plán:** [`docs/plans/I18N-5-LANGUAGES.md`](docs/plans/I18N-5-LANGUAGES.md).
> **Předchozí krok (infrastruktura):** `REPORT_2026-11-05_SESSION_2.md` §4.

---

## 1. Co je hotové

| Vrstva | Stav |
|---|---|
| `Lang` = `cs/en/es/pt/fr` + `LangSwitcher` v navigaci | ✅ (2026-11-05) |
| Fallback `override → EN → CS` | ✅ |
| **Dávka 1 překladů es/pt/fr** | ✅ **76 klíčů × 3 jazyky** |

**Přeložené sekce** (vše, co je vidět na každé stránce): `nav` (46 řetězců — menu, skupiny,
přepínač, aria labely), `footer` (9), `notFound` (12), `docs` (4), `globalRouteError` (3),
`countdown` (2).

**Architektura:** nový `src/lib/translations-langs.ts` drží částečné překlady **mimo** základní
dvojici cs/en, takže `translations.ts` zůstává čitelný a překládat jde po dávkách. `tr()` zkouší
override → EN → CS (nikdy prázdný řetězec).

**Nepřekládá se:** vlastní jména a zkratky (`WARP`, `DAO`, `DEX`, `API`, `CEX`, `L2`/`L3`,
`Terra Nova`, `Te Pīko Ora`, `Uluru`, `Ekam`, `Kailash`, `Bodhi Lanka`, `Boa Esperança`,
`María del Camino`, `LUMI`, `Nabukano`, `Dharma Temple`, `Genesis`, `Guardian`, `Whitepapers`,
`G8 Run`, `Monitoring`, `Multichain Hub`, `Meme Lab`, `Mission Control`).

---

## 2. Ověřeno živě (deploy `20261106T000910Z`)

Navigace na produkci (`app.zionterranova.com`):

| jazyk | navigace |
|---|---|
| cs | Průzkumník · Pool · Síť · DAO · Dokumentace · Peněženka · Přehled · SÍŤ & MINING · TRH |
| en | Explorer · Pool · Network · DAO · Docs · Wallet · Dashboard · NETWORK & MINING · MARKET |
| **es** | **Explorador · Pool · Red · DAO · Documentación · Cartera · Panel · RED Y MINERÍA · MERCADO** |
| **pt** | **Explorador · Pool · Rede · DAO · Documentação · Carteira · Painel · REDE E MINERAÇÃO · MERCADO** |
| **fr** | **Explorateur · Pool · Réseau · DAO · Documentation · Portefeuille · Tableau de bord · RÉSEAU…** |

`html-lang` nese skutečný kód, `localStorage.zion-lang` se drží, 0 pageerror.
Smoke: `/`, `/l4-oasis`, `/l4-oasis/avatars`, `/docs`, `/market`, `/pool`, `/whitepapers`,
`/roadmap`, `/api/health` → **200**, neexistující cesta → **404**.

---

## 3. Pasti, které to odhalilo

1. **Souběžné buildy mažou `.next` pod rsyncem.** `deploy-web2.9.sh` spadl na
   `file has vanished (code 24)` a **nenasadil nic** (build se udělal, ale artefakt se
   nezkopíroval). Dvakrát za sebou.
   **Řešení:** build → **zkopírovat hotový artefakt mimo `.next`** (`cp -a` + `cp -al
   node_modules` + `rsync public/ .next/static/`) → `deploy-next-artifact.sh <artefakt>`, který
   už nic nečte z `.next`. Tím závod mizí.
   `deploy-next-artifact.sh` navíc **vyžaduje `node_modules/next`** v artefaktu — v monorepu je
   hoisted v `.next/standalone/node_modules`, takže se musí do artefaktu dohardlinkovat.
2. **Stale `.next/lock`** (0 B) po přerušeném buildu blokuje další build
   („Another next build process is already running"), i když nic neběží → `rm -f .next/lock`.
3. **`http2 on;`** v nginx konfiguraci je až od 1.25; EDGE má **1.24** → legacy
   `listen 443 ssl http2;` (jinak `nginx -t` spadne a reload neproběhne).

---

## 4. Co zbývá (F2 zbytek)

`hero` (44), `goldenEgg` (56), `ekamPage` (81), `features` (31), `docsRail` (17), `chv4` (15),
`onboard` (12), `whitepapers` (9) = **265 klíčů × 3 jazyky** ≈ 2–3 dávky.

Pak F3 OASIS (202 karet + 202 profilů + 714 questů), F4 Nirvana UI, F5 Archiv (189 kapitol),
F6 hreflang/sitemap.

---

## 5. Commity

```
52c5ebe98 feat(i18n): 5 jazyků v celém webu (cs/en/es/pt/fr) + přepínač v navigaci
00596703b     feat(i18n): první dávka překladů es/pt/fr (navigace, patička, 404, docs, chyby)
```

---

## 6. Navazující dávky (stejný den)

### F2 — dávka 2: zbytek `translations.ts` (193 klíčů × 3)

`hero` (42), `goldenEgg` (41), `ekamPage` (72), `features` (19), `chv4` (13), `docsRail` (9),
`onboard` (6), `whitepapers` (5). Překlady vloženy jako JSON spread do `translations-langs.ts`
(escaping bezpečně přes `JSON.stringify`). **Tím je `translations.ts` pokrytý celý: 269 klíčů ×
3 jazyky.** Ověřeno živě: homepage tagline i `/ekam` h1 v es/pt/fr přeložené, 11 stránek 200.

### F3 — dávka 1: karty avatarů (1 212 polí)

`subtitle` + `role` pro **všech 202 avatarů** v es/pt/fr (`scripts/oasis-avatar-copy/i18n-cards/`).
Generátor propouští jazyky, `LocalizedText` má volitelné `es/pt/fr`, stránka používá
`tx(field, lang)` s fallbackem `lang → en → cs`.

Ověřeno živě (deploy `20261106T111123Z`): 202 karet ve všech jazycích, subtitle karty i modalu
přeložený — Krishna „Integración Cósmica" / „Integração Cósmica" / „Intégration cosmique",
203 „Trinidad de la Madre Divina" / „Trindade da Mãe Divina" / „Trinité de la Mère divine".

### Co zůstává

- **F2b — page-local copy**: každá stránka má vlastní `{cs,en}` objekt (tree-of-life 127 klíčů,
  l6-issobella 76, avataři 63, maria-del-camino 58, kralovstvi-srdce 45, nabukano 44…). Není to
  součást `translations.ts`; chce samostatnou dávku.
- **F3 zbytek**: `location`, `questLine`, `teaching`, `ability`, `quote`, `essence` (202 × 6 × 3),
  714 questů, 202 profilů.
- F4 Nirvana UI, F5 Archiv, F6 hreflang/sitemap.

---

## 7. F2b — dávka 1: stránka avatarů (page-local copy)

Page-local texty nežijí v `translations.ts`, ale v objektech `{cs, en}` přímo ve stránkách
(67 souborů, ~1 522 klíčů). Místo přepisu každého objektu na 5 jazyků se překládá **anglický
řetězec**:

- `src/lib/i18n-tx.ts` — `tx5(entry, lang)` (entry → slovník → en → cs) a `t5(en, lang)`;
- `src/lib/ui-strings/avatars.{es,pt,fr}.json` — 47 řetězců stránky avatarů;
- stránka: 50 indexací `[cs ? 'cs' : 'en']` → `tx5(...)`, komponenty dostávají `lang`.

**Ověřeno živě** (deploy `20261106T113931Z`): placeholder hledání a filtry v 5 jazycích
(„Todos los rayos" / „Todos os raios" / „Tous les rayons"), 202 karet, 0 pageerror.

**Chyba z codemodu (chycena `tsc`):** inline náhrada rozbila načítání profilu
(`const lang = cs ? 'cs' : t5('en', lang)` — sebe-reference). Opraveno na
`profileLang = lang === 'cs' ? 'cs' : 'en'` (profily existují jen cs/en).

**Zbývá F2b:** 66 souborů / ~1 450 klíčů (tree-of-life 150, NewsFeed 115, l6-issobella 76,
maria-del-camino 58, kralovstvi-srdce 45, nabukano 44, ArchiveLock 42, …).

---

## 8. F2b — dávka 2: NewsFeed (82) + L6 Issobella (143)

Stejný vzor: slovník klíčovaný anglickým zněním, `Copy` objekty zůstávají nedotčené.
`i18n-tx.ts` teď slévává všechny slovníky per jazyk (`merge`), takže další stránka = jeden JSON
na jazyk + jeden import.

**Issobella měla 10 pomocných funkcí `getX(cs)` mimo komponentu** — `lang` v nich nebyl v scope,
takže dostaly druhý parametr (`getX(cs, lang)`) a 10 call sites ho předává.

**Ověřeno živě** (deploy `20261106T125944Z`): homepage (es) „NOTICIAS Y ACTUALIZACIONES",
„Noticias", „Últimas novedades del desarrollo del ecosistema ZION…", „Leer más";
`/l6-issobella` kicker cs „VESMÍRNÁ VRSTVA" → es „CAPA ESPACIAL DEL", pt „CAMADA ESPACIAL DO",
fr „COUCHE SPATIALE DE". 0 pageerror, `tsc` 0.

**Stav F2b:** hotovo 47 (avatarů) + 82 (NewsFeed) + 143 (Issobella) = **272 řetězců**;
zbývá ~1 250 v 64 souborech (tree-of-life 150, maria-del-camino 58, kralovstvi-srdce 45,
nabukano 44, ArchiveLock 42, …).

---

## 9. F2b — dávka 3: Strom života + Terra Nova (424 řetězců)

`tree-of-life` (219), `maria-del-camino` (90), `kralovstvi-srdce` (81), `nabukano` (34).
Codemod: 231 indexací → `tx5`, 21 inline ternárů → `t5`.

**Dvě pasti codemodu (obojí chyceno `tsc`):**
1. **Pole v copy objektech** (`Copy.quarterPoints` = `{cs: [...], en: [...]}`) — `tx5(...).map()`
   nevrací pole → `(lang === 'cs' ? X.cs : X.en).map(...)` (7 míst).
2. **`?.name[cs ? …]`** — codemod rozsekl optional chaining na `?.tx5(name, lang)` → opraveno.

**Navíc:** h1 `/terranova/kralovstvi-srdce` byl natvrdo česky ve všech jazycích → lokalizován
(Kingdom / Reino / Reino / Royaume).

**Ověřeno živě** (deploy `20261106T133709Z`): `/tree-of-life` a `kralovstvi-srdce` h1 v 5 jazycích,
0 pageerror, `tsc` 0.

**Stav F2b:** 272 + 424 = **696 řetězců** hotovo; zbývá ~830 v 60 souborech
(ArchiveLock 42, ContractsPageClient 39, KnihovnaPanel 35, zion-archive 35, whitepapers 35,
te-piko-ora 35, QvSection 34, team 32, golden-republic-bohemia 31…).

---

## 10. F2b — dávka 4: Archive, whitepapers, Te Pīko Ora (180 řetězců)

`ArchiveLock` (40), `zion-archive` (33), `whitepapers` (34), `te-piko-ora` (73).

**Tři pasti codemodu (vše chyceno `tsc`):**
1. `X?.prop[l]` → `category?.tx5(title, lang)` rozseklo optional chaining (3 místa).
2. Pole v copy (`{cs: [...], en: [...]}`) nesmí přes `tx5` (2 místa).
3. Dvě stránky čtou copy přes alias `const l = lang === 'cs' ? 'cs' : 'en'` → `Copy.x[l]`;
   nahrazeno `tx5(Copy.x, lang)` (49 + 32 míst), `l` zůstal pro formátování dat.

**Ověřeno živě** (deploy `20261106T141427Z`): ES „Documentación / Descargar",
PT „Documentação / ilha", FR „Documentation / Télécharger / île / oiseau",
`/zion-archive` „biblioteca, livro" / „bibliothèque, livre", 0 pageerror, `tsc` 0.

**Stav F2b:** 696 + 180 = **876 řetězců** hotovo; zbývá ~650 v 56 souborech
(ContractsPageClient 39, KnihovnaPanel 35, QvSection 34, team 32,
golden-republic-bohemia 31, l5-free-world, market, pool, explorer…).

---

# Pokračování: dávky 5–14 (2026-11-06, odpoledne a večer)

> Navazuje na §1–10 výše. Každá dávka: překlad es/pt/fr → codemod → `tsc` →
> `npm run build` → deploy artefaktu → **ověření živě v prohlížeči** → commit jen
> vlastních souborů → push. Souběžná session pracovala ve stejných adresářích
> (`i18n-tx.ts`, `Navigation`, `home.*.json`), proto se `i18n-tx.ts` nikdy
> nepřepisoval celý, jen vkládalo za existující řádek.

## 11. Dávka 5: ContractsPageClient, KnihovnaPanel, QvSection, tým (193)

`contracts` (39), `knihovna` (31), `qv` (30), `team` (93).

**Nová past:** `lang` nebyl v scope u modulových helperů, které skládaly data
mimo komponentu — `getContracts()`, `getSections()`, `getBooks()` a spol. musely
dostat druhý parametr. Týž vzorec se pak opakoval v **každé** další dávce
(celkem **~45 helperů**), takže se z něj stal standardní krok codemodu:
`const X = (cs: boolean)` → `(cs: boolean, lang: Lang)` + všechna volání
`X(cs)` → `X(cs, lang)`.

## 12. Dávka 6: L4 Oasis hub + Golden Republic Bohemia (192)

`l4hub` (123), `bohemia` (69) — hero, multivesmír, zóny, AI bridge, protokoly,
pooly, roadmapa; Living Centre, Říp, Libuše, fáze, financování.
**6 helperů** (`getMultiverseLayers`, `getZones`, `getAiBridge`, `getProtocols`,
`getPools`, `getRoadmap`) dostalo `lang`.

Ověřeno: hero „Un multiverso donde el j…" / „Um multiverso onde o jog…" /
„Un multivers où le jeu d…", status „Test mainnet activo/ativo/actif".

## 13. Dávka 7: Market / wZION hub (145)

Celá stránka `/market` — swap, WARP, výnosy, bridge, governance, DEX, CCA aukce,
telemetrie, kontrakty na Base.

**Dva ruční zásahy:** `BridgeHowItWorks` (modulová komponenta) dostal prop `lang`;
taby sekcí se nerenderovaly přes `cs ? 'x' : 'y'`, ale přes pole
`{ labelCs, labelEn }` → `{cs ? s.labelCs : t5(s.labelEn, lang)}` a doplněny
klíče `Overview` + `Earn`.

## 14. Dávka 8: Network + L5 Free World (334)

`network` (184) — hero, fakta o síti, infrastruktura, runtime panely, průvodci
připojením, FAQ, veřejné endpointy. `freeworld` (150) — hero, dvanáct nodů
planety, komunity, pre-mine alokace, protokoly, onboarding.

**Tři věci, které codemod sám nechytil:**
1. **Víceřádkové ternáry** `cs ? '…' : '…'` (13×) — původní regex zakazoval `\n`
   uvnitř řetězce, takže popisy komunit zůstávaly anglicky.
2. **Pole tagů** `tags: cs ? ['…'] : ['…']` a `tags: ['…']` — pole nejde poslat
   do `t5()`; nový helper **`t5a(items, lang)`** přeloží každý prvek s fallbackem
   na EN (13 polí, 29 tagů).
3. **`NetFAQSection`** dostal prop `lang`.

## 15. Dávka 9: DAO + L3 Hiran (365)

`dao` (197) a `hiran` (168); 12 helperů dostalo `lang` (`getPhases`, `getQuickLinks`,
`getFaqs`, `getOrchestration`, `getPillars`, `getProtocolPillars`, `getEvolution`,
`getModalities`, `getModelCards`, `getRagArch`, `getMarketplace`).

## 16. Dávka 10: Ekam Deeksha + AI Native (286)

`deeksha` (168), `ainative` (118).

**Dvě věci, které tahle dávka odhalila:**
1. **Obě stránky čtou copy jinak** — `Copy.x[lang === 'cs' ? 'cs' : 'en']`
   (ne `cs ? '…' : '…'`), takže je codemod s `cs ?` minul. Dořešeno cílenou
   náhradou `X[lang === 'cs' ? 'cs' : 'en']` → `tx5(X, lang)`: 185× deeksha +
   94× ainative.
2. **32 řetězců je vkládáno jako HTML** (`dangerouslySetInnerHTML`) — obsahují
   `<strong>`, `<em>`, `<br />`, `className="text-zion-cyan|purple"`, `&quot;`,
   `&apos;`. Překládal se jen lidský text mezi tagy, značky a entity zůstaly bajt
   na bajt (kontrola parity tagů: **0 neshod**).

## 17. Dávka 11: Genesis, Peněženka, Bódhi Lanka, Download (365)

`genesis` (116), `wallet` (100), `bodhilanka` (72), `download` (77).

**Zvláštnost:** 6 řetězců v `/download` je **fragmentů rozpůlených JSX odkazem**
(„The Desktop App will be available in our " + `<Link>` + " section of the docs…");
přeloženy jako gramatické pokračování, aby věta držela ve všech jazycích.

**Kolize se souběžnou session (main byl dočasně rozbitý):** commit `ce9bfbde9`
vzal `i18n-tx.ts` celý, včetně řádků, které do pracovního stromu přidala
paralelní session (`homeEs/homePt/homeFr` v merge). Soubory `home.*.json` ale
zůstaly untracked → čistý checkout by spadl na chybějícím modulu. Opraveno
následným commitem `20498236d`, který ty tři slovníky (19 klíčů) doplnil.

## 18. Dávka 12: Pool dashboard + benchmarks + QTC (363)

`pooldash` (228), `poolbench` (73), `poolqtc` (62).

**`timeAgo()`** skládal české tvary ručně (`před 5 s`) a pro ostatní jazyky posílal
do `t5()` dynamický template, který slovník nemůže pokrýt → přepsáno na
`Intl.RelativeTimeFormat(lang, { numeric: 'always', style: 'narrow' })`, což
nativně umí všech 5 jazyků bez tabulky. **16 dynamických `${…}` řetězců**
(„Difficulty ${…}", „Height ${…}", „The minimum payout is ${…} ZION…") přeloženo
s placeholdery bajt na bajt.

## 19. Dávka 13: Explorer, stav sítě, bridge tracker, Amenti, kniha (352)

`explorer` (66), `expstatus` (72), `expbridge` (67), `amenti` (72), `tnbook` (75).
`statusBadge`, `chapterKindLabel`, `formatChapterLabel` a `getQuickLinks` dostaly
`lang`. Šest dlouhých filozofických odstavců o Amenti překládáno jako plynulá
próza, ne doslovně po větách.

## 20. Dávka 14: Pool miners/kalkulačka/bloky + Mining (290)

`poolminers` (61), `poolcalc` (60), `poolblocks` (58), `mining` (111).

**Tři systémová místa se musela opravit, ne jen přeložit:**
- `timeAgo()` byl **znovu zduplikovaný** ve dvou souborech → `Intl.RelativeTimeFormat`.
- `fmtDuration()` skládal `${d}d ${h}h ${m}m`, což je ve všech pěti jazycích
  stejné — `t5()` tam byl zbytečný, vráceno na plain template.
- **Komponenty s vlastním `cs` prop** (`InsufficientData`, `DiscoveryChart`,
  `LuckChart`, `RewardChart`, `HashrateTimeline`, `DistributionDonut`) dostaly
  `lang`; jinak by překlad v grafech neměl odkud vzít jazyk.

---

## 21. Stav po dávce 14

| | hodnota |
|---|---:|
| přeložených řetězců (es = pt = fr) | **3 780** |
| stránek/komponent s vlastním slovníkem | **41** |
| souborů slovníků | **123** (41 × 3) |
| zbývá (soubory bez `i18n-tx`) | **3 241 klíčů / 161 souborů** |
| `tsc` | 0 chyb |
| `next build` | zelený |
| živý web | `https://app.zionterranova.com` 200 |

**Největší zbývající soubory:** `MissionControlDashboard` (188),
`MinerDashboard` (81), `DashboardClient` (64), `WarpBtcSwapWidget` (58),
`explorer/supply` (55), `explorer/address` (55), `cex` (55),
`terranova/dharma-temple` (54).

**Fallback funguje:** kde překlad chybí, `tx5()`/`t5()` vrátí angličtinu, nikdy
prázdný řetězec — web je tedy použitelný i v nedokončených částech.

## 22. Nález mimo rozsah i18n (neopravováno)

`/pool/qtc` a `/pool/benchmarks` vrací **500**, protože
`src/app/pool/[...path]/route.ts` má default `POOL_API_URL = http://pool:8080`
a hostname `pool` na EDGE2 neexistuje (`getaddrinfo EAI_AGAIN pool`).
Navíc `PoolQtcClient` i `PoolBenchmarksClient` **nejsou nikde importované** —
jde o mrtvé komponenty. Oprava by měla být jednořádková (nastavit
`POOL_API_URL` na skutečný pool API), ale je mimo zadání a může kolidovat
s prací jiné session, proto jen zapsáno.

## 23. Commity (dávky 5–14)

```
14ba24ac4  dávka 6 — L4 hub + Bohemia (192)
5d7314871  dávka 7 — market (145)
f717ba761  dávka 8 — network + free world (334)
78277e214  dávka 9 — dao + hiran (365)
cccc234d2  dávka 10 — deeksha + ai-native (286)
ce9bfbde9  dávka 11 — genesis + wallet + bodhi + download (365)
20498236d  fix — dotáhnout home.{es,pt,fr}.json
237313e57  dávka 12 — pool dashboard + benchmarks + qtc (363)
82a716a97  dávka 13 — explorer + amenti + kniha (352)
408836b8e  dávka 14 — pool subpages + mining (290)
```

Dávka 5 (`contracts`/`knihovna`/`qv`/`team`, 193) je v commitu před `14ba24ac4`.

---

## 24. Dávky 15–16 (večer 2026-11-06)

| dávka | obsah | řetězců |
|---|---|---:|
| 15 | Explorer supply (55) + address (60) + CEX (55) + Dharma Temple (57) + WARP BTC (60) | **287** |
| 16 | Mission Control (407) + Miner dashboard (84) | **491** |

### 🔴 Nález, který stál za to: hydration mismatch #418 na `/explorer/supply`

Nebyl to důsledek překladu — bug tam byl dřív, ale odhalil se až při ověřování
„0 pageerror" v každém jazyce. Dvě nezávislé příčiny:

1. `fmtZion`/`fmtFull` volaly `toLocaleString(undefined, …)`. Na serveru (Node)
   vyjde locale `en-US`, v prohlížeči locale uživatele → jiné oddělovače tisíců
   → React zahodí serverové HTML a překreslí (`#418`). Nahrazeno explicitním
   `'en-US'` (stejné, jaké stránka už používá pro počty bloků).
2. Graf `SupplyOverTimeChart` počítá popisky os z `Date.now()` — build a prohlížeč
   vyjdou na jiné dny. Vykresluje se proto až po `useEffect` mountu (do té doby
   prázdný blok stejné výšky, žádný layout shift).

Po opravě 0 pageerror ve všech čtyřech jazycích (předtím 1 v cs, 2 v es/pt/fr).

### Pasti codemodu v dávce 16

- `'… not today\'s launch blockers'` — escapovaný apostrof rozbil regex; vzniklo
  `t5('… not today\', lang)s launch blockers'`. Chyceno `tsc` (TS1005).
- `timeAgo()` se vyskytl **počtvrté** (jiná varianta, `pred …` bez diakritiky).
- `getTabs`, `getServiceGroups`, `getServiceActions`, `getFallbackReadinessMap`,
  `V3MetricsSection` — pět modulových celků bez `lang`.

## 25. Stav po dávce 16

| | hodnota |
|---|---:|
| přeložených řetězců (es = pt = fr) | **4 558** |
| stránek/komponent s vlastním slovníkem | **48** |
| souborů slovníků | **144** |
| zbývá | **2 695 klíčů / 154 souborů** |
| `tsc` | 0 |
| `next build` | zelený |
| živé ověření | 4 jazyky, 0 pageerror |

**Největší zbývající:** `DashboardClient` (64), `wallet/multichain` (52),
`dashboard/ch3` (48), `terranova/ekam` (47), `terranova/kailash` (46),
`FarmingPanel` (44), `terranova/uluru` (43), `explorer/block` (43),
`terranova/boa-esperanca` (42), `g8` (42).

Zbývající soubory jsou převážně **jednotlivé uzly Terra Nova** (ekam, kailash,
uluru, boa-esperanca, nova-amerika…) a **panely DeFi/dashboardu** — textově menší,
ale početné. Fallback na angličtinu funguje všude.

## 26. Commity (dávky 15–16)

```
0b3fecb43  dávka 15 — explorer supply/address + cex + dharma + warp btc (287)
   + fix hydration #418 na /explorer/supply
0d71271db  dávka 16 — mission control + miner dashboard (491)
```

## 27. Dávka 15 — doplnění: hero slider + WARP BTC widget (2026-11-06)

Dvě místa, která codemod dávky 15 minul:

- **`HeroSlider`** — `alt` popisky slidů, CTA label a `aria-label` (play/pause, „Slide N")
  čtou `tx5()`/`t5()`; slovník je `home.*.json`, který už existoval. Ověřeno živě:
  ES „Feliz Navidad…" / „Navidad 2026 · Kingdom", PT „Feliz Natal…" / „Natal 2026 · Kingdom",
  FR „Joyeux Noël…" / „Noël 2026 · Kingdom", `aria-label` „Diapositiva/Diapositivo/Diapositive 1".
- **`WarpBtcSwapWidget`** — pomocník `t()` vracel `Copy_map[k][cs ? 'cs' : 'en']`, takže
  i s hotovým `warpbtc.*.json` (60 klíčů) se v es/pt/fr zobrazovala angličtina. Teď
  `cs ? Copy_map[k].cs : t5(Copy_map[k].en, lang)`. Ověřeno živě na `/market` → záložka
  **WARP BTC/ZION**: 12–13 přeložených řetězců v každém jazyce (např. „¿Cuánto tarda un swap?",
  „Quanto tempo demora um swap?", „Combien de temps prend un swap ?"), 0 pageerror.

**Ověřovací sonda** (`.artifacts/probe/i18n-batch15.mjs`, gitignored): pro každou stránku a jazyk
počítá, kolik hodnot ze slovníku se reálně objeví v `innerText`, a kontroluje `<html lang>`.
Výsledek proti produkci (deploy `20261106T214149Z`): cex 24–27/29, explorer/supply 17–18/23,
explorer/address 4–5/26, dharma-temple 4/39, market/WARP 12–13/42 — **PASS**, 0 pageerror.
Past: `/explorer/address` v es jednou vrátil 0 shod (stránka se ještě načítala) — proto se
čeká 8 s a test se opakuje; a WARP widget se mountuje **až po kliknutí na záložku**, jinak
je 0 shod i správně přeložený.

Commit: `af666ad75`.
