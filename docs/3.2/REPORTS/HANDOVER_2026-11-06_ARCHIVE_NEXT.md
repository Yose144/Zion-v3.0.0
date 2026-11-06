# HANDOVER — ZION Archive: co zbývá po překladu (189/189)

> **Datum:** 2026-11-06 · **Vlastník:** 👤 · **Stav:** překlad **DOKONČEN** (189/189, 100 %)
> **Plán:** [`TRANSLATION-PLAN.md`](../../../TRANSLATION-PLAN.md) (v3.0) · **Report:** [`REPORT_2026-11-05_ARCHIVE_TRANSLATION_SESSION.md`](REPORT_2026-11-05_ARCHIVE_TRANSLATION_SESSION.md)
> **Kód:** `apps/website-v2.9` · **Tento dokument:** zadání pro novou session, která má práci dotáhnout.

---

## 0. Kde přesně jsme

| Metrika | Hodnota |
|---|---|
| Přeložené kapitoly | **189 / 189 (100 %)** |
| Knihy na `enCoverage: 100` | **18 / 18** (`quantum-revolution` = `singleDoc cs 10 / en 10`) |
| Audit | `missingEn: 0`, `duplicates: 0`, `missingParts: 0`, `missingCs: 1` (flaky `miseamenti/README`) |
| Parity CZ ⇄ EN | 187 dvojic, **0 mezer** — doplněno 2026-11-06 odpoledne (viz §1) |
| `npm run build` | EXIT 0 |
| Deploy na EDGE2 | **NASAZENO 2026-11-06 14:32 UTC** z čistého worktree na `ee1166a20` (viz §5) |

**Překladatelská session přeložila 124 kapitol** ve 13 dávkách (65 → 189): Surta Srdce, Nabukano, Mise Amenti, Růže, Issobella, Na Cestě, MariaCaminho, Ekam Deeksha, Quantum Revolution, Miriam, Lumi, Kruh Bohyní, BodhiGaia.

---

## 1. Parity CZ ⇄ EN — 4 zbývající mezery

Nástroj: `npm run check:archive-parity` (v `apps/website-v2.9`), skript `scripts/check-archive-parity.mjs`.

> **✅ VYŘEŠENO 2026-11-06 (commit `7c9c9ac92`):** všech 187 dvojic bez driftu, `check:archive-parity` = EXIT 0.
> Allowlist nebyl potřeba — všechny čtyři mezery se daly vyřešit poctivě (doplněním odkazu nebo překladem), takže gate zůstal striktní.

| # | Soubor | Co chybělo | Povaha / návrh | Stav |
|---|---|---|---|---|
| 1 | `korpus/BodhiGaia/00-README_EN.md` | 2 sekce („Kde to sedí v kompasu čtyř knih", „Mapa zdrojů") + 7 řádků tabulek; EN bylo 83 % CZ | **starší zkrácená EN edice indexu** — přepsáno celé podle CZ, ne záplatováno | **✅ hotovo** (index má 8 h2, mapu 13 zdrojů, stav „anglická edice = index + 13 kapitol") |
| 2 | `korpus/SulZeme/ZION_ONBOARDING_EN.md` | 3 podnadpisy (h2 16 vs 15, h3 25 vs 22) | drift byl **opačný**, než handover čekal: EN mělo **navíc** sekci *What is ZION today — root, trunk and crown* | **✅ hotovo** (👤 rozhodl doplnit sekci do CZ; `ZION_ONBOARDING.md` má nově `## Co je ZION dnes — kořen, kmen a koruna` + obsah přečíslován) |
| 3 | `korpus/SulZeme/00-README_EN.md` | 2 odkazy: `./Onboarding.md`, `./ZION_ONBOARDING.md` | CZ-only aux dokumenty — EN index je neuváděl | **✅ hotovo** (doplněno s poznámkou „Short marketing version (Czech only)" a „Historical onboarding versions") |
| 4 | `korpus/MiseAmenti/README_EN.md` | self-link `./README.md` | kosmetika | **✅ hotovo** (EN má „Czech entry point: README.md") |

**Nástroj má `--json` a `--verbose`.** Navíc (commit `6f540d8e3`) přibyl **druhý pass**: skenuje všechny `*_EN.md` a hlásí nekanonické překlady stavových značek (`UNDER CONSTRUCTION → BUILDING`, `ŽIVÉ → LIVE`, `STAVBA → BUILDING`, `HORIZONT → HORIZON`, `HYPOTÉZA → HYPOTHESIS`, `MÝTUS → MYTH`, `NEDOLOŽENO → UNSUBSTANTIATED`, `ZÁMĚR → INTENT`) a české labely přeživší do angličtiny. Kanonická sada je definovaná v `korpus/MiseAmenti/01-Kanon-a-Ustava.md` (LIVE / BUILDING / HORIZON / HYPOTHESIS / MYTH).

---

## 2. Redakční revize EN draftů (189 souborů)

Překlady jsou **EN drafty**, ne oficiální edice (výjimka: Království srdce = klasická EN edice). Před veřejným vydáním:

> **Stav 2026-11-06:** mechanická část je hotová — statusy sjednoceny na `BUILDING` (7 výskytů `UNDER CONSTRUCTION` ve 4 souborech), gate na labely běží, 0 českých zbytků v EN próze (`není / který / protože …` = 0), `internal repo` (bez „-sitory") = 0, `impact packet` = 38× bez variant, `Poutník` = 0.
> **Zbývá subjektivní část:** rytmus a „překladatelština" u beletrie, kurzívy u sakrálních slov a jednotná diakritika u vlastních jmen (`Amitābha` 22× vs `Amitabha` 31× — rozhodnout globálně; starší oficiální EN edice a konvence Lumi používají `Amitabha`).

- **Terminologie napříč knihami** — držet konzistenci: `LIVE/BUILDING/HORIZON/HYPOTHESIS/MYTH/UNSUBSTANTIATED/INVALID CLAIM/INTENT`, `internal repository` (ne „internal repo"), `tracker`, `impact packet`, `the Pilgrim`, `Only-that`.
- **Sakrální a kulturální slova** — kurzívou a v původním přepisu: `piko`, `whenua`, `fa'atere`, `va'a`, `marae`, `ari'i`, `ra'atira`, `tapu`, `noa`, `māna`, `hui`, `va`, `rongorongo`, `tangata manu`, `mā'ohi`, `tatau`, `prema`, `bhakti`, `ākāśa`, `Pṛthvī`, `Agni`, `Āpas`, `Vāyu`, mantry `gate gate pāragate…`, `oṃ maṇi padme hūṃ`.
- **Délky a rytmus** — některé kapitoly jsou v EN o 4–15 % delší (čeština je hutnější); u beletrie zvážit zkrácení tam, kde vzniká „překladatelština".
- **Tabulky** — v CZ je místy zdvojený `||` (prázdný první sloupec) → v EN normalizováno na `|`; u Miriam to bylo plošně.
- **Code blocky** — specifikace (`IMPACT PACKET`, tok hodnoty, `ZÁMĚR/PLÁN/…`, Cosmic Harmony v3, bash v Lumi 12) jsou opsané **doslova**; neměnit odsazení.

---

## 3. Kulturní review (třída E) — 9 položek

Vyplývá z knih samotných (`BodhiGaia/09` §6 kroky 9–11, `KruhBohyní/13` §5, `Miriam/13`). **Před veřejným vydáním a před jakoukoli adaptací do OASIS.**

| # | Téma | Kde | Co ověřit |
|---|---|---|---|
| 1 | Polynéské motivy (wayfinding, `piko`, `tatau`, Raiatea/Taputapuātea, Rapa Nui) | `BodhiGaia/05, 11`, `Lumi/07-08`, `KruhBohyní/03` | konzultace s `mā'ohi` komunitou; nekomerční zacházení s `tapu`; Rapa Nui jako varování, ne turistická atrakce |
| 2 | Buddhistické motivy (Bodhi, Merkaba, Sri Maha Bodhi, malí Buddhové) | `BodhiGaia/04, 11`, `KruhBohyní/05` | Sri Maha Bodhi = **živý náboženský objekt**, ne marketingový asset; žádná „duchovní autorita" projektu |
| 3 | Hinduistické / Rámájana (Ráma, Sítá, Ráma Setu) | `BodhiGaia/11`, `KruhBohyní/10` | posvátnost epopeje; nepoužívat jako brand |
| 4 | Srí lanské (Ajurvéda, sáňgha, Anurádhapura) | `BodhiGaia/11` | partnerství se sáňghou, ne „přístup k posvátnému" |
| 5 | České (Přemysl, Libuše, Říp, Zlatá bula, Karel IV) | `BodhiGaia/10`, `KruhBohyní/04` | mýtus vs. nacionalismus; Zlatá bula jako inspirace, ne nárok na historickou autoritu |
| 6 | Křesťanské a hebrejské (Miriam, Marie, desposyni, Zjevení) | `Miriam/` (13 kapitol) | žádná teologie, žádný „krevní nárok"; `INVALID CLAIM` u Plantarda správně označen |
| 7 | Růžová linie / Meriam | `Miriam/13`, `Ruze/`, `BodhiGaia/12` | ztotožnění postav = `MYTH`; žádná reinkarnace, žádná dynastie |
| 8 | „Bohyně" jako archetyp | `KruhBohyní/` | nekultovní čtení; žádné vylučování podle „consciousness level" |
| 9 | OASIS avataři (Sítá, Hanumán, avatar #40, svět ELIZABET) | `BodhiGaia/07`, `KruhBohyní/13`, `Lumi/05` | adaptace jen po review; bez duplicitní identity, bez tokenizace |

---

## 4. Obsahové (ne překladové) úkoly, které si knihy samy předepsaly

Tyto **nejsou** práce překladatele — jsou to „další kroky" z registrů. Nová session je má vzít jako samostatný backlog, ne je míchat s překladem.

**`BodhiGaia/09` §6 (13 kroků):** oprava rozporů #1, #2, #4, #10 (redakčně) a #8 (config) · refresh tří komunitních dokumentů sekcí *Evidence* · doplnit řádky L5 do `MiseAmenti/07-Registr-Dukazu.md` · vynutit API klíč na `free-world tracker` · zdroj pravdy statusů (`communities` → web + OASIS) · veřejný L5 portál · DAO UI + výplatní tx flow + guardian multisig · šablona impact packetu + **jeden pilot** (nejblíž Zahrada Genesis Fáze 1) · tři kulturní review · pilot `GENESIS-ROSE-001` (Gate A–D).

**`KruhBohyní/13` §5 (8 kroků):** doplnit řádek „ztotožnění Lumi = MÝTH" do `MiseAmenti/07` · opravit rozpory #1–#6, #9, #10 · vyjasnit `layer` u OASIS světů (`ELIZABET`, `DHARMA_TEMPLE_LA_PALMA`) · anglický index `00-README_EN.md` po CZ review · kulturní review · rozhodnout o Lumi v OASIS · bezpečnostní review pasáží o fondech/custody/DAO · kanonizace.

**`Miriam/13` §„Návrh klasifikace a review":** doplnit řádek do `MiseAmenti/07-Registr-Dukazu.md`, zařadit do `canon/books/README.md` jako `DRAFT / HORIZON`, revize historických tvrzení, korektura CZ, kulturní citlivost.

**Rozpory, které knihy samy hlásí a které nejsou opravené** (nezaměňovat s chybou překladu):
- `docs/TerraNova/06-L5-SVOBODA.md` §6.2 — uvádí 10 % místo 5 % + 5 % a obsahuje cenový odhad (porušuje zákaz predikcí) → třída B + E.
- `docs/3.2/L5_L6_ACTIVATION_PLAN.md` §4.2/§5 — zastaralý inventář (`fund_address` placeholder, špatný RPC port) vs. skutečný kód.
- `canon/books/nirvana/04-Domov.md` — ZIS s Passkeys/WebAuthn jako současnost (má být HORIZON).
- `canon/books/nirvana/10-Prameny-Zivota.md` — statická čísla („23 600 plateb") a „živý graf" na `/l5-free-world`.
- `canon/books/nirvana/01` — „23 600+ bloků" jako statické číslo (snímek 2026-09-14: 43 500+).
- OASIS `WorldPanel.tsx` / `PioneerProjectCards.tsx` — ručně psané statusy bez zdroje v L5 API; Te Pīko Ora „Tahiti" vs. „Raiatea".

---

## 5. Deploy na EDGE2 — proč ne a co je potřeba

> **✅ NASAZENO 2026-11-06 14:32 UTC** (`20261106T143205Z`) z **čistého worktree na HEAD** (`ee1166a20`), přesně postupem níže. Rollback: `/opt/zion/APP&WEB/website-v2.9/.next/standalone.before-20261106T143205Z`.
> **Ověřeno live:** `/zion-archive` 200, `/zion-archive/bodhigaia/cist` 200, `/zion-archive/sulzeme/cist` 200, gated `/api/archive/docs/...` bez passu **403**; audit na serveru `missingCs: 0`, `missingEn: 0`, `duplicates: 0`, `missingParts: 0`, `bodhigaia enCoverage 100 %`; `archive-content` s novým indexem i novou CZ sekcí na serveru (`Map of sources` 1×, `kořen, kmen a koruna` 2×).
> **Poznámka k artefaktu:** worktree je na jiném místě než hlavní strom, takže `node_modules` **nete symlinkovat** (Next symlink nekopíruje a artefakt pak hlásí „incomplete standalone artifact") — použij `cp -al` hardlink klon **rootu i všech `apps/*/node_modules`** (`npm run build` v appce nejdřív staví `zion-wallet-sdk`, takže samotné app node_modules nestačí).

Původní zdůvodnění, proč to předchozí session nedělala: pracovní strom obsahoval **cizí rozpracované soubory** (paralelní session): `apps/nirvana/**`, `Kingdom/apps/kingdom/**`, `apps/MarketPlace/**`, resp. v této vlně i `apps/website-v2.9/src/components/books/BookReader.tsx`, `globals.css`, `Navigation.tsx`. `deploy-web2.9.sh` rsyncuje `src` + `.next` + `public` z pracovního stromu → poslal by i je.

**Bezpečný postup (ověřený):**
1. `git worktree add --detach /cesta/mimo/repo HEAD` + `cp -al` node_modules (viz poznámka výše).
2. `cd apps/website-v2.9 && npm run build` (EXIT 0) — build z HEAD bez cizích změn.
3. Zkopírovat artefakt stejně jako skript (`.next/static`, `public/`, `archive-content/` do `standalone/apps/website-v2.9/`, hoisted `node_modules` do app dir).
4. Ověřit audit lokálně (`PORT=3129 … node server.js`) — `missingEn: 0`.
5. `bash apps/website-v2.9/deploy/deploy-web2.9.sh --artifact-dir <app dir>`.
6. Po deployi ověřit: `/zion-archive` 200, `/zion-archive/bodhigaia/cist` 200, `/api/archive/audit` s `missingEn: 0`, `archive-content/` nakopírovaný do `.next/standalone/`.
7. Worktree uklidit (`git worktree remove --force`).

---

## 6. Pravidla, která se nesmí porušit (opsáno z incidentů)

1. **Commit vždy přes pathspec** — `git commit -m … -- <cesty>`. Paralelní session nechává soubory **nastagedované**; commit bez pathspec je strhne do cizího commitu (stalo se: `e1079c272`).
2. **`git diff --cached --name-status` samostatně před** commitem.
3. **`npm run check:archive-parity`** po každé dávce — odhalí ztracený navigační odkaz nebo vypadlý řádek tabulky.
4. **Build + audit po každé dávce:** `npm run build` → standalone na `PORT=3124` s `ARCHIVE_PASS_CODES=ZAP-TEST-LOCAL-1234`, `ARCHIVE_ADMIN_TOKEN=test-admin-token` → `curl /api/archive/audit`.
5. **`npx tsc --noEmit` v `apps/website-v2.9` hlásí ~32 chyb z cizí práce** (`apps/MarketPlace/src/lib/translations.ts` rozšiřuje `Lang` na 5 jazyků). `next build` je zelený; **neopravovat cizí refaktor**.
6. **Force-push na `main` je zakázán bez 👤.**
7. **Nikdy nepřekládat statusy jinak** než doslovně a nemazat řádky registrů.
8. **Front matter (`00-README`) se nepočítá do coverage**, ale u Kruh Bohyní jsou tři `00-*` soubory **kapitoly** (17 = 3 + 14).

---

## 7. Doporučené pořadí pro novou session

| Priorita | Úkol | Odhad | Stav |
|---|---|---|---|
| 1 | `BodhiGaia/00-README_EN.md` — přepsat celý podle CZ | 1 dávka | **✅ `7c9c9ac92`** |
| 2 | `SulZeme/ZION_ONBOARDING_EN.md` — srovnat hlavičky | 1 dávka | **✅ `7c9c9ac92`** (opačný směr: sekce doplněna do CZ) |
| 3 | Gate v `check-archive-parity.mjs` → vrací 0 | 15 min | **✅ `7c9c9ac92` + `6f540d8e3`** (0 mezer + pass na labely) |
| 4 | Redakční pass EN draftů (terminologie + kurzívy + délky) | 2–3 dávky | **🟡 mechanické hotovo** (statusy), zbývá stylistika + diakritika jmen |
| 5 | Kulturní review (třída E) — 9 položek z §3 | externí / 👤 | ⏳ |
| 6 | Deploy na EDGE2 z čistého worktree | 30 min | **✅ `20261106T143205Z`** — live ověřeno, audit `missingCs 0 / missingEn 0` |
| 7 | Obsahové kroky z §4 — **samostatný backlog**, ne „překlad" | dle registrů | ⏳ |

---

*Tento dokument je určen jako vstupní bod pro novou session. Všechna čísla a commit hashe ověřeny 2026-11-06.*
