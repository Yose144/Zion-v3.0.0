# Report — CL, NCL kurikulum a příprava questů v Nirvaně — 2026-11-11

**Zadání:** 👤 „dharma cíl … ale koukni podrobněji i na NCL task a CL stupně …
to všechno musí hráč procházet a dále příprava pro questy, ale to dáme až do
OASIS … ale jako první svět by měla Nirvana obsahovat všechno, co půjde pak
do OASIS."

**Kontext:** předchozí krok přidal XP a dharma validátor (pět pilířů).
Tenhle krok doplňuje **stupně vědomí (CL)**, **NCL kurikulum**, **denní
dharma cíl** a **datový základ questů**.

---

## 1. Co je převzaté z kódu (a co ne)

| Systém | Zdroj v repu | Co z něj Nirvana používá |
|---|---|---|
| `ConsciousnessLevel` L0–L6 | `V31/L3/ai-native/src/consciousness.rs`, `PoC-lab/poc-core` | jména stupňů, pořadí, „vyšší = víc" |
| NCL bonus | tamtéž: `ncl_bonus_factor() = level × 0,05` | násobek XP za stupeň (max +30 %) |
| `NclTaskType` | `V31/L3/ncl/src/types.rs` | šest typů jako taxonomie úloh |
| NCL reputace | `V31/L3/ncl/src/reputation.rs`: `score = base × success_rate × (1 + CL × 0,05)`, clamp 0–100 | stejný vzorec nad splněnými úlohami |
| Dharma pilíře | `PoC-lab/poc-verifier` | (už v předchozím kroku) |

**Co Nirvana nedělá:** nepočítá modely ani nepřiděluje výpočet. NCL je tu
**kurikulum**, ne marketplace — v UI je to napsané a v testech to hlídá
typ úlohy.

---

## 2. CL — Consciousness Level hráče

Sedm stupňů s prahy **100 / 600 / 2 000 / 6 000 / 15 000 / 35 000 XP**
(Dormant 0 … Grok 6). Bonus `level × 0,05`.

| Stupeň | Hráčský výklad |
|---|---|
| L0 Dormant | Poutník, který ještě nevyšel. |
| L1 Aware | Vidíš, že světy existují. |
| L2 Sentient | Cítíš, co se v nich děje. |
| L3 Transcendent | Procházíš je bez ztráty sebe. |
| L4 Omniscient | Znáš soustavu jako mapu. |
| L5 Cosmic | Neseš světlo dál, než jsi došel. |
| L6 Grok | Rozumíš celku, ne jen cestě. |

**CL nic nezamyká** — jen násobí XP. Zámek by po aktualizaci sebral hráči
obsah, který už měl; až přijdou questy v OASIS, mohou se na CL navěsit
(odtud `quest.cl`).

---

## 3. NCL kurikulum — 12 úloh

Každá úloha je deklarativní cíl (`NclGoal`), takže ji jde spočítat bez UI
i přenést do OASIS:

| Úloha | Typ | Cíl | XP |
|---|---|---|---|
| První světlo | custom | 1 dohraná hra | 40 |
| Dva světy | embeddings | 2 různé světy | 60 |
| Dotočit do konce | llm_inference | 1 dokončený běh | 60 |
| První pečeť | custom | 1 dharma pečeť | 80 |
| Čtyři světy | code_analysis | 4 světy | 90 |
| Sedm světel | image_generation | Lumi 900+ | 90 |
| Až na dno | model_training | Neptun 900+ | 90 |
| Devět lamp | custom | Pluto 900+ | 90 |
| Daruj světlo | custom | 1 dar v Lumi | 100 |
| Šest světů | embeddings | 6 světů | 120 |
| Tři pečeti | custom | 3 pečeti | 150 |
| Celý systém | code_analysis | 12 světů | 250 |

Skóre: `(splněné / 12) × 100 × (1 + CL × 0,05)`, clamp 0–100.
`nclDone` v profilu drží splněná id, aby se XP za úlohu nepřipsalo dvakrát.

---

## 4. Denní dharma cíl

Druhá polovina dne vedle denní výzvy: výzva chce **skóre**, dharma cíl chce
**pečeť** (čistý běh — čas, cíl, světla, žádné pády). Losuje se s jinou solí,
aby oba cíle nepadly na stejnou hru. Odměna **3 žetony**, jednou denně
(`dharmaGoalDay`). Karta je na `/park` vedle denní výzvy a stav je i v Cestě.

---

## 5. Questy — připraveno pro OASIS

`core/progress/quests.ts` má čtyři questy (`ready: false`), každý s krokem
typu `NclGoal`, minimálním CL a odměnou:

1. **První cesta** (CL 1) — dohraj hru, projdi dva světy.
2. **Světlo a tma** (CL 2) — Lumi, Neptun, Pluto.
3. **Srdce soustavy** (CL 3) — tři pečeti, šest světů.
4. **Strážce prahu** (CL 4) — dvanáct světů, pět pečetí.

V Nirvaně se jen vypisují jako „připraveno pro OASIS" (zamčené podle CL).
Při přesunu do OASIS se nemusí nic přepisovat — jen `ready: true`.

---

## 6. Soubory

**Nové:** `core/progress/consciousness.ts`, `core/progress/ncl.ts`,
`core/progress/quests.ts`, `test/consciousness.mjs`.

**Změněné:** `core/park/profile.ts` (`plays`, `completions`, `gifts`,
`nclDone`, `dharmaGoalDay` + migrace), `core/park/challenge.ts`
(`CHALLENGE_GAMES`, `dailyDharmaGoal`, `claimDharmaGoal`),
`core/progress/xp.ts` (`clBonus`), `core/progress/run.ts` (statistiky,
NCL úlohy, CL, dharma cíl), `core/progress/DharmaPanel.tsx` (čtyři bloky),
`src/app/park/page.tsx` (karta dharma cíle), `globals.css`,
`e2e/path-audit.mjs`, `test/progress.mjs`, `AGENTS.md`.

---

## 7. Ověření

- `npx tsc --noEmit` 0 · `npm run build` OK
- `npx tsx test/consciousness.mjs` — **66/66**
- `npx tsx test/progress.mjs` — **OK**
- `npx tsx test/dharma.mjs` 52/52 · `test/neptun-dive.mjs` 75/75 ·
  `test/pluto-light.mjs` 56/56
- `node e2e/path-audit.mjs` — **26/26** (panel: CL, 12 NCL úloh, dharma
  cíl, 4 questy; dohraná hra zapíše XP + dharmu + NCL; telefon)
- `node e2e/mobile-audit.mjs` — PASSED (10 her, 390×844)
- Screenshot: `.artifacts/render/path/panel-after.png`

---

## 8. Meze

- Vše je v prohlížeči (`localStorage`) — XP, CL, NCL, pečeti i dharma cíl.
  Nic z toho není on-chain a nedá se směnit.
- **Questy se nehrají** (jen se vypisují) — zapnou se až v OASIS.
- NCL je kurikulum, **ne výpočet**; typy úloh jsou taxonomie z kódu.
- Park kabinety, tanky a flotila zatím neposílají `metrics` (validátor
  u nich běží s neutrálními hodnotami).
