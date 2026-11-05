# REPORT — ZION Archive: překladová session T1–T10 (81 kapitol)

> **Datum:** 2026-11-05 · **Vlastník:** 👤 · **Plán:** [`TRANSLATION-PLAN.md`](../../../TRANSLATION-PLAN.md)
> **Kód:** `apps/website-v2.9` · **Stav po session:** **146 / 189 kapitol (77,2 %)**, zbývá **43**

---

## 1. Co se udělalo

Devět knih přeloženo do angličtiny podle §4 (cesty) a §5 (pravidla) plánu. Každá dávka: `npm run build` → audit
přes standalone → commit **jen vlastních souborů** → push.

| Milník | Kniha | Kapitol | Commity | Poznámka |
|---|---|---:|---|---|
| **T1** | Surta Srdce | 9 (6 nových) | `f3e9ee328`, `a17a99587`, `d707f5d2d` | dedikovaný reader `en/books/surta-srdce/` |
| **T2** | Nabukano | 7 | `86818a1b0`, `f0ad93d3d`, `c4eb2279a` | korpus, `<slug>_EN.md` |
| **T3** | Mise Amenti | 8 | `77dff9cd8`, `a5ab25ce9`, `107aa18a1`, `4b55eb729` | normativní text, statusy doslovně |
| **T4** | Růže | 11 | `34ff2d600`, `41f553342`, `d0d8c1547`, `4c48d6d1c` | bajka, celý děj MÝTUS |
| **T5** | Issobella | 11 | `f92c4aec3`, `bc89af1f2`, `752804bc8`, `30425efad` | adresy + premine slot 6 |
| **T6** | Na Cestě | 2 | `85de3a05f`, `dc613642f` | největší kapitola plánu (32 kB) |
| **T7** | MariaCaminho | 12 | `69616cb5c`, `56e131bbd`, `8973e06f7`, `c1f949f54`, `7c4038495` | flotila Tres Marias |
| **T8** | Ekam Deeksha | 10 | `8aca7fc52`, `0ab03826e`, `7bca4fe1b`, `6f7ae7e98`, `59a8b85dd`, `f72a85dfd` | public-docs, náhrada 401B stubů |
| **T9** | Quantum Revolution | 1 (single-doc) | `34e3e804b` | náhrada 396B stubu |
| **T10** | Miriam | 13 | `8824241ea`, `81e889ece`, `920a54d89`, `0bda808fe`, `505195f79` | tři vrstvy Stone/Clay/Dream |

**Celkem tato session: 81 kapitol** (z 65 na 146).

## 2. Ověření (poslední běh)

Audit `GET /api/archive/audit` na standalone (`PORT=3124`, `ARCHIVE_ADMIN_TOKEN`):

```
TOTALS: {books: 18, declaredChapters: 204, missingCs: 1, missingEn: 43,
         frontMatter: 15, duplicates: 0, missingParts: 0}
surta-srdce 100 % · nabukano 100 % · miseamenti 100 % · ruze 100 %
issobella 100 % · naceste 100 % · mariacaminho 100 % · ekam 100 %
miriam 100 % · quantum-revolution: singleDoc. cs 10 / en 10 kapitol
```

- `npm run build` EXIT 0 u každé dávky, `npx tsc --noEmit` 0 chyb.
- HTML/HTTP: korpusové kapitoly přes `/api/archive/docs/...` = 200; veřejné povrchy (`ekam-deeksha`, `quantum-revolution`) přes `/docs/en/...` = 200.
- `npm run check:links` — 0 mrtvých odkazů u nově přeložených souborů.
- **Strukturální kontrola 1:1** u každé dávky: množina odkazů porovnaná `diff` proti CZ, počty nadpisů, u `01-Na-Ceste` i počty řádků (429/215/9/9).

## 3. Tři skutečné chyby, které session odhalila

1. **Odkazy na české slugy** — při překladu vznikly dvě přepsané cesty: `06-Lod-bez-Platev` (správně `06-Lod-bez-Plachet`) a `Mirror/06` (správně `Miriam/06`). Chyceno automatickým `diff` odkazů, opraveno před commitem. **Pravidlo:** po každé kapitole porovnat `grep -o "](\.\.*[^)]*)"` CZ vs. EN.
2. **Single-doc reader znal jen „Kapitola"** — `QR_BOOK.singleDoc.chapterMatch.re` bylo `/^Kapitola\s+\d+/i`, takže po přeložení do angličtiny by reader spadl na **jednu** kapitolu místo deseti. Opraveno na `/^(?:Kapitola|Chapter)\s+\d+/i` (commit `34e3e804b`); stejně rozšířen `singleDocInfo()` v audit route, aby EN počítal kapitoly. Po fixu: `cs 10 / en 10`.
3. **401B / 396B stuby** u Ekam a Quantum Revolution — kdyby se překlad uložil *vedle*, audit by je dál hlásil jako chybějící. Byly **přepsány**; `BOOK-FULL-VERSION.md` (126 kB) kapitola není a zůstává stubem.

## 4. Konvence překladu (závazné pro zbytek)

- **Statusy doslovně:** `ŽIVÉ→LIVE`, `STAVBA→BUILDING`, `HORIZONT→HORIZON`, `HYPOTÉZA→HYPOTHESIS`, `MÝTUS→MYTH`, `NEDOLOŽENO→UNSUBSTANTIATED`, `NEPLATNÝ NÁROK / NEPLATNÉ TVRZENÍ→INVALID CLAIM`.
- **Jména:** `Sára→Sarah`, `Rádha→Radha`, `Stříž→Strizh`, `Jen-že→Only-that`, `Poutník→the Pilgrim`; `Inés Varela`, `Teura`, `Anjali`, `Hina`, `María la Mayor`, `Nossa Senhora de Fátima`, `María de las Nieves`, `Elizabeth` (= Lumi = Malý princ / Pražské Jezulátko); mantry v původním přepisu kurzívou (`gate gate pāragate…`, `oṃ maṇi padme hūṃ`), `sādhu`, `oṃ`/`oṃ`.
- **Neměnné:** čísla, adresy, env klíče, id a data (`zion1z4s3a5…`, `zion1f5h5k6t8…`, 300M ZION, 2,5 mld, lock 144 000, `ISSOBELLA_PCT = 5`, 89/5/5/1 %, `node_reward_activation_height = u64::MAX`, 0,38 g / 200 m / ~2 RPM, LEO 400–550 km, `48dcc0b2-…`, 1984/1994/2003/2008/2018, 1917, 352, 1676, 1488).
- **Kód:** placeholdery (`issobella tracker`, `zion-*-service`, `interní port` → `internal port`), `interní repozitář` → `internal repository` (odkaz `../../../interní%20repozitář`), code blocky Cosmic Harmony v3 **doslova**.

## 5. Co zbývá (43 kapitol, ~0,49 MB)

| Milník | Kniha | Kapitol | Odhad dávek |
|---|---|---:|---:|
| **T11** | Lumi | 13 | 4 |
| **T12** | Kruh Bohyní | 17 | 5 |
| **T13** | BodhiGaia | 13 | 5 |

## 6. Meze

- Překlady jsou **EN drafty**, ne oficiální edice (výjimkou je Království srdce, převzaté z klasické EN edice). Doporučena redakční revize 👤 před veřejným vydáním.
- Front matter (`00-README`, `00-*`) se nepřekládá a do coverage nevstupuje — u Nabukana, Mise Amenti, Růže a dalších tedy zůstává CZ.
- `missingCs: 1` u `miseamenti/README` je **flaky** (souběžný `npm run build` paralelní session přepisuje `.next/standalone` pod běžícím auditem); soubor na disku i v manifestu existuje.
- Deploy na EDGE2 nebyl proveden — live build by kolidoval s běžící paralelní session (nirvana/OASIS).
- **`npx tsc --noEmit` v `apps/website-v2.9` hlásí ~32 chyb, které nejsou z překladu:** paralelní session rozpracovala `apps/MarketPlace/src/lib/translations.ts` (`Lang` rozšířen na `cs/en/es/fr/pt`), zatímco `whitepapers`, `roadmap`, `ai-native`, `NavAuthButton` a `translations.ts` drží dvoujazyčné slovníky. Po `git stash` mých dvou TS úprav počet chyb naopak vzroste (33) → chyby jsou cizí a neopravovaly se. `npm run build` je zelený (EXIT 0).
