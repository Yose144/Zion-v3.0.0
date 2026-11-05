# REPORT 2026-11-05 — OASIS avataři: dvojjazyčný kánon dokončen, nasazen a ověřen

> **Rozsah:** profily 200 OASIS avatarů v `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/` — překlady,
> generátor, kontrola a nasazení na `app.zionterranova.com/l4-oasis/avatars`.
> **Navazuje na:** `REPORT_2026-11-04_OASIS_AVATAR_I18N.md` (první dávka) a
> `REPORT_2026-11-04_AVATARI_WEB.md` (karty + questy).
> **Plán:** [`PLAN_OASIS_AVATAR_I18N.md`](../../PLAN_OASIS_AVATAR_I18N.md) — uzavřený.

---

## 1. Výsledek

| Metrika | Před | Po |
|---|---:|---:|
| Avatarů s **oběma jazyky** | 182 / 200 | **202 / 202** |
| `i18n/*.en.md` | 141 | **157** |
| `i18n/*.cs.md` | 47 | **47** |
| Publikovaných profilů (`public/data/oasis/profiles/`) | 382 | **404** (202 kánonů + 202 překladů) |
| Párů v **paritě s kánonem** | — | **202 / 202** |
| `check-oasis-i18n.mjs` | — | **0 problémů** |

Přeloženo **16 profilů** (CS→EN, 332 kB): `08` Issobela, `40` Lumi, `41` Vasudeva,
`42` Sri Dattatreya, `43` Maly Princ, `51` Dalai Lama XIV, `52` Heȟáka Sápa a havajský kruh
`62`–`70` (nejdelší profily kánonu, 17–29 tis. znaků každý).

Doplněno **10 českých překladů**, které byly ořezané nebo neúplné (223 kB): `50` ZION The Last
City, `48` Morpheus, `47` Trinity, `46` Neo, `23` Král Artuš, `38` Panna Maria, `39` Subhadra,
`00` Krishna-Maitreya, `44` Hiranyagarbha, `45` Sri Kalki.

---

## 2. Pět reálných chyb, které práce odhalila

1. **ID 43 zobrazovalo jinou postavu.** Pro ID 43 existují v kánonu dva soubory
   (`43_MALY_PRINC.md`, `43_SRI_ANAGHA_LAKSHMI.md`) a generátor bral **poslední podle
   `readdir`** → karta „Maly Princ" otevírala profil **Anaghy Lakshmi**. Doloženo na živém
   `43.cs.md`. Nově rozhoduje **roster** (`V31/L4/oasis/data/avatars.json` +
   `AVATAR_ROSTER.md`: 42 = Dattatreya, 43 = Maly Princ) funkcí `resolveProfile(id, name)`.
   Soubory se **nepřejmenovávají** — odkazuje na ně korpus (`85_LAKSHMI.md`,
   `45_SRI_KALKI_AVATAR.md`, `i18n/44.cs.md`, `README.md`, `GOLDEN_EGG_GAME/*`).
2. **Dva avataři v plánu chyběli.** `09_SHANTI` a `44_HIRANYAGARBHA` mají **anglický kánon**,
   ale `detectLang()` je kvůli fallbacku `cs` vyhodnotil jako české → publikoval se anglický
   text jako `.cs.md` a hotový **český překlad se zahazoval**. Fallback teď rozhoduje většina
   (mění jazyk jen u těchto dvou ID).
3. **Kánony 44 a 45 byly zpola české** — EN modal ukazoval české odstavce („Není MUŽ ani ŽENA…").
   Doplněno do angličtiny přímo v kánonu, struktura 1:1; česká verze zůstává v `i18n/44.cs.md`
   a `i18n/45.cs.md`.
4. **Starší EN→CS překlady byly kondenzované** — český modal ukazoval kratší text než anglický:
   50 ZION 40 %, 48 Morpheus 43 %, 47 Trinity 51 %, 46 Neo 71 % kánonu. Doplněno do plné parity.
5. **Rozbité odkazy v překladech** — `44`/`45` mířily na nekanonické `42_SRI_CHAITANYA…` /
   `43_MALY_PRINC`, `00` nemělo 3 odkazy, `81` odkaz „Další". Srovnáno s kánonem.

---

## 3. Nástroj, který to hlídá

`apps/website-v2.9/scripts/check-oasis-i18n.mjs` (nový) — pro všech 200 avatarů ověří:

- existenci **obou** publikovaných profilů (`<id>.cs.md`, `<id>.en.md`), neprázdnost, `cs ≠ en`
- **EN bez českých vět** (per-řádková heuristika) a **CS s českou složkou**
- **kanonický soubor podle rosteru** (kolize ID 42/43)
- **paritu s kánonem**: počet nadpisů, počet code bloků, množinu odkazů, zkrácení pod 85 %
- existenci protějšku v `i18n/`

`--verbose` vypíše per-avatar řádky, `--json` strojový výstup, exit code 1 při problému.

```bash
node apps/website-v2.9/scripts/check-oasis-i18n.mjs
# ✓ avatarů: 200 | profilů v public/data: 400 (očekáváno 400) | problémů: 0
```

**Opravy generátoru** (`scripts/gen-oasis-avatars.mjs`): `resolveProfile()` (roster-authoritative),
`detectLang()` (většinové pravidlo místo fallbacku `cs`), a explicitní
`i18n/<id>.<baseLang>.md` má přednost před kánonem — díky tomu se u `08` publikuje čistší
čeština z `i18n/08.cs.md` místo dvojjazyčného kánonu.

---

## 4. Nasazení

Změna je **datová** (`public/data/oasis/profiles/*.md`); `src/lib/oasis/avatars.ts` i stránka
jsou beze změny, takže **rebuild nebyl potřeba** — profil se do modalu tahá lazy fetchí
`/data/oasis/profiles/<id>.<lang>.md`. Nasazeno hot-file cestou (menší riziko než build, který
by do produkce vzal i rozdělanou práci paralelních sessions):

```bash
rsync -az --delete apps/website-v2.9/public/data/oasis/profiles/ \
  zion-edge2:'/opt/zion/APP&WEB/website-v2.9/.next/standalone/public/data/oasis/profiles/'
ssh zion-edge2 'chown -R zion:zion …/profiles && systemctl restart zion-website'
```

⚠️ **Restart `zion-website` je povinný** — nové cesty v `public/` vrací 404, dokud standalone
server neaktualizuje manifest. Server servíruje `public/` jen z `.next/standalone/public/`.
Na serveru: 382 → **400** souborů.

---

## 5. Ověření (proti produkci)

| Kontrola | Výsledek |
|---|---|
| `check-oasis-i18n.mjs` | **0 problémů** / 200 párů |
| Generátor — idempotence | **beze změny** (`avatars.ts` i profily) |
| `npx tsc --noEmit` (website-v2.9) | **0 chyb** |
| Všech **400** souborů na živém webu | **400× HTTP 200** |
| **SHA-256 local vs. live** (všech 400 souborů) | **400/400 byte-identical** |
| **Funkční test modalu** — 12 avatarů × CS/EN | **24/24 OK**, 0 pageerror, 0 profilů s !200 |
| Smoke (`/`, `/l4-oasis`, `/l4-oasis/avatars`, `/api/health`) | **200** |

Kontrola přežila i **plný deploy paralelní session** (2026-11-05 00:33) — proto se obsah
porovnává SHA-256, ne jen HTTP kódem.

**Ukázka z funkčního testu** (modal v obou jazycích, hledaná věta z profilu):

| avatar | CS | EN |
|---|---|---|
| 43 Maly Princ | „Strážce Růže" | „Guardian of the Rose" |
| 09 Shanti | „mír, mír, mír" | „Peace Peace Peace" |
| 70 Hina | „Tkám kapa na Měsíci" | „I weave kapa on the Moon" |
| 50 ZION | „Meditace obléhání" | „The Siege Meditation" |

---

## 6. Commity

```
2e2763e64 feat(oasis): dvojjazyčné profily avatarů dokončeny (200/200) + opravy generátoru
d61316ccd docs(oasis): plán i18n uzavřen — překlady hotové, deploy a nálezy session 2
b69535563 docs(oasis): i18n avatařů hotovo a nasazeno — live ověření CS/EN v modalu
e34471d46 feat(oasis): doplněny zkrácené CS překlady (Matrix kruh) + parita v checkeru
dd1381746 docs(oasis): druhá dávka — zkrácené CS překlady doplněny, checker hlídá paritu
```

---

## 6b. Kontrola obsahu publikovaných profilů (druhá vlna)

Po nasazení jsem projel **všech 400 publikovaných profilů** (to, co uživatel reálně vidí v modalu)
na markdown vady: neuzavřené code fences, liché `**`, prázdné nadpisy, odkazy na `.md`, literální
`\n`/HTML entity, duplicitní odstavce, markery `TODO`/`TBD`.

**Nalezeno a opraveno:**

| soubor | vada |
|---|---|
| `71`–`80` (tibetský kruh, 10 kánonů) | na konci **osiřelý code fence** (` ``` ` bez otevíracího) → konec profilu se renderoval jako kód; odstraněno |
| `42_SRI_DATTATREYA.md` | požehnání mělo lichý `**` (4 řádky jako samostatné boldy + uzavírací uvozovka) → jeden bold span |
| `92_AMATERASU.md` | `**„obnova veřejného prostoru"*` — neuzavřený bold (jedna hvězdička) |
| `129_NAMARRKON.md` + `i18n/129.en.md` | `***Kunwinjku** …***` — rozbité bold+italic |
| `i18n/43.en.md` | `…is eternal."*` — překlep, chyběla hvězdička |

Po opravě: **0 nálezů na 400 souborech** (kontrola respektuje odstavce, takže víceryádkový bold
v blockquote — což je legitimní — nehlásí). Markery `TODO`/`TBD` v obsahu jsou **záměrné**
(lore „balance TBD", komentář v pseudo-kódu) a nechaly se být.

Ověřeno živě: 400/400 souborů SHA-256 shoda s lokálem, v modalu je vidět konec profilů
(`Maui` → „72. PADMASAMBHAVA", `Padmasambhava` → „73. MILAREPA"), požehnání Dattatreyi
i opravený bold u Amaterasu; 0 pageerror.

**Dvě další opravy ze stejné kontroly:**

- **Surové cesty v modalu (335 profilů, 458 výskytů).** Sekce „Zdroje" ukazovala
  `` `../../../TerraNova/japan/KONCEPT-AVATARI-OASIS.md` `` — v veřejném modalu to vypadá jako
  rozbitý odkaz. `sanitizeProfile()` teď `../` traversal odstraní, zdroj zůstává čitelný
  (`` `TerraNova/japan/KONCEPT-AVATARI-OASIS.md` ``). Po opravě 0 souborů s `../`.
- **Nesprávné číslo u Anagha Lakshmi.** Profil `45` tvrdil „Anagha Lakshmi (#43 – feminine
  trinity)", ale roster má **43 = Maly Princ**. Číslo jsem z textu odstranil (jméno zůstalo);
  `#42` u Dattatreyi sedí a zůstalo. Hlubší varianta — přečíslovat Anaghu na volné ID (203+)
  a přidat ji do rosteru jako 201. avatara — je rozhodnutí 👤 (§7).

---

## 6c. Dva noví avataři: Anagha Lakshmi (#203) a Chaitanya Mahaprabhu (#204)

Dva profily měly v kánonu vlastní dokument, ale nebyly v rosteru — a jejich čísla
**kolidovala** s řádnými avatary (42 = Dattatreya, 43 = Maly Princ). 👤 rozhodl variantu
„přečíslovat a přidat do rosteru".

| krok | co |
|---|---|
| soubory | `43_SRI_ANAGHA_LAKSHMI.md` → **`203_…`**, `42_SRI_CHAITANYA_MAHAPRABHU.md` → **`204_…`** (+ H1 a `avatar_id` uvnitř) |
| roster | `AVATAR_ROSTER.md` += obě položky (203 → ZION Originals, 204 → Hindu; počty kruhů 5→6 a 17→18), `V31/L4/oasis/data/avatars.json` += 2 záznamy |
| karty cs+en | overlay `zion.json` (203) a `hindu.json` (204): subtitle, role, location, questLine, teaching, ability, quote, essence; 5 questů pro každého v `quests-filler.json` |
| překlady | `i18n/203.en.md` (17,5 kB) a `i18n/204.en.md` (28,3 kB), plná parita s kánonem |
| portréty | vyrenderované ze stejného 3D modelu (`--ids 203,204`) → `game-portraits.json` 200 → **202** |
| odkazy | README, 44, 45, 85, `GOLDEN_EGG_GAME/*` a oba překlady převedeny na nová ID |
| copy stránky | tagline už netvrdí pevný počet („Dvě stě…"), počet se bere z rosteru |

⚠️ **Past:** renderer přepočítává `game-portraits.json` z toho, co najde na disku, a **zahodil
11 existujících záznamů** (jména se od původního renderu změnila, soubory zůstaly pod starým
slugem). Vráceno z gitu a doplněny jen dva nové záznamy — jinak by web ztratil portréty u 11 postav.

**Stav:** 202 avatarů, **404 profilů** (202 kánonů + 202 překladů), checker 0 problémů,
tsc 0 chyb, deploy `20261105T094659Z`, live **404/404 SHA-256 shoda**, v prohlížeči 202 karet
a oba nové modaly v CS i EN, portréty 200, 0 pageerror.

---

## 6d. Incident: 502 po deployi (kolize dvou buildů) — a ponaučení

Při druhém deployi (copy „200 → 202") web na ~4 minuty spadl. Timeline:

| čas (CET) | co se stalo |
|---|---|
| 10:55 | `deploy-web2.9.sh` → `Deployed 20261105T095544Z`, smoke check OK |
| 10:58 | služba `zion-website` padá: `Cannot find module '../trace/shared'` (chybí `node_modules/next/dist/trace/shared.js`) → **502** na všech routách |
| 11:00 | paralelní session dokončila svůj deploy → strom je kompletní, web 200 (`NRestarts=3`) |

**Příčina:** dvě session deployovaly současně. Ta druhá spustila `rm -rf .next && npm run build`,
což mazalo `standalone/` **pod běžícím rsync** → rsync ohlásil `file has vanished (code 24)`
a přenesl **neúplný `node_modules/next`**. Deploy skript smoke check prošel, protože proces
v tu chvíli ještě běžel; spadl až o ~2,5 min později, kdy mu zmizely soubory pod rukama.

**Prevence (platí pro každý deploy webu):**
1. Před `deploy-web2.9.sh` zkontroluj `pgrep -fl "next build|npm run build"` — když něco běží, počkej.
2. Zkontroluj stale lock: `apps/website-v2.9/.next/lock` (0 B, zůstává po přerušeném buildu).
   Když neběží žádný build, `rm -f .next/lock`.
3. `rsync warning: file has vanished (code 24)` **není** benigní — po něm vždy ověř
   `node_modules/next/dist/trace/shared.js` v nasazeném stromu a HTTP 200 na `/api/health`.
4. Smoke check hned po restartu nestačí — ověř web znovu **po ~3 minutách** (a hashovat obsah).

Po obnovení: 202 karet, badge „202 avatarů", oba nové modaly v CS i EN s vlastními portréty,
404/404 profilů SHA-256 shoda, 202 portrétů 200, 0 pageerror.

---

## 6e. OASIS daemon: API vracelo prázdno (opraveno)

`GET /api/v1/oasis/avatars` a `/quests` vracely **prázdné pole** — daemon má
`WorkingDirectory=/opt/zion`, takže `data/avatars.json` hledal v `/opt/zion/data/`, kde soubor
nikdy nebyl (log: `Could not read data/avatars.json: No such file or directory`). Nebyla to
regrese z této práce, ale roky tichý stav.

Oprava: soubor nakopírován na `/opt/zion/data/avatars.json` (záloha staré verze v
`/opt/zion/V31/L4/oasis/data/avatars.json.bak-20261105-200`), restart `zion-v31-oasis`.
Log: `Loaded 264 quests`. **Live API teď vrací 202 avatarů / 264 questů** (dřív 0 / 0).

## 6f. Mobil + a11y audit stránky (a dvě opravy)

Měřeno headless Chromem na 390×844, 844×390 a 1440×900 proti produkci:

| kontrola | výsledek |
|---|---|
| horizontální přesah | **0 px** na všech třech |
| karty (202) menší než 44 px | **0** |
| obrázky bez `alt` | **0** z 205 |
| tlačítka bez přístupného názvu | **0** z 227 |
| `h1` / `lang` | 1 / `cs` |
| tap targety filtrů | ≥ 32 px (4 „nízké" byly skryté položky menu 0×0) |

**Nalezená vada:** modal propouštěl fokus — **10 z 12** Tabů skončilo mimo dialog a po zavření
fokus zmizel, takže se klávesnicí nedalo pokračovat. Opraveno: focus trap (Tab/Shift+Tab cyklí
uvnitř), aktivní vtáhnutí fokusu při otevření (`autoFocus` na křížku nestačí, když prohlížeč
fokus nepřesune) a jediná cesta zavření, která **vrací fokus na kartu**. Po opravě: 0 útěků ze
14 Tabů, Escape zavírá, fokus se vrací (ověřeno i pro scénář „klik po programovém focusu").

## 6g. Co zůstalo otevřené

- ~~**Deploy nirvany je blokovaný**~~ → **✅ nasazeno 2026-11-05 11:18 UTC** (viz §6h).
- **Transliterace v CS kánonu je smíšená** (Krišna 83× vs Krishna 122×, Ráma 36 vs Rama 18,
  Lakšmí 7 vs Lakshmi 31, Sarasvatí 29 vs Sarasvati 8, Orákulum 14 vs Oracle 9). Automatická
  náhrada je riskantní (skloňování, „Hare Krishna" mantra, názvy souborů v odkazech), takže
  jsem sjednotil jen jednoznačné případy (kapa). Zbytek je **editoriální úkol pro rodilého
  mluvčího** — zdokumentováno, ne „opraveno naslepo".

---

## 6h. Nirvana nasazena (202 avatarů ve hře) — a jak obejít cizí rozdělanou práci

Zbýval blokovaný deploy: kód `PROTO_VERSION = 30`, živý net **26**. Postup (dle pravidla
„nejdřív net, pak appka"):

| krok | výsledek |
|---|---|
| `deploy-nirvana-net.sh` | net **proto 30**, build `20261105T111813Z`, health OK |
| `deploy-nirvana.sh --artifact-dir …` | appka build `20261105T111827Z`, smoke 6/6 OK |
| `/net/health` vs `protocol.ts` | **30 = 30** |
| katalog v nasazeném bundlu | obsahuje `Sri Anagha Lakshmi` i `Sri Chaitanya Mahaprabhu` → **202 ve hře** |

**Past, která málem rozbila produkci:** v pracovním stromu byla **rozdělaná (necommitnutá)
práce jiné session** — flotila (`/fleet`, 4,7 MB modelů). Postavit z pracovního stromu by ji
do produkce odeslalo, což její zápis výslovně zakazuje („nenasazeno", otevřený IP blocker).
Řešení: **čistý git worktree na HEAD** + `cp -al` (hardlink klon, 2,5 min, bez kopírování dat)
→ build → `--artifact-dir`. Artefakt měl 46 rout a **žádnou `/fleet`**, takže se nasadilo jen
to zamýšlené. Po deployi worktree zrušen.

⚠️ Okno mezi netem a appkou (~2 min) je nutné: stará appka (proto 26) by s novým netem hlásila
`proto_mismatch`. Proto se artefakt **připraví předem** a deploy appky jde hned po netu.

---

## 6i. Detail nových avatarů na stejné úrovni (turnaround + kánonický spec)

Portrét 203/204 měly, ale v modalu chyběly dvě sekce, které mají ostatní: **turnaround**
(4 pohledy) a **atributy z kánonu + paleta + prompt**. Obě mapy končily na 200.

| krok | výsledek |
|---|---|
| `scripts/ops/oasis-canon/build-canon.mjs` | `specs.json` 200 → **202** (atributy 139, paleta 202, SACRED_TRINITY 202) |
| `render.mjs --sheets --ids 203,204 --force` | 2 turnaroundy (54,6 + 48,6 kB) |
| `character-sheet-images.json` | 200 → **202** |

Symboly z kánonu: **203** = čakra, lotos, meč, kniha, víná; **204** = čakra, lotos, zrcadlo.

⚠️ **Past (druhý výskyt):** renderer přepočítává mapy podle souborů na disku a **zahodil 11
sheetů** (jména se od původního renderu změnila, soubory zůstaly pod starými slugy) — mapy
vráceny z gitu a doplněny jen 203/204, takže `game-portraits` i `character-sheets` zůstaly na 202.
Stejná past jako u portrétů (§6c); **pravidlo: po každém `render.mjs` zkontroluj počet v mapě**.

Ověřeno live (deploy `20261105T120554Z`): `specs.json` 202 s oběma novými (prompt + paleta +
symboly), oba turnaroundy 200, v modalu se obě sekce renderují („Atributy", „Prompt pro finální
portrét"), 0 pageerror.

---

## 7. Meze a co zůstává

- **Kánon 42/43 vs. lore.** Roster (a tedy stránka) říká 42 = Dattatreya, 43 = Maly Princ;
  texty `44`/`45` ale mluví o „Anagha Lakshmi (#43 – ženská trojice)". Je to **rozpor v lore**,
  který jsem neřešil — překlad jen srovnal odkazy s kánonem. Rozhodnout 👤 (přejmenovat profil
  Anaghy, nebo přečíslovat).
- **Tři soubory mimo roster** (`07`, `34`, `49`) nejsou avataři, ale doprovodné dokumenty:
  `07_FAMILY_TREE.md` (mapa vztahů), `34_VIA_LUCIS_PROPHECY.md` (Komenského proroctví),
  `49_MATRIX_TRINITY_COMPLETE.md` (souhrn Matrix trojice). Proto se nepublikují jako karty;
  zůstávají v adresáři a odkazuje se na ně z jiných profilů.
- **Plný rebuild webu** neproběhl (nebyl potřeba). Až poběží `deploy-web2.9.sh`, přenese se
  i obsah ostatních sessions; data avatarů jsou v něm už teď.
- **Kvalita překladů** je ověřená strukturálně (parita, žádná čeština v EN) — ne jazykovou
  korekturou rodilým mluvčím. U havajského kruhu a u Matrix trilogie by stálo za to projít
  terminologii (např. `kapa`, `heiau`, `Oracle/Orákulum`).
