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
| Avatarů s **oběma jazyky** | 182 / 200 | **200 / 200** |
| `i18n/*.en.md` | 141 | **157** |
| `i18n/*.cs.md` | 47 | **47** |
| Publikovaných profilů (`public/data/oasis/profiles/`) | 382 | **400** (200 kánonů + 200 překladů) |
| Párů v **paritě s kánonem** | — | **200 / 200** |
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

---

## 7. Meze a co zůstává

- **Kánon 42/43 vs. lore.** Roster (a tedy stránka) říká 42 = Dattatreya, 43 = Maly Princ;
  texty `44`/`45` ale mluví o „Anagha Lakshmi (#43 – ženská trojice)". Je to **rozpor v lore**,
  který jsem neřešil — překlad jen srovnal odkazy s kánonem. Rozhodnout 👤 (přejmenovat profil
  Anaghy, nebo přečíslovat).
- **Tři kánony mimo roster** (`07`, `34`, `49`) zůstávají v adresáři a nepublikují se — stejný
  stav jako před prací, nic se nemazalo.
- **Plný rebuild webu** neproběhl (nebyl potřeba). Až poběží `deploy-web2.9.sh`, přenese se
  i obsah ostatních sessions; data avatarů jsou v něm už teď.
- **Kvalita překladů** je ověřená strukturálně (parita, žádná čeština v EN) — ne jazykovou
  korekturou rodilým mluvčím. U havajského kruhu a u Matrix trilogie by stálo za to projít
  terminologii (např. `kapa`, `heiau`, `Oracle/Orákulum`).
