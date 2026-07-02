# 02 — Roadmapa implementace Zohar do ZIONu

> **Princip:** Zohar není "feature". Je to **paměť architektury**.
> Implementace znamená: propisovat mapování do každé vrstvy tak, aby se
> nikdy neztratilo *proč* je vrstva kde je.

---

## Stav emanace (k 2026-07-03)

| Sefira | Vrstva | Runtime | Docs | Web | Governance |
|--------|--------|---------|------|-----|------------|
| Keter | L1 Consensus | ✅ | ✅ | ✅ genesis page | ✅ ústava |
| Chokmah | L1 PoW | ✅ | ✅ | ✅ mining guides | — |
| Binah | L1 Validation | ✅ | ✅ | ✅ explorer | — |
| Chesed | L2 DeFi | ✅ Base mainnet | ✅ runbook | ✅ /defi | ✅ multisig |
| Gevurah | L2 DAO | ✅ lock | ✅ | ✅ /defi/dao | ✅ guardians |
| Tiferet | L3 WARP | ✅ 12 chainů | ✅ | ✅ /warp | ◐ 3/5 quorum |
| Netzach | L3 AI/Hiran | ◐ v2.2 GGUF | ✅ | ◐ | — |
| Hod | L4 Oasis | ◐ UE5+Rust | ✅ | ◐ /l4-oasis | — |
| Yesod | L5 Komunity | ◐ seed | ✅ te-piko-ora | ◐ | ◐ care vow |
| Malkhut | L6 Issobella | ◐ seed | ✅ TerraNova | ◐ | — |
| Da'at | Tvůrce/Zohar | — | ✅ tento dokument | — | — |

**✅ = živé · ◐ = částečné/v seed · — = neexistuje**

Cíle roadmapy: převést ◐ → ✅ a vyplnit `—`.

---

## Fáze 0 — Manifest (HOTOVO, tento commit)

**Co:** `docs/Zohar/` adresář s README, mapováním sefirot, roadmapou.

**Proč:** Bez mapy se ZION vrstvy stanou seznamem feature. Zohar je mapa
která říká *proč* je každá vrstva kde je.

**Dodáno:**
- [x] `docs/Zohar/README.md` — manifest, vztah k TerraNova + evoluZion
- [x] `docs/Zohar/01-SEFIROT-VRSTVY.md` — 10 sefirot + Da'at + 3 pilíře + 11 cest
- [x] `docs/Zohar/02-ROADMAP.md` — tento soubor
- [x] Odkaz v `AGENTS.md` (Existing guidance files)

**Netýká se:** žádného kódu, žádného L1, žádného webu. Čistá dokumentace.

---

## Fáze 1 — Website vizualizace (plán)

**Co:** Nová React komponenta `/app/zohar` na website-v2.9 — interaktivní
kabalistický strom se 10 sefirot propojenými s ZION vrstvami.

**Proč:** Zohar v docs je pro tvůrce. Zohar na webu je pro komunitu — aby
viděla, že ZION není "jen blockchain", ale organismus s 10 aspekty.

**Kde:**
- `APP&WEB/website-v2.9/src/app/zohar/page.tsx` — route
- `APP&WEB/website-v2.9/src/components/ZoharTreeOfLife.tsx` — komponenta (vedle
  existujícího `InteractiveTreeOfLife.tsx` a `ConsciousnessTreeKabbalah.tsx`)

**Funkce (MVP):**
- SVG strom se 10 sefirot + Da'at
- Klik na sefiru → modal s: kabalistický význam, ZION vrstva, stav emanace
- 3 pilíře vizualizované barvou (Milosrdenství-modrá, Přísnost-červená, Rovnováha-zelená)
- Live data: block height (Keter), TVL (Chesed), bridge volume (Tiferet),
  active validators (Netzach horizont)
- Odkazy na relevantní stránky: /explorer (Binah), /defi (Chesed), /warp (Tiferet)

**Inspirační zdroje v repo:**
- `APP&WEB/website-v2.9/src/components/InteractiveTreeOfLife.tsx` (Strom života v4)
- `APP&WEB/website-v2.9/src/components/ConsciousnessTreeKabbalah.tsx` (kabala strom)
- `APP&WEB/website-v2.9/src/components/HomeTreePortal.tsx` (portál)

**Status:** čeká na schválení + implementaci. Netýká se L1.

---

## Fáze 2 — Governance vow (plán)

**Co:** Validator pledge / DAO admission vow strukturovaný jako "sefirot vow" —
každý z 10 aspektů jako slib péče.

**Proč:** evoluZion.md mluví o "care vow" (`V3/L5/docs/GOVERNANCE/consciousness-admission-framework.md`).
Zohar dává vow **strukturu** — ne jeden slib, ale 10 slibů (jeden za sefiru),
které dohromady tvoří úplnou péči.

**Kde:**
- `V3/L5/docs/GOVERNANCE/sefirot-vow.md` — text vow
- `V3/L2/dao/` — volitelné: on-chain vow hash při validator registraci (horizont)

**Vow struktura (návrh):**
```
1. Keter  — Slibuji ctít ústavu ZIONu (genesis, emission, fee split)
2. Chokmah — Slibuji tvořit, ne plýtvat (užitečný compute, ne waste)
3. Binah   — Slibuji validovat pravdivě (ne podvrhávat bloky)
4. Chesed  — Slibuji dávání štědře (likvidita, yield, pomoc)
5. Gevurah — Slibuji disciplínu (lock, multisig, fee burn)
6. Tiferet — Slibuji harmonii mezi chainy (WARP bez preferencí)
7. Netzach — Slibuji vytrvalou péči (monitoring, care proof)
8. Hod     — Slibuji kulturu (Oasis jako prostor péče, ne hrubost)
9. Yesod   — Slibuji komunitu (péče o půdu, ne jen cloud)
10. Malkhut — Slibuji horizont (Issobella, děti, hvězdy)
```

**Status:** čeká na governance schválení. Netýká se L1 consensus.

---

## Fáze 3 — Care task kategorie (horizont)

**Co:** V Protokolu Péče (Proof-of-Care) klasifikovat care tasks podle sefirot —
každá sefira určuje typ care work který validátor může dostat.

**Proč:** evoluZion.md §Fáze 2-3 popisuje care tasks (WARP audit, anomaly
detection, liquidity rebalancing, smart contract verification, AI inference).
Zohar jim dává **kategorie** — ne náhodný seznam, ale emanace 10 aspektů péče.

**Mapování care tasks → sefirot:**
| Sefira | Care task |
|--------|-----------|
| Keter | Ústavní audit (emission, fee split konzistence) |
| Chokmah | NPU inference quality (care proof accuracy) |
| Binah | L1 anomaly detection (double-spend, reorg) |
| Chesed | Liquidity rebalancing (yield health) |
| Gevurah | DAO proposal audit (governance sanity) |
| Tiferet | WARP bridge audit (cross-chain consistency) |
| Netzach | AI inference pro Hiran (continuous care) |
| Hod | Smart contract verification (Oasis/culture integrity) |
| Yesod | Community health check (L5 komunity) |
| Malkhut | Long-horizon monitoring (Issobella stream) |

**Kde (horizont):**
- `V3/L1/cosmic-harmony/src/` — care task dispatch (POC consensus, až bude)
- `V3/L3/ai-native/` — care proof generátor

**Status:** HORIZONT — závisí na Protokolu Péče consensus (evoluZion.md Fáze 3, 2028+).
**Týká se L1 consensus — vyžaduje explicitní lidské schválení a runbook.**

---

## Fáze 4 — Diagnostika zdraví stromu (horizont)

**Co:** Dashboard / RPC endpoint `getTreeHealth` který vrací stav 10 sefirot
jako health score — červeno/žluto/zeleno pro každou emanaci.

**Proč:** Zohar jako diagnostický nástroj (viz 01-SEFIROT-VRSTVY.md §Závěr).
Ne "je ZION online?" ale "které aspekty organismu jsou zdravé, které nemocné?".

**Kde (horizont):**
- `V3/L1/core/src/rpc.rs` — `getTreeHealth` metoda
- `ZION_OS/dashboard/` — strom-health widget
- `APP&WEB/website-v2.9/src/app/zohar/` — live vizualizace

**Status:** HORIZONT — závisí na Fázi 1 (web) + Fázi 3 (care tasks).

---

## Co Zohar NIKDY nebude

Aby se Zohar nestal náboženstvím nebo "feature creep":

1. **Nebude consensus mechanismus.** Proof-of-Care je consensus (evoluZion.md).
   Zohar je *mapa* consensus, ne consensus sám.
2. **Nebude token.** Žádný "Zohar token", žádný "sefirot NFT". Zohar je
   dokumentační vrstva.
3. **Nebude povinný.** Komunita může žít bez Zohar. Zohar je *nabídkou*
   jazyka, ne dogmatem.
4. **Nebude editovat L1 bez runbooku.** Viz AGENTS.md L1 Protocol Security
   Protocol. Zohar je mapa — mapa nemá měnit území bez schválení.
5. **Nebude náhradou TerraNova.** TerraNova je kniha (kde jdeme), Zohar je
   mapa (jak jsme uspořádáni). Obojí je potřeba.

---

## Závislosti mezi fázemi

```
Fáze 0 (manifest) ✅
    │
    ├── Fáze 1 (web) — nezávislá, může začít ihned
    │
    ├── Fáze 2 (governance vow) — nezávislá, může začít ihned
    │       │
    │       └── Fáze 3 (care tasks) — závisí na Protokolu Péče + Fázi 2
    │               │
    │               └── Fáze 4 (diagnostika) — závisí na Fázi 1 + 3
    │
    └── (paralelně: evoluZion.md Fáze 2-3 — PoW → PoC evoluce)
```

**Kritická cesta:** Fáze 0 → Fáze 2 → Fáze 3 → Fáze 4.
**Rychlá cesta (viditelná pro komunitu):** Fáze 0 → Fáze 1.

---

## Metriky úspěchu

| Metrika | Fáze 0 | Fáze 1 | Fáze 2 | Fáze 3 | Fáze 4 |
|---------|--------|--------|--------|--------|--------|
| Sefirot v runtime | 0 | 0 | 0 | 10 (care tasks) | 10 (health) |
| Sefirot na webu | 0 | 10 | 10 | 10 | 10 + live |
| Validators se sefirot vow | 0 | 0 | N | N | N |
| Care tasks kategorizovaných | 0 | 0 | 0 | 10 | 10 |
| `getTreeHealth` RPC | — | — | — | — | ✅ |

---

## Odkazy na zdroje

| Zdroj | Cesta | Proč |
|-------|-------|-----|
| evoluZion.md | [`docs/3.0.3/evoluZion.md`](../3.0.3/evoluZion.md) | Strom života metafora, Protokol Péče |
| TerraNova kniha | [`docs/TerraNova/README.md`](../TerraNova/README.md) | Filosofie péče, 4 knihy ZION |
| NPU Mining Theory | [`docs/NPU_HARDWARE_MINING_THEORY.md`](../NPU_HARDWARE_MINING_THEORY.md) | Chokmah technický základ |
| L5 governance | [`V3/L5/docs/GOVERNANCE/consciousness-admission-framework.md`](../../V3/L5/docs/GOVERNANCE/consciousness-admission-framework.md) | Care vow základ pro Fázi 2 |
| InteractiveTreeOfLife | [`APP&WEB/website-v2.9/src/components/InteractiveTreeOfLife.tsx`](../../APP&WEB/website-v2.9/src/components/InteractiveTreeOfLife.tsx) | Inspirační zdroj pro Fázi 1 |
| ConsciousnessTreeKabbalah | [`APP&WEB/website-v2.9/src/components/ConsciousnessTreeKabbalah.tsx`](../../APP&WEB/website-v2.9/src/components/ConsciousnessTreeKabbalah.tsx) | Kabala strom již na webu |
| AGENTS.md L1 Protocol | [`AGENTS.md`](../../AGENTS.md) §L1 Protocol Security | Omezení pro Fázi 3 |

---

*02-ROADMAP.md · ZION Zohar · 2026-07-03*
*Etz Chaim hi-hu lo, v'lo hu ela hi*
