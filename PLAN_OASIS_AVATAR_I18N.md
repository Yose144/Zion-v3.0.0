# PLAN — OASIS avataři: dvojjazyčný kánon (CS + EN)

> **Stav: 2026-11-04** · vlastník: 👤 · vykonává: agent
> **Cíl:** všech **200 avatarů** má **oba jazyky** (kánon + překlad), stránka `/l4-oasis/avatars` i modální profil fungují v `cs` i `en`, jednou nasazené.
> Tento dokument je **jediný vstupní bod** pro pokračování. Nová session začíná zde.

---

## 1. Co je hotové (2026-11-04)

| Vrstva | Stav |
|---|---|
| **Karty avatarů (overlay cs+en)** | ✅ 200/200 — `apps/website-v2.9/scripts/oasis-avatar-copy/*.json` (7 polí × 200 = 1 400 párů) |
| **Questy (cs+en)** | ✅ 704 questů pro 200 postav (`quests-unique.json` 139, `quests-filler.json` 115, `quests-lite-1..3.json` 450) |
| **Překlady profilů** | 🟡 **188 z 205** souborů má druhý jazyk (47 `.cs.md` + 141 `.en.md`) |
| **Zbývá** | ❌ **16 souborů** → viz §4 |
| **Deploy webu** | ❌ nenasazeno — běží build před i18n vrstvou |

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

## 4. Zbývající práce — 16 souborů (všechny `cs` kánon → `.en.md`)

| # | soubor (kánon) | znaků | cíl |
|---|---|---:|---|
| 08 | `08_ISSOBELA.md` | 12 880 | `i18n/08.en.md` ⚠️ pozor, viz §6 |
| 40 | `40_LUMI.md` | 10 618 | `i18n/40.en.md` |
| 41 | `41_VASUDEVA.md` | 24 684 | `i18n/41.en.md` |
| 42 | `42_SRI_CHAITANYA_MAHAPRABHU.md` | 27 165 | `i18n/42.en.md` ⚠️ duplicitní ID |
| 42 | `42_SRI_DATTATREYA.md` | 21 188 | ⚠️ duplicitní ID — rozhodnout, viz §6 |
| 43 | `43_MALY_PRINC.md` | 28 820 | `i18n/43.en.md` ⚠️ duplicitní ID |
| 43 | `43_SRI_ANAGHA_LAKSHMI.md` | 16 737 | ⚠️ duplicitní ID — rozhodnout, viz §6 |
| 51 | `51_DALAI_LAMA_XIV.md` | 13 947 | `i18n/51.en.md` |
| 52 | `52_HEHAKA_SAPA.md` | 2 082 | `i18n/52.en.md` |
| 62 | `62_LA_ILIAI.md` | 21 842 | `i18n/62.en.md` |
| 63 | `63_PELE.md` | 17 461 | `i18n/63.en.md` |
| 64 | `64_HIIAKA.md` | 19 119 | `i18n/64.en.md` |
| 65 | `65_KANE.md` | 18 285 | `i18n/65.en.md` |
| 66 | `66_KANALOA.md` | 20 787 | `i18n/66.en.md` |
| 67 | `67_KU.md` | 18 645 | `i18n/67.en.md` |
| 68 | `68_LONO.md` | 21 912 | `i18n/68.en.md` |
| 69 | `69_STARA_KUMU_LEHUA.md` | 23 723 | `i18n/69.en.md` |
| 70 | `70_HINA.md` | 24 379 | `i18n/70.en.md` |

**Objem:** ~350 tis. znaků ≈ **55 tis. slov**. Odhad: **8–12 dávek** po 2–3 profilech (havajské profily jsou nejdelší v celém kánonu).

**Doporučené pořadí:** 52 → 08 → 40 → 51 → 63 → 64 → 62 → 65 → 67 → 66 → 68 → 69 → 70 → 41 → 42 → 43 (od nejkratšího, aby byl vidět postup).

---

## 5. Ověření před nasazením

```bash
# a) každý profil má oba jazyky
cd docs/docs2.9/ZION_OASIS/SACRED_TRINITY
for f in [0-9]*.md; do
  i=$(echo "$f" | sed 's/_.*//')
  ls i18n/$i.*.md 2>/dev/null | wc -l | grep -q 2 || echo "CHYBÍ: $i"
done

# b) generátor + typy
cd /Users/yeshuae/Projects/2.9.6/apps/website-v2.9
node scripts/gen-oasis-avatars.mjs
npx tsc --noEmit
ls public/data/oasis/profiles/*.md | wc -l     # očekáváno ~405 (205 kánonů + 200 překladů)

# c) build
npx next build --webpack

# d) deploy (až po dokončení VŠECH překladů — build je drahý)
bash apps/website-v2.9/deploy/deploy-web2.9.sh

# e) live kontrola
curl -sI https://app.zionterranova.com/l4-oasis/avatars | head -1
#   → v modalu přepnout CS/EN a ověřit, že se mění text profilu
```

---

## 6. Otevřené otázky / pasti

1. **Duplicitní ID 42 a 43** — existují dva kánony pro totéž ID:
   - `42_SRI_CHAITANYA_MAHAPRABHU.md` **a** `42_SRI_DATTATREYA.md`
   - `43_MALY_PRINC.md` **a** `43_SRI_ANAGHA_LAKSHMI.md`
   Generátor drží mapu `id → soubor` a **poslední vyhrává** (readdir order) → do stránky se dostane jen jeden z nich, obsahově nejistý.
   **Rozhodnout 👤:** který soubor je kanonický pro ID 42 a 43; druhý přesunout mimo regex (např. `archive/`) nebo přejmenovat na `142_…`/`143_…`. Do té doby **nepřekládat** oba — jen ten, který zůstane.
2. **`i18n/08.cs.md` je redundantní** — kánon `08_ISSOBELA.md` je již česky. Soubor nic nerozbíjí (generátor jej přeskočí), ale je matoucí. Řešení: nahradit `08.en.md` a `08.cs.md` smazat.
3. **Nulové paddingy** — soubory jsou `00.cs.md`…`09.cs.md`. Kontrolní skripty porovnávající `int(id)` selžou; vždy porovnávat **zero-padded** názvy.
4. **Paralelní session** pracuje ve stejném repu (`apps/MarketPlace/**`, buildy webu). Proto:
   - **nikdy `git add -A`** ani `git add .`;
   - commituj jen `i18n/` + `public/data/oasis/profiles/`;
   - nespouštěj `npm install`/`npm ci` (už dvakrát rozbilo `node_modules`);
   - před deployem zkontroluj `git status`.
5. **Deploy webu je drahý a koliduje** s paralelní session → dělat **jeden** deploy až na konci, ne průběžně.
6. **Produkční JS** escapuje non-ASCII (`\xNN`) — grep na česká slova v buildech selže; ověřovat přes HTTP odpověď, ne grep.

---

## 7. Start nové session (zkopírovat)

```bash
cd /Users/yeshuae/Projects/2.9.6
git log --oneline -5
git status --porcelain | head

# ověřit, co ještě chybí
cd docs/docs2.9/ZION_OASIS/SACRED_TRINITY
ls i18n/*.cs.md | wc -l; ls i18n/*.en.md | wc -l
```

Pak: vzít první soubor z §4, přeložit, `node scripts/gen-oasis-avatars.mjs`, `npx tsc --noEmit`, commit (jen explicitní cesty).

**Hotovo =** všech 205 kánonů má protějšek v `i18n/` → build → **jeden** deploy → live kontrola CS i EN v modalu.

---

## 8. Odkazy

| Co | Kde |
|---|---|
| Kánon profilů | `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/` |
| Překlady | `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/i18n/` |
| Generátor | `apps/website-v2.9/scripts/gen-oasis-avatars.mjs` |
| Overlay karet (cs+en) | `apps/website-v2.9/scripts/oasis-avatar-copy/` + `README.md` |
| Generovaný roster | `apps/website-v2.9/src/lib/oasis/avatars.ts` |
| Stránka | `apps/website-v2.9/src/app/l4-oasis/avatars/page.tsx` |
| Publikované profily | `apps/website-v2.9/public/data/oasis/profiles/` |
| Roster / kruhy | `docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md` |
| Deploy | `apps/website-v2.9/deploy/deploy-web2.9.sh` |
| Reporty | `docs/3.2/REPORTS/REPORT_2026-11-04_AVATARI_WEB.md`, `…_OASIS_AVATAR_I18N.md` |
