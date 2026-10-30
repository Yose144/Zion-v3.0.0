# ZION B2B — monetizační plán

> **Datum:** 2026-10-27 · **Autor:** Devin analýza (na žádost operátora)
> **Cíl:** převést ekosystém na reálné peníze — likvidita + cashflow.
> **Pravidlo (stejné jako v plánu 3.2):** reality > docs. Čísla níže jsou změřená naživo 2026-10-27, ne z whitepaperu.

---

## 0. Tvrdá realita — výchozí bod

| Metrika | Stav 27. 10. | Důsledek |
|---|---|---|
| wZION/USDT pool (Base, `0x186b…fdda`) | **TVL $38**, cena ~$0.000125/ZION | ZION je fakticky nelikvidní — "příjem v ZION" ≠ cashflow |
| CoinGecko | listing zamítnut (17 prerekvizit → 9.B7) | žádný organický sell-side kanál |
| DAO treasury | 1.5B ZION; lock do bloku **144 000 (~27.–28. 11.)** + on-chain 3-of-3 admin unlock + DAO proces | zatím nepoužitelná — žádný seed liquidity |
| Pool payout backlog | **recovery in flight 28.10.** — root cause fix `defdcd84a` deployed: active unconfirmed 1 180 → klesá (canary ~695 a padá); treasury teď canonical `zion1d2k` (~187k ZION) | ZION strana se řeší autonomně; ~918 QTC deferred stále = 👤 treasury/funding |
| Presale | deprecated — `/api/presale/status` vrací 410 "Fair launch only" | token-sale cesta uzavřená |
| NCL compute market | daemon live (`V31/L3/ncl`), 10 % protocol fee | **0 workerů, 0 customers** — engine bez trhu |
| Externí audit (G9) | 👤 posunut na neurčito | enterprise B2B bude ptát — připravit odpověď |

**Fundamentální závěr:** Jediný fiat-konvertibilní příjem, který umíme generovat DNES, je (a) aux-mining externích coinů a (b) fiat e-shop. Vše denominované v ZION je interní účetnictví do okamžiku likvidity.

---

## 1. Inventura aktiv

| Asset | Soubor / provoz | Stav | Monetizační potenciál |
|---|---|---|---|
| **Pool NG** | `V31/L1/pool`, produkce 97k+ bloků | multichain TLS stratum, PPLNS, dedup, luck persistence, aux legy (QTU/PRL/ZANO/VRSC/XMR/EVR/KRX/MEWC) | pool-as-a-service, merge-mining hosting, % fee |
| **Autonomous Profit Router** | `V31/L1/miner/src/autonomous.rs` | code-complete, WhatToMine/NiceHash oracle, hystereze 15 %, default OFF | aux-coin revenue na fiat; i jako B2B feature |
| **Hiran / Hiranyagarbha AI** | EDGE2 ai-native :8001, hiran-mini 8B GGUF, RAG 39 docs/138 chunků, veřejný `/api/ai-chat` | live; inference PC GPU + EDGE2 CPU fallback; vast fleet + vLLM katalog (`infra/tools/vast/vastctl.py` MODEL_CATALOG) | prodej inference $/1M tok — `HIRAN-MARKETPLACE-PLAN.md` F2–F4 |
| **MarketPlace + e-shop** | `apps/MarketPlace` (market.zionterranova.com) | Prisma schema (Artifact/Collection/Listing/Bid/Sale + ShopProduct/ShopOrder/Invoice), Stripe checkout+webhook, QR transfer, rasta e-maily, faktury — ~95 % E2E | **fiat rail**; zbývá 5.B6 E2E verify + invoice download route |
| **NCL daemon** | `V31/L3/ncl` | jobs (LLM/image/train/embed/code/custom), backends ONNX/WASM/TFLite/custom, pricing 0.01 ZION/unit, **10 % protocol fee**, reputation, persistence | sovereign AI compute market — potřebuje demand |
| **DAO stack** | `V31/L2/dao` | návrhy 5 typů, timelock 72 h, kvórum 15 %, 5-of-7 guardians, treasury ops, events log | governance-as-a-service |
| **ZIS identity** | `apps/identity` (Fastify) | Ed25519/SIWE/Google, EdDSA JWT+JWKS, passkeys, SSO napříč doménami, 46/46 testů | auth/SSO balíček; slabší priorita (Privy/Clerk konkurence) |
| **L5/L6 fondy** | coinbase 5 %+5 %; Issobella ~26M ZION (97k) | trackery live, QV kola | grant program → partnerská síť; bez likvidity ne cash |
| **Content/IP** | `canon/books/` — 13+ knih, artworky, 3D assety, WpStory | kompletní | merch, knihy, licensing |
| **Emission split** | `V31/L1/core/src/emission.rs` | 89 miner / 5 humanit / 5 issobella / 1 node reward (zatím burn) | pool fee `pool_fee_bps=100` = 1 % ZION payoutů |

---

## 2. B2B návrhy — podle time-to-cash

### A. HNED (0–4 týdny) — fiat příjmy z existujícího

#### B2B-1 · E-shop live (Stripe) — nejrychlejší fiat rail
- **Co:** dokončit 5.B6 — E2E checkout + `/api/invoice/[id]/download` + `/order-tracking` + nasadit.
- **Prodávat:** fyzické knihy (canon = 13 titulů), art printy, merch. Inventář = 20 seeded produktů (`POST /api/shop/seed`).
- **Riziko:** minimální — stack je postavený, jen neotestovaný.
- **Výsledek:** první CZK/EUR během týdnů. **Jediná cesta, kde peníze přijdou do 48 h provozu.**

#### B2B-2 · Aux-mining → fiat rotace
- **Co:** (a) vyřešit payout backlog 2.B7 — vyplatit nebo deklarovaná politika + komunikace minerům; (b) `PRL_PAYOUT_DRY_RUN` → 0 + sweep revenue do oyster (2.B6); (c) profit-routing na fiat-konvertibilní coiny (ZANO/VRSC/XMR/KAS) + pravidelný prodej.
- **Objem:** malý (řádově $/den podle fleet), ale **reálný cashflow hned** — a zároveň opravuje retenci minerů (dluh = největší produktový problém).
- **Pozn.:** 918 deferred QTC payoutů = důvěra; bez vyřešení se miner základna rozpadne dřív, než cokoliv prodáme.

#### B2B-3 · Hiran API — private beta
- **Co:** OpenAI-kompatibilní endpoint na vast rigách (vLLM katalog existuje), `X-API-Key` gate přes ZIS, Stripe subscription CZK/EUR, metering přes NCL daemon (pricing engine už počítá).
- **Positioning:** „EU-hosted LLM" — GDPR/data sovereignty pro české/EU klienty; data neopouští EU, žádný US cloud.
- **MVP scope:** jeden model tier (8B chat + RAG), $/1M tok nebo flat monthly, `/v1/models` gateway (HIRAN-MARKETPLACE-PLAN F2).
- **Stav 29.10.:** free tier live na `market.zionterranova.com/v1/` (`hiran-mini`); Pro/Team = 👤 Stripe price IDs.
- **Čas:** 2–4 týdny do prvního MRR (paid).

#### B2B-3b · Hiran Agent v `zion` CLI — autonomní programování (Cursor / Claude Code / Devin třída)
- **Nápad (29.10.):** přímo do unified CLI (`V31/cli` → bin `zion`) a do public/archive miner CLI balíčků přidat **AI agent servis** — lokální/remote agent + model routing pro autonomní coding (read/edit/run/test loop), ne jen chat.
- **Co prodáváme:** `zion agent` (nebo `zion ai`) — session s tools (fs, shell, git, test), napojená na Hiran API (B2B-3) + volitelně BYOK; subscription stejný Stripe rail jako `/ai`.
- **Positioning:** EU-sovereign coding agent — kód a kontext neopouští EU (default Hiran upstream); ZION ecosystem awareness (RAG z L3 + canon) jako moat vs generický Claude/Devin.
- **Distribuce:** (1) `zion` V31 operator CLI; (2) public `v3-Mainnet` / archive CLI artefakty — stejný subcommand, feature-flag `agent`; (3) později desktop-agent embed.
- **Synergie:** B2B-3 metering + ZIS keys = auth; Maestro/ai-native tool layer = seed pro agent tools; NCL = heavy jobs.
- **MVP scope (návrh):** REPL + one-shot `zion agent -p "…"`, tool allowlist, Hiran `hiran-mini` default, Pro unlock větších modelů; žádný silent cloud exfil.
- **Priorita:** hned za B2B-3 paid — stejný fiat rail, vyšší ARPU než raw API; spec `docs/3.2/B2B_HIRAN_AGENT_CLI.md`.
- **Stav (2026-10-29):** ✅ MVP + ZIS device-code login — `zion hiran login|whoami|subscribe` + agent loop; Stripe/`X-API-Key` upgrade + Base USDC MetaMask; kanon [`HIRAN-CLI-AUTH.md`](HIRAN-CLI-AUTH.md). **Další:** sjednocení s Vast `#ai` + fleet → [`docs/3.2/VAST_HIRAN_CODING_AGENT_PLAN.md`](../3.2/VAST_HIRAN_CODING_AGENT_PLAN.md) (B2B #4c).
- **Čas:** 3–6 týdnů po live Hiran API (reuse gateway + Stripe).

#### B2B-3c · Vast Coding Agent (sjednocení `#ai` + fleet + CLI)
- **Nápad (29.10.):** jeden coding agent napříč `/vast-rigs/#ai` (katalog/vLLM), fleet agentem (2.B11) a Hiran CLI — autonomní programování na vast.io s EU/Hiran metering.
- **MVP:** model alias `hiran-coder` → vast vLLM / PC coder / EDGE2; na rigu op `code.run` (tool jail); UI karta + `zion hiran agent --remote vast`.
- **Priorita:** po enrollu rigu (2.B11) a po B2B-3b; plán `docs/3.2/VAST_HIRAN_CODING_AGENT_PLAN.md`.
- **Train-first:** kvalitní agent = Issobella po FT (#4d); scaffold F1–F3 mezitím na mini + generic coder.

#### B2B-3d · Hiran Trinity (Amitábha / Issobella / Maitreya)
- **Nápad:** tři persony z `#ai` katalogu (dnes `mockup`) — Hlas / Code / Teacher — společný ZION constitution, oddělené LoRA.
- **Pořadí:** shared dataset → Maitreya (lore) → Amitábha (reason) → Issobella (agentic code).
- **Gate:** licence korpusu + eval suite; train na vast GPU (👤 kredit).

### B. Krátký horizont (1–3 měsíce) — služby založené na stacku

#### B2B-4 · Pool-as-a-Service (white-label stratum)
- **Nabídka:** hosted stratum pro malé PoW coiny — TLS, multi-coin PPLNS, dedup, payout ledger, metriky, failover.
- **Model:** setup fee + 1.5–2 % fee z rewardů; SLA na uptime (G8 monitoring existuje).
- **Důkaz provozu:** 97k+ bloků, audit vlny 1–7, alerting stack.
- **Realita:** 1–2 klienti/kvartál = $ stovky–nízké tisíce/měs.; niche trh, ale unikátní schopnost.

#### B2B-5 · Merge-mining hosting / hashrate marketplace
- **Nabídka:** jiný coin se "připne" jako aux leg ZION poolu (pattern už interně provozovaný pro QTU/PRL/ZANO) → jejich mineři dostanou zaplaceno v jejich tokenu, ZION bere % fee z hostované kapacity.
- **Synergie s B2B-4:** jeden prodejní balíček, dvě úrovně.

#### B2B-6 · NCL compute marketplace — jen s poptávkou napřed
- **Nabídka:** „sovereign AI compute" — firmy submittují ONNX/WASM joby (inference, batch embeddings, fine-tune), platí fiat/stable; ZION drží 10 % protocol fee.
- **Podmínka:** nejdřív 1 poptávkový zákazník, pak workers onboarding. **Stavět nabídku před poptávkou = mrtvý kód.**
- **B2B lead zdroj:** stejný "EU sovereignty" argument jako B2B-3.

#### B2B-7 · Governance/DAO-as-a-service
- **Nabídka:** zion-dao stack (proposals, snapshot voting, timelock, guardian multisig, events) self-hosted + support retainer pro jiné chainy/DAO.
- **Priorita:** nižší — prodejně složitější, malý trh; držet jako attach k B2B-4/5.

### C. Střední/další horizont — podmíněné likviditou

#### B2B-8 · Treasury → likvidita (po ~27.–28. 11.)
- Po bloku 144 000: DAO proces + 3-of-3 admin unlock → seed pořádného wZION/USDT poolu (+ případně druhého pairu).
- **Efekt:** ZION nabývá tržní cenu → pool fees, NCL fees, marketplace list prices získají skutečnou hodnotu → body 4–7 fakturují v likvidním tokenu.
- **Kroky:** 1.B5 dry-run premine unlock na regtestu (výška 144k se blíží — deadline), DAO návrh na LP seed, komunikace bez "unlock" claimů (1.S3).

#### B2B-9 · OASIS artefakty / NFT marketplace
- Listings v wZION hotové, ale bez likvidity = vášeň. Aktivovat až po B2B-8.

#### B2B-10 · ZIS identity-as-a-service
- Možný add-on k B2B-4/5/6 (každý klient chce auth). Samostatně slabý prodej.

---

## 3. Doporučené pořadí

```
1. E-shop fiat (soft-launch + Stripe secrets) → první CZK/EUR
2. Aux-mining cash-out + QTC policy/funding  → cashflow + retence minerů
3. Hiran API paid (Stripe Pro/Team)          → MRR z inference
3b. Hiran Agent v zion CLI (+ archive)       → coding-agent ARPU (po 3)
4. Pool-as-a-service outreach                → B2B pipeline 1–3 měs.
5. NCL marketplace                           → jen na základě reálného leadu
6. Treasury → likvidita (po unlocku 144k)    → odemyká vše ostatní
```

## 4. Co nedělat

- **Nepočítat "ZION revenue"** jako cash — při TVL $38 je to číslo v Excelu.
- **Žádný OTC prodej ZION bez likvidity** — cena zkolabuje + důvěra.
- **NCL bez zákazníka** — demand first, workers second.
- **Neprodávat payout backlog** jako problém — je to dluh, ne feature; vyřešit před jakýmkoliv B2B outreach (mineři jsou zároveň budoucí NCL workers).
- **G9 posunutý** — enterprise klienti se zeptají na audit; odpověď: audit package ready na RC commit, scope v `EXTERNAL_AUDIT_SCOPE.md` v2.2.

## 5. Okamžité akční kroky (tento týden)

| # | Akce | Typ | Závisí na | Stav 28.10. |
|---|---|---|---|---|
| 1 | `5.B6` dokončit: E2E order test (transfer + Stripe), invoice download route, order-tracking, deploy MarketPlace | 🤖 | — | ✅ Stripe live; V2 parity pass 29.10. (pickup/digi/paid-email/reklamace). E-mail blok = vytvořit **`shop@zionterranova.com`** + SMTP/Resend (`MARKET_V2_PARITY.md`). Next 15/16 před wide launch |
| 1b | MarketPlace `next` major upgrade nebo per-CVE review + mitigace | 🤖→👤 | AUDIT-TRIAGE | ✅ review 28.10: `unoptimized:true`; Server Actions 0×. Zbývá next 15/16 = 👤 před veřejným launch |
| 2 | Payout backlog rozhodnutí: vyplatit z treasury-free zdrojů nebo politika + veřejný statement | 👤→✅ | 2.B7 | 🟢 ZION recovery live (`defdcd84a`). ✅ **QTC politika 29.10.** — `docs/3.2/QTC_PAYOUT_POLICY.md` (honest hold / hybrid D) + pool FAQ update. Funding treasury = 👤 |
| 3 | `PRL_PAYOUT_DRY_RUN=0` po dry-batch review + sweep do oyster | 👤🔀 | 2.B6 | 🔍 review hotový — 0 pending; flip až po PRL aktivitě |
| 4 | Hiran API MVP spec: `/v1/models` gateway + `X-API-Key` (ZIS) + Stripe price page | 🤖 | ZIS keys | ✅ free + **Pro/Team prices** (`price_1UViLH…` / `price_1UViLI…`) + dual webhooks shop/gateway; hiranBilling=true |
| 4b | Hiran Agent v `zion` CLI (B2B-3b) — Cursor/Claude/Devin-class coding agent | 🤖 | #4 paid | ✅ MVP + **ZIS login** (`zion hiran login`) + Stripe/MetaMask subscribe; kanon `HIRAN-CLI-AUTH.md`; public packaging později |
| 4c | Vast + Hiran Coding Agent — sjednocení `/vast-rigs/#ai` + fleet 2.B11 + CLI | 🤖 | #4b, 2.B11 enroll | ✅ F0–F3 + E2E smoke 29.10. na `58077390` (`code.run`→`read_file` SMOKE_OK); reálný vLLM až Docker image |
| 4d | Hiran Trinity fine-tune — ZION-komplexní persony | 🤖→👤 | korpus licence, vast GPU $ | 📝 Marketplace §FT + Coding plán §FT; pořadí Maitreya→Amitábha→Issobella; eval suite |
| 5 | One-pager "Pool-as-a-Service" (CS+EN) + seznam 10 cílových PoW coinů | 🤖 | — | ✅ + outreach balíček `docs/3.2/B2B_POOL_OUTREACH.md` (gate = QTC politika) |
| 6 | Regtest dry-run `build_admin_unlock_tx` 3-of-3 (1.B5) — před 144k | 🤖 | PREMINE_UNLOCK.md | ✅ PASS (158 s, reálná node cesta, DAO height gate drží) |

### Incident 28.10. ~07:15 — pool API wedge (nález při PRL review)
`/health` 200, ale `/metrics` + `/stats` visely >15 s na EDGE i přes EDGE2 tunnel — stejný `pool.lock()` wedge vzorec jako 26.10. Drain restart (runbook) clean: API zpět (metrics 0.13 s, stats 6 ms), stratum OK, bloky 1000/1000 confirmed. **Unconfirmed payout backlog mezitím narostl 931→1076** — wedge pravděpodobně blokoval confirmation sweep. Druhý výskyt pattern → root-cause fix pool.lock critical section zůstává otevřený (👤 priorita — retry loop, ne one-off).

### PRL payout review 28.10. (`scripts/prl-payout-review.sh` na EDGE)
- Env: `PRL_PAYOUT_ENABLED=1`, `PRL_PAYOUT_DRY_RUN=1`, sweeper = `zion-v31-multichain` (`prl_payout.rs`), oracle 120 s, `NATIVE_PAYOUT_COINS=prl`, `MIN_PAYOUT_NATIVE=prl:50000000`
- Pool queue `admin/external-payouts?chain=pearl`: **pending 0**
- Sweeper ledger `ext_payout_records` (warp_multichain.db): **0 pearl rows** — žádný dry-run batch nikdy neproběhl
- Journal 2 h: žádná sweeper aktivita (nema co dělat, dokud nepřistanou payouts)
- **Verdikt:** pipeline bezpečně izolovaná; `DRY_RUN=0` lze flippnout kdykoliv, ale nemá smysl bez PRL payoutů v queue — prerekvizita je aktivita PRL minerů + první dryrun rows k manuálnímu review. QTC sweeper zůstává disabled (918 deferred = samostatné 👤 rozhodnutí).

## 6. Metriky úspěchu

- **Fiat MRR** (Stripe e-shop + Hiran API): první nenulový měsíc = milník.
- **Payout backlog** = 0 unconfirmed/deferred (gauge už existuje: `zion_pool_payouts_unconfirmed*`).
- **B2B pipeline**: ≥1 odpověď na 10 outreachů (pool hosting / Hiran API).
- **Likvidita**: po unlocku TVL wZION/USDT ≥ $25k seed → pak teprve "ZION revenue" znamená něco.

---

*Souvisí: `docs/3.2/3.2.1-3.2.9_PLAN.md` (položky 2.B6/2.B7/5.B6/1.B5/1.S3/2.B11), `HIRAN-MARKETPLACE-PLAN.md`, `docs/3.2/ESHOP_WORKFLOW_PLAN.md`, `docs/3.2/B2B_SOFT_LAUNCH.md`, `docs/3.2/QTC_PAYOUT_POLICY.md`, `docs/3.2/B2B_POOL_OUTREACH.md`, `docs/3.2/B2B_HIRAN_SECRETS.md`, `docs/3.2/B2B_HIRAN_AGENT_CLI.md`, `docs/3.2/VAST_HIRAN_CODING_AGENT_PLAN.md`, `HIRAN-CLI-AUTH.md`, `VASTAI-MINING.md`, `docs/3.2/PREMINE_UNLOCK.md`, `docs/3.2/DAO.md`.*
