# PLAN — OASIS avataři: dvojjazyčný kánon (CS + EN)

> **Stav: 2026-11-04 (session 2) — HOTOVO A NASAZENO ✅** · vlastník: 👤 · vykonává: agent
> **Cíl:** všech **200 avatarů** má **oba jazyky** (kánon + překlad), stránka `/l4-oasis/avatars` i modální profil fungují v `cs` i `en`, jednou nasazené.
> Tento dokument je **jediný vstupní bod** pro pokračování. Nová session začíná zde.

---

## 1. Co je hotové (2026-11-04)

| Vrstva | Stav |
|---|---|
| **Karty avatarů (overlay cs+en)** | ✅ 200/200 — `apps/website-v2.9/scripts/oasis-avatar-copy/*.json` (7 polí × 200 = 1 400 párů) |
| **Questy (cs+en)** | ✅ 704 questů pro 200 postav (`quests-unique.json` 139, `quests-filler.json` 115, `quests-lite-1..3.json` 450) |
| **Překlady profilů** | ✅ **200/200** avatarů má oba jazyky → `public/data/oasis/profiles/` = **400 souborů** (200 kánonů + 200 překladů) |
| **Zbývá** | ✅ nic z překladů — jen build + deploy + live kontrola (§5) |
| **Duplicitní ID 42/43** | ✅ vyřešeno v generátoru (rozhoduje roster, ne `readdir`) |
| **Jazyk kánonu (09, 44)** | ✅ opraveno — oba byly publikované jako `.cs`, přitom jsou anglické; jejich český překlad se zahazoval |
| **Deploy webu** | ✅ LIVE `2026-11-04` — hot-file deploy profilů (`public/data/oasis/profiles/`), bez rebuildu (§5) |

---

## 2. Jak to celé funguje (architektura)

```
docs/docs2.9/ZION_OASIS/SACRED_TRINITY/
  <id>_<NÁZEV>.md          ← KÁNON (jeden z jazyků, zdroj pravdy)
  i18n/<id>.cs.md          ← český překlad (jen hotové)
  i18n/<id>.en.md          ← anglický překlad (jen hotové)
        │
        │  node scripts/gen-oasis-avatars.mjs
        ▼
apps/website-v2.9/
  src/lib/oasis/avatars.ts                       ← generovaný roster (NEEDITOVAT ručně)
  public/data/oasis/profiles/<id>.<lang>.md      ← publikované profily (generované)
        │
        ▼
  src/app/l4-oasis/avatars/page.tsx
     fetch(`/data/oasis/profiles/${id}.${lang}.md`)
        → při chybě fallback na druhý jazyk (řádek ~290)
```

**Klíčové pravidlo:** kánon zůstává na místě (needituje se kvůli překladu). Překlad jde **vedle** do `i18n/`. Generátor sám pozná jazyk kánonu (`detectLang`) a publikuje kánon v jeho jazyce + všechny překlady v ostatních.

Dvě pravidla, která rozhodují o tom, co se publikuje:
- **Kanonický soubor pro id** = ten, jehož název odpovídá jménu avatara v rosteru (`resolveProfile`). Tím je vyřešená kolize ID 42/43 bez přejmenování souborů.
- **Jazyk kánonu** = `detectLang`; pokud existuje explicitní `i18n/<id>.<baseLang>.md`, publikuje se **ten** (bývá čistší než dvojjazyčný kánon).

---

## 3. Pracovní postup (jedna dávka = 1–3 profily)

```bash
# 1) přečíst kánon
cd docs/docs2.9/ZION_OASIS/SACRED_TRINITY
cat <id>_<NÁZEV>.md

# 2) napsat překlad do i18n/<id>.<cílový_jazyk>.md
#    (zachovat strukturu: nadpisy, tabulky, ```json``` bloky, odkazy, ID a klíče NEMĚNIT)

# 3) vygenerovat + zkontrolovat typy
cd /Users/yeshuae/Projects/2.9.6/apps/website-v2.9
node scripts/gen-oasis-avatars.mjs | grep překlad
npx tsc --noEmit

# 4) commit JEN explicitních cest (nikdy `git add -A`)
cd /Users/yeshuae/Projects/2.9.6
git add -- docs/docs2.9/ZION_OASIS/SACRED_TRINITY/i18n \
           apps/website-v2.9/public/data/oasis/profiles
git commit -m "feat(oasis): překlady <id>… (CS→EN)"
```

### Co v překladu zachovat / co nepřekládat

| Zachovat | Nepřekládat |
|---|---|
| strukturu nadpisů (`##`, `###`) a emoji | `avatar_id`, JSON klíče, `cl_range`, `nft_policy` hodnoty (jsou to data) |
| tabulky, ```yaml```/```json``` bloky | názvy souborů a odkazy `[..](..)` |
| seznamy questů, dialogové bloky | sanskrtské/tibetské termíny v závorce (doplnit, ne nahradit) |
| etické poznámky, `content_warning`, `nft_policy` **význam** | jména tradic a národů (Lakota, K'iche', Hopi…) |

### Etické zásady, které se **nesmí** překladem ztratit
- `nft_policy` s „consultation gate", „mandatory review", „anti-fetish" musí zůstat významově stejné.
- Varování typu „**no** mummy/gore imagery", „**not** a sexualized trope" musí být v překladu stejně kategorická.
- Odkazy na zdroje (Lotsawa House, 84000, Britannia…) se nepřepisují.

---

## 4. Zbývající práce — ✅ hotovo (session 2)

Původní seznam 16 souborů (`08`, `40`, `41`, `42`, `43`, `51`, `52`, `62`–`70`) je **přeložený**.
Session navíc našla **dva avatary, které v seznamu chyběly** (vedené jako hotové, protože měly
`.cs.md`): `09_SHANTI` a `44_HIRANYAGARBHA`. Oba mají **anglický kánon**, ale `detectLang()` je
klasifikoval jako `cs` → publikoval se anglický text jako `09.cs.md` / `44.cs.md` a hotový český
překlad `i18n/09.cs.md` / `i18n/44.cs.md` se **zahodil**. Opraveno (§6.7).

| # | kánon | výstup | hotovo |
|---|---|---|---:|
| 08 | `08_ISSOBELA.md` | `i18n/08.en.md` | ✅ |
| 40 | `40_LUMI.md` | `i18n/40.en.md` | ✅ |
| 41 | `41_VASUDEVA.md` | `i18n/41.en.md` | ✅ |
| 42 | `42_SRI_DATTATREYA.md` | `i18n/42.en.md` | ✅ |
| 43 | `43_MALY_PRINC.md` | `i18n/43.en.md` | ✅ |
| 51 | `51_DALAI_LAMA_XIV.md` | `i18n/51.en.md` | ✅ |
| 52 | `52_HEHAKA_SAPA.md` | `i18n/52.en.md` | ✅ |
| 62–70 | havajský kruh (9 profilů) | `i18n/<id>.en.md` | ✅ |

**Ověřeno u každého:** stejný počet nadpisů (`^#`), stejný počet code fence, stejné cíle odkazů
jako kánon; ```json``` bloky zůstaly shodné (až na lidsky čitelné popisné hodnoty, které se
překládají i v předchozích dávkách); v EN souborech nezůstala česká věta — kontroluje
`scripts/check-oasis-i18n.mjs`.

**Kontrola jedním příkazem:**

```bash
node apps/website-v2.9/scripts/check-oasis-i18n.mjs        # 0 problémů = hotovo
node apps/website-v2.9/scripts/check-oasis-i18n.mjs --verbose
```

Kontroluje: oba jazyky pro každého z 200 avatarů, EN bez českých vět, CS s češtinou, kánon pro
duplicitní ID vybraný podle rosteru, a strukturu publikovaných souborů.

---

## 5. Ověření před nasazením

```bash
# a) každý profil má oba jazyky + EN bez českých vět (jeden příkaz, zero-padded safe)
cd /Users/yeshuae/Projects/2.9.6
node apps/website-v2.9/scripts/check-oasis-i18n.mjs        # 0 problémů = hotovo

# b) generátor + typy
cd apps/website-v2.9
node scripts/gen-oasis-avatars.mjs
npx tsc --noEmit
ls public/data/oasis/profiles/*.md | wc -l     # očekáváno 400 (200 kánonů + 200 překladů)

# c) build — jen když se mění kód (`src/**`, stránka, generátor výstupu avatars.ts).
#    Změna pouhých profilů v public/data/oasis/profiles/ build nepotřebuje.
npm run build

# d) deploy
#    - datová změna (profily): hot-file, bez rebuildu
rsync -az --delete apps/website-v2.9/public/data/oasis/profiles/ \
  zion-edge2:'/opt/zion/APP&WEB/website-v2.9/.next/standalone/public/data/oasis/profiles/'
ssh zion-edge2 'chown -R zion:zion "/opt/zion/APP&WEB/website-v2.9/.next/standalone/public/data/oasis/profiles" && systemctl restart zion-website'
#    - změna kódu: plný deploy
# bash apps/website-v2.9/deploy/deploy-web2.9.sh

# e) live kontrola
curl -s -o /dev/null -w '%{http_code}\n' https://app.zionterranova.com/l4-oasis/avatars
curl -s -o /dev/null -w '%{http_code}\n' https://app.zionterranova.com/data/oasis/profiles/43.cs.md
curl -s -o /dev/null -w '%{http_code}\n' https://app.zionterranova.com/data/oasis/profiles/43.en.md
#   → v modalu přepnout CS/EN a ověřit, že se mění text profilu
```

⚠️ **Restart `zion-website` je u hot-file deploye povinný** — nové cesty v `public/` vrací 404,
dokud standalone server neaktualizuje manifest (přepsané soubory se projeví hned).
Server servíruje `public/` jen z `.next/standalone/public/` (top-level `public/` tam není).

---

## 6. Otevřené otázky / pasti — ✅ vyřešeno (session 2)

1. **Duplicitní ID 42 a 43 → rozhodnuto podle rosteru.** Kanonický zdroj identity je
   `V31/L4/oasis/data/avatars.json` + `AVATAR_ROSTER.md`: **42 = Sri Dattatreya**,
   **43 = Maly Princ**. Generátor dřív bral „poslední podle `readdir`" → u 43 vyhrála
   **Sri Anagha Lakshmi**, takže karta „Maly Princ" otevírala profil jiné postavy (reálná
   chyba, doloženo). Nově `resolveProfile(id, name)` vybere soubor, jehož název odpovídá
   jménu avatara; soubory se **nepřejmenovávají** (odkazuje na ně korpus: `85_LAKSHMI.md`,
   `45_SRI_KALKI_AVATAR.md`, `i18n/44.cs.md`, `README.md`, `GOLDEN_EGG_GAME/*`), jen se
   nepublikují. Překládal se proto `42_SRI_DATTATREYA.md` a `43_MALY_PRINC.md`.
2. **`i18n/08.cs.md` už není mrtvý.** Kánon `08_ISSOBELA.md` je česky, ale s anglickou
   hlavičkou; `i18n/08.cs.md` je **čistší česká verze**. Generátor teď explicitní překlad
   v jazyce kánonu **preferuje** před kánonem (§6.7), takže se publikuje on.
3. **Nulové paddingy** — soubory jsou `00.cs.md`…`09.cs.md`. Porovnávej vždy **zero-padded**
   názvy; `scripts/check-oasis-i18n.mjs` to dodržuje.
4. **Paralelní session** pracuje ve stejném repu (`apps/MarketPlace/**`, `apps/nirvana/**`). Proto:
   - **nikdy `git add -A`** ani `git add .`;
   - commituj jen `i18n/`, `public/data/oasis/profiles/`, generátor a docs;
   - nespouštěj `npm install`/`npm ci`;
   - před deployem zkontroluj `git status`.
5. **Deploy webu je drahý a koliduje** s paralelní session → jeden deploy na konci.
6. **Produkční JS** escapuje non-ASCII (`\xNN`) — grep na česká slova v buildech selže;
   ověřovat přes HTTP odpověď, ne grep.
7. **Dvě opravené chyby v generátoru** (`apps/website-v2.9/scripts/gen-oasis-avatars.mjs`):
   - `detectLang()` měl fallback `cs`, takže **dvojjazyčné kánony** s převahou angličtiny
     (09 Shanti, 44 Hiranyagarbha) se publikovaly jako `.cs.md` a jejich hotový český překlad
     se zahodil → fallback rozhoduje **většina** (změní jazyk jen u těchto dvou ID).
   - kánon se psal vždy z `raw`; teď má přednost `i18n/<id>.<baseLang>.md`, pokud existuje.
8. **Kánony 44 a 45 byly „anglicky s českými odstavci"** — v EN modalu se zobrazovaly české
   věty. Doplněno do angličtiny přímo v kánonu (struktura 1:1, řádky se neměnily); česká verze
   zůstává v `i18n/44.cs.md` a `i18n/45.cs.md`.

---

## 7. Start nové session (zkopívat)

```bash
cd /Users/yeshuae/Projects/2.9.6
git log --oneline -5
git status --porcelain | head

# stav dvojjazyčnosti jedním příkazem (0 problémů = hotovo)
node apps/website-v2.9/scripts/check-oasis-i18n.mjs
```

**Stav:** hotovo a nasazeno (200/200, live ověřeno v CS i EN). Nová práce v této oblasti tedy
začíná u **nového obsahu** (nový avatar, revize textu), ne u překladů:

1. nový/upravený kánon do `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/<id>_<NÁZEV>.md`
   (a překlad do `i18n/<id>.<lang>.md`, pokud v kánonu chybí),
2. `node apps/website-v2.9/scripts/gen-oasis-avatars.mjs`,
3. `node apps/website-v2.9/scripts/check-oasis-i18n.mjs` (musí dát 0),
4. `npx tsc --noEmit` (jen když se mění kód),
5. commit **jen explicitních cest** (`i18n/`, `public/data/oasis/profiles/`, generátor, docs),
6. datová změna = hot-file deploy profilů (§5 d) **s restartem** `zion-website`.

---

## 8. Odkazy

| Co | Kde |
|---|---|
| Kánon profilů | `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/` |
| Překlady | `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/i18n/` |
| Generátor | `apps/website-v2.9/scripts/gen-oasis-avatars.mjs` |
| Kontrola dvojjazyčnosti | `apps/website-v2.9/scripts/check-oasis-i18n.mjs` |
| Overlay karet (cs+en) | `apps/website-v2.9/scripts/oasis-avatar-copy/` + `README.md` |
| Generovaný roster | `apps/website-v2.9/src/lib/oasis/avatars.ts` |
| Stránka | `apps/website-v2.9/src/app/l4-oasis/avatars/page.tsx` |
| Publikované profily | `apps/website-v2.9/public/data/oasis/profiles/` |
| Roster / kruhy | `docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md` |
| Deploy | `apps/website-v2.9/deploy/deploy-web2.9.sh` |
| Reporty | `docs/3.2/REPORTS/REPORT_2026-11-04_AVATARI_WEB.md`, `…_OASIS_AVATAR_I18N.md` |
