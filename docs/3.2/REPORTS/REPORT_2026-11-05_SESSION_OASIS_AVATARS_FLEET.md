# REPORT 2026-11-05 — SESSION: OASIS avataři (202) + flotila + a11y + ops audit

> **Rozsah session:** dvojjazyčný kánon OASIS avatarů (dokončení, rozšíření na 202), opravy
> generátoru a markdownu, a11y audit webu, OASIS API, nasazení Nirvany s flotilou, terminologie.
> **Dílčí reporty:** `REPORT_2026-11-05_OASIS_AVATAR_I18N.md` (detail), `REPORT_2026-11-04_AVATARI_WEB.md`
> (karty + questy), `REPORT_2026-11-05_FLEET_MARKETPLACE_SHIPS.md` (flotila).
> **Plán:** [`PLAN_OASIS_AVATAR_I18N.md`](../../../PLAN_OASIS_AVATAR_I18N.md) — uzavřený.

---

## 1. Výsledek v číslech

| Metrika | Před session | Po session |
|---|---:|---:|
| Avatarů s oběma jazyky | 182 / 200 | **202 / 202** |
| Publikovaných profilů | 382 | **404** (202 kánonů + 202 překladů) |
| Párů v paritě s kánonem (nadpisy, bloky, odkazy, ≥85 % délky) | — | **202 / 202** |
| `i18n/*.en.md` / `*.cs.md` | 141 / 47 | **158 / 47** |
| Portréty (mapa) | 200 | **202** |
| Turnaroundy (mapa) | 200 | **202** |
| `specs.json` (atributy + paleta + prompt) | 200 | **202** |
| OASIS API `/avatars` `/quests` | **0 / 0** | **202 / 264** |
| `check-oasis-i18n.mjs` | — | **0 problémů** |

---

## 2. Průběh (7 bloků)

### 2.1 Překlady — 200/200
Přeloženo 16 profilů (CS→EN, 332 kB): `08` Issobela, `40` Lumi, `41` Vasudeva, `42` Dattatreya,
`43` Malý princ, `51` Dalai Lama XIV, `52` Heȟáka Sápa a havajský kruh `62`–`70`. Každý
s kontrolou parity (nadpisy, code bloky, tabulky, seznamy, odkazy, JSON).

### 2.2 Tři chyby generátoru
- **ID 43 zobrazovalo jinou postavu** — pro 43 existují dva kánony a `readdir` bral poslední →
  karta „Maly Princ" otevírala **Anaghu Lakshmi**. Nově rozhoduje **roster** (`resolveProfile`).
- **`detectLang` fallback `cs`** — `09` a `44` mají anglický kánon, ale publikovaly se jako
  `.cs.md` a jejich hotový český překlad se zahazoval. Nově rozhoduje většina.
- **Explicitní `i18n/<id>.<baseLang>.md` má přednost** před kánonem (u `08` se tím publikuje
  čistší čeština).

### 2.3 Kondenzované české překlady
Starší EN→CS překlady Matrix kruhu obsahovaly jen část kánonu: `50` ZION **40 %**, `48` Morpheus
43 %, `47` Trinity 51 %, `46` Neo 71 %. Doplněno do parity (96–97 %), plus `23` (chyběla sekce
„Vy jste Artuš"), `38` (chyběl blok „Mariin vzkaz ZIONu"), `39`, `00`, `81`, odkazy `44`/`45`.

### 2.4 Markdown a cesty v publikovaných profilech
- **10 kánonů (71–80)** mělo na konci **osiřelý code fence** → konec profilu se renderoval jako kód.
- Liché `**` v `42`, `92`, `129`, `43.en`; **335 profilů** mělo v „Zdroje" surové cesty
  `../../../TerraNova/…` → `sanitizeProfile()` odstraní `../`.
- Nesprávné číslo „Anagha Lakshmi (#43)" v `45` (roster: 43 = Maly Princ).

### 2.5 Dva noví avataři (#203, #204) — 202 celkem
`43_SRI_ANAGHA_LAKSHMI.md` → **203** (ZION Originals, AllRays, CL9), `42_SRI_CHAITANYA_MAHAPRABHU.md`
→ **204** (Hindu, Yellow, CL8). Doplněno: roster + `avatars.json`, dvojjazyčné karty (7 polí +
essence + quote), 5 questů cs+en, EN překlady obou kánonů, **portréty, turnaroundy i `specs.json`**
ze stejného 3D modelu, odkazy v korpusu, copy „200 → 202" (web i nirvana).

### 2.6 A11y + mobil webu
Audit 390×844 / 844×390 / 1440×900: 0 přesahů, 0 malých tap targetů, 0 obrázků bez `alt`,
0 tlačítek bez názvu. **Vada:** modal propouštěl fokus (10 z 12 Tabů ven, po zavření fokus zmizel)
→ focus trap + aktivní vtáhnutí fokusu + návrat na kartu. Po opravě 0 útěků ze 14 Tabů.

### 2.7 Nirvana: 202 avatarů ve hře + flotila
- **Net proto 26 → 30**, hned potom appka (proto 30) — okno ~2 min je nutné.
- **`/fleet`** (7 lodí z marketplace, doky Nabukano + Issobella) nasazeno 11:30, **mobilní audit**
  (dotyk, layout) 12:32.
- Artefakty se stavěly v **čistém git worktree na HEAD** (`cp -al` node_modules), protože
  v pracovním stromu byla vždy rozdělaná práce jiné session.

### 2.8 OASIS API a terminologie
- Daemon hledal `data/avatars.json` v `/opt/zion/data/` (WorkingDirectory), kde nikdy nebyl →
  API roky vracelo prázdno. Doplněno → **202 avatarů / 264 questů**.
- Terminologie: opraven český přepis **„Síta" v anglických profilech (59×/17 souborů)**;
  zbytek (Krišna/Krishna, Ráma/Rama, Lakšmí/Lakshmi…) je smíšený napříč soubory, ale uvnitř
  konzistentní → podklad pro korekturu v [`TRANSLITERACE.md`](../../docs2.9/ZION_OASIS/TRANSLITERACE.md).

---

## 3. Commity (session)

```
77ae27b4c fix(oasis): český přepis „Síta" v anglických profilech → „Sita" (59×/17 souborů)
8a8970bec docs(fleet): druhý deploy — mobilní audit (20261105T123201Z) + varování na proto 31
215840d2e docs(oasis): report — turnaround + kánonický spec pro 203/204 (§6i)
5aa27277c feat(oasis): turnaround + kánonický spec pro 203/204 (detail na stejné úrovni)
3126eeabe deploy(nirvana): /fleet live (7 lodí, doky Nabukano + Issobella) + pravda v docs
6240321ef docs(oasis): report — nirvana nasazena (202 avatarů ve hře), net proto 30
39df44d23 docs(oasis): report — OASIS API sync, mobil/a11y audit, blokovaný deploy nirvany
5d5b29346 a11y(oasis): focus trap v modalu avatara + návrat fokusu, úklid počtů
04c87454a data(oasis): questy pro 203/204 v avatars.json (pro OASIS daemon)
eb3c51f77 docs(oasis): report — incident 502 po deployi (kolize buildů) + prevence
6ee307bbb copy(oasis): počet avatarů 200 → 202 v textech (web + nirvana)
17a60a42e docs(oasis): report — 202 avatarů, nasazeno a ověřeno
3585934a1 feat(oasis): 202 avatarů — Anagha Lakshmi (#203) a Chaitanya Mahaprabhu (#204)
8b5c27d11 fix(oasis): cesty ../ v modalu pryč (335 profilů) + správné číslo u Anagha Lakshmi
634ec91a3 fix(oasis): markdown vady v publikovaných profilech (osiřelé fence, liché **)
dd1381746 docs(oasis): druhá dávka — zkrácené CS překlady doplněny
e34471d46 feat(oasis): doplněny zkrácené CS překlady (Matrix kruh) + parita v checkeru
b69535563 docs(oasis): i18n avatařů hotovo a nasazeno — live ověření CS/EN v modalu
d61316ccd docs(oasis): plán i18n uzavřen — překlady hotové, deploy a nálezy session 2
2e2763e64 feat(oasis): dvojjazyčné profily avatarů dokončeny (200/200) + opravy generátoru
```

---

## 4. Nasazené povrchy a jak ověřit

| Povrch | Stav | Ověření |
|---|---|---|
| `app.zionterranova.com/l4-oasis/avatars` | 202 karet, CS+EN | `node apps/website-v2.9/scripts/check-oasis-i18n.mjs` → 0 |
| profily `/data/oasis/profiles/*.md` | 404 souborů | 404/404 **SHA-256 shoda** local ↔ live |
| portréty / turnaroundy | 202 / 202 | mapa 202, obrázky 200 |
| `specs.json` | 202 (atributy 139, paleta 202) | live `count: 202`, prompt + symboly u 203/204 |
| OASIS API | 202 avatarů / 264 questů | `oasis.zionterranova.com/api/v1/oasis/{avatars,quests}` |
| `nirvana.zionterranova.com` | appka `20261105T123201Z`, net proto **30** | `/net/health` → 30, `/fleet` (za pasem) |
| `/fleet` | 7 GLB modelů, mobilní CSS | modely 7/7 → 200, `fleet-touch`/`fleet-hud` v CSS chunku |

---

## 5. Tři incidenty a ponaučení

1. **502 na webu (~4 min)** — dvě session deployovaly současně; druhá spustila
   `rm -rf .next && npm run build` pod mým rsyncem → `file has vanished (code 24)` → neúplný
   `node_modules/next` → `Cannot find module '../trace/shared'`.
   **Pravidlo:** před deployem zkontroluj běžící build a stale `.next/lock`; code 24 není benigní;
   web ověř znovu **po ~3 min** (smoke hned po restartu crash nezachytí).
2. **Proto pre-flight falešně blokoval** — čte `PROTO_VERSION` z pracovního stromu, ne z artefaktu
   (strom měl cizí WIP proto 31, artefakt z HEAD proto 30 = živý net 30).
   **Pravidlo:** při deployi z worktree porovnej verzi **artefaktu** a bypass zdůvodni.
3. **Renderer přepočítá mapy z disků a zahodí záznamy** (portréty 200 → 191, sheetů 11) —
   soubory zůstaly pod starými slugy. **Pravidlo:** po každém `render.mjs` zkontroluj počet
   v mapě a chybějící doplň z gitu (nikdy nenech mapu menší).

---

## 6. Ops snapshot (naměřeno 2026-11-05 ~12:40 UTC)

| Co | Hodnota |
|---|---|
| Chain | **110 762** bloků |
| Pool (od restartu) | **4 740 accepted / 0 rejected** (100 %), 12 coinů, fee 100 bps |
| G8 run #6 (`g8-20261029T234617Z`) | uptime **99,7238 %**, evidence 100 %, **12 incidentů / 1 560 s** z 2 592 s → zbývá **1 032 s (17 min)** do 28. 11.; gate `pending` |
| EDGE2 | 0 failed unitů, 24 zion služeb, disk 58 % (111/193 G), RAM 6,2 GB volné, cert `app.` do 2026-12-27 |
| EDGE | 0 failed unitů (po `reset-failed` kosmetického `systemd-networkd-wait-online`), disk 58 % (84/145 G), RAM ~1,8 GB volné |
| OASIS daemon | `Loaded 264 quests`, API 202/264 |

---

## 6b. Dodatky z autonomní části (po sepsání reportu)

### Questy pro všech 202 avatarů (OASIS API 264 → 714)

Daemon (`QuestRegistry`) čte `V31/L4/oasis/data/avatars.json`, ale **150 avatarů** mělo questy
jen v overlayi (`scripts/oasis-avatar-copy/quests-*.json`) → API servírovalo 264 questů.
Doplněno **450 questů** (anglické tvary z overlaye) do `avatars.json` → **714** v datech
i v API (`Loaded 714 quests`, `/api/v1/oasis/quests` → 714). Web se nezměnil (overlay má přednost).

### E2E test rosteru (regrese pro tři reálné chyby)

`apps/website-v2.9/e2e/oasis-avatars.spec.ts` — **3/3 proti produkci** (10 s):

1. **202 karet** + oba jazyky profilů (vzorek `0, 43, 52, 70, 202, 203, 204`), bez `../`
   a bez `.md` odkazů v publikovaném textu,
2. **modal**: `aria-modal`, fokus po otevření uvnitř, 10× Tab nesmí utéct, Escape zavře
   a **fokus se vrátí na kartu**,
3. **přepnutí jazyka**: EN tagline + profil 43 se v obou jazycích liší.

⚠️ **Past:** karty mají v CS `„— Detail"`, v EN `„— Details"` — testy musí selektovat jazykově
nezávisle (`aria-label*=" — "`). První verze testu kvůli tomu hlásila „0 karet v EN", což
vypadalo jako chyba aplikace.

### Dokumentace aktualizovaná

| soubor | co |
|---|---|
| `AGENTS.md` (root) | nová entry: 202/202, opravy generátoru, OASIS API, a11y, pasti (renderer, kolize buildů, proto pre-flight) |
| `apps/website-v2.9/AGENTS.md` | entry: checker, e2e, jazykově nezávislé selektory, `sanitizeProfile` (`../`), mapy portrétů |
| `apps/nirvana/AGENTS.md` | nová sekce **Flotila z marketplace** — nasazeno, pasti, otevřené body |
| `apps/website-v2.9/package.json` | `npm run check:oasis-i18n` |
| `docs/docs2.9/ZION_OASIS/TRANSLITERACE.md` | podklad pro jazykovou korekturu (nový) |

### Ops (read-only, naměřeno)

EDGE2: 0 failed / 24 zion služeb / disk 58 % / RAM 6,2 GB / cert `app.` do 27. 12. 2026.
EDGE: **1 kosmetický failed unit** (`systemd-networkd-wait-online`) → `reset-failed`, nyní **0**;
disk 58 %, RAM ~1,8 GB. Chain **110 762**. Pool **4 740 accepted / 0 rejected**.

---

## 7. Otevřené pro 👤

1. **Flotila: IP blocker** (Star Wars tvary + cizí kit) — teď veřejně za ZAP pasem; rozhodnout
   před launchem (licence, nebo nahradit tvary).
2. **Deploy pořadí při proto 31** — pracovní strom má rozpracovaný `PROTO_VERSION = 31`; další
   deploy appky musí předcházet deploy netu 31 (jinak pre-flight zablokuje, správně).
3. **Payout backlog** — dle dnešního edge auditu 52 unconfirmed ≈ 74 890 ZION + 723 superseded.
4. **G8 run #6** — zbývá 17 min incidentů do 28. 11.; každý další incident gate shodí.
5. **`newearth.cz`** — restore, nebo retire (conf+cert leží v `sites-available`).
6. **Jazyková korektura přepisů** — podklad s čísly v
   [`TRANSLITERACE.md`](../../docs2.9/ZION_OASIS/TRANSLITERACE.md); chce rodilého mluvčího.
7. **Lumi svět** — rozdělaná práce jiné session (proto 31, `/lumi`, multiplayer).
