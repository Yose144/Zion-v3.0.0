# ZION Native Multichain Wallet + Pool — koncept

> **Verze:** 1.0 (draft)  
> **Datum:** 2026-07-27  
> **Status:** koncept / není implementační plán  
> **Scope:** navrženo pro **čistý `V31/` strom** — mimo `V3/`. Souvisí s L2 unifikací v [`MAINNET_ALPHA_L2_UNIFICATION.md`](MAINNET_ALPHA_L2_UNIFICATION.md).
> **Cíl:** zhodnotit, zda a jak by `zion` Wallet a ZION Pool mohly nativně podporovat všechny coiny z "Trinity engine", a uložit první koncept do kořene repa.

---

## 1. Shrnutí nápadu

Udělat z `zion` Wallet skutečně **multichain peněženku** pro všechny coiny, které dnes ZION miner/pool umí těžit, a z `zion-pool` udělat **nativní multichain pool** — tedy ne jen proxy, která přeposílá share do upstreamu (2miners, ZPool, ...), ale plnohodnotný pool, který:

1. sám validuje share pro každý coin pomocí nativních hasherů,
2. stahuje block template z rodičovské sítě,
3. submituje nalezené bloky přímo do dané sítě,
4. rozděluje odměny buď v nativním coinu, nebo ve **Dharma Credits** — jednotném účetním kreditu ekosystému.

Nápad je ambiciózní, ale **technicky možný** — v `V3/` a `AuXpow/` už existuje většina stavebních kamenů (stratum server, profit router, nativní hashe, PPLNS). Chybí především per-coin konektory na rodičovské full-node/RPC a block submitteři.

---

## 2. Co je v tomto kontextu "Trinity engine"

V tomto konceptu pod pojmem **Trinity engine** rozumíme trojici modulů, které dnes společně pokrývají multi-algo/multi-coin mining:

1. `V3/L1/cosmic-harmony` — Deeksha Chv3 pipeline, `ExternalCoin` / `CoinProfile`, profit router a stream weights.
2. `AuXpow/` + `V3/L1/native-ffi` — nativní a OpenCL/CUDA/Metal hashe pro desítky algoritmů.
3. `V3/L1/pool` + `V3/L1/miner` — stratum server, share forwarder, PPLNS, GPU dispatch.

Seznam coinů, které dnes `cosmic-harmony/src/profit_router.rs` eviduje, je ~30: DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR, VRSC, PRL, EPIC, ZANO, QUAI, BEAM, KLS, ZCL, QTC, VTC, IRON, NEXA, RTM, DNX, CKB, CFX, ZEC, PHX, KRX.

---

## 3. Současný stav (co už máme)

### Wallet
- `V3/cli/src/commands/wallet.rs` implementuje ZION-only peněženku.
- Ed25519 keypair, BIP39 podpora, AES-256-GCM + PBKDF2-SHA256 šifrování.
- UTXO coin selection, account-model fallback, batch payouts.
- `zion wallet send` umí posílat ZION přes `submitTransaction` / `submitAccountTransaction`.

### Pool
- `V3/L1/pool/src/bin/server.rs` běží jako TCP stratum server na Edge portu 8444.
- PPLNS engine v `V3/L1/pool/src/pplns.rs` dělí block reward 89/5/5/1 (miner / humanitarian / issobella / pool fee).
- Pool dnes pracuje v **B2b módu** (AuxPoW / pool-side multiplexing): stáhne externí job z upstream poolu (2miners, ...), pošle ho ZION mineru, a share zase forwarduje zpět do upstreamu.
- `AuXpow/src/multiplexer.rs` a `ShareForwarder` toto přeposílání řídí.

### Nativní hashe
- `AuXpow/src/external_hashers.rs` obsahuje pure-Rust + C FFI implementace: Blake3 (DCR/ALPH), kHeavyHash (KAS), Autolykos (ERG), KawPow (RVN), Ethash (ETC), VerusHash (VRSC), GhostRider (RTM), RandomX (XMR) a další.
- OpenCL/CUDA/Metal kernely jsou v `AuXpow/csrc/` a `V3/L1/native-ffi/csrc/`.

### Profit switching
- `V3/L1/cosmic-harmony/src/stream_profit.rs` počítá profit-based váhy pro Deeksha Chv3 proudy.
- `AuXpow/src/auxpow_scheduler.rs` dělá hysteresis + circuit breaker pro přepínání externích coinů.

---

## 4. Cílová architektura

### 4.1 Multichain Wallet (`zion wallet`)

Rozšířit CLI wallet o **multi-coin keyring**:

```
zion wallet new --coin BTC      # BIP84 secp256k1
zion wallet new --coin ETH      # secp256k1, EIP-55 address
zion wallet new --coin KAS      # secp256k1 / kHeavyHash address
zion wallet new --coin XMR      # Ed25519 + Monero address derivation
zion wallet new --coin ZION     # stávající Ed25519 zion1...
zion wallet balance --coin KAS --address <addr>
zion wallet send --coin KAS --to <addr> --amount <amt>
```

**Technické změny:**
- Jedno BIP39 seed pro všechny coiny (BIP44/SLIP44 cesta + coin-specific derivace).
- `WalletFile` formát rozšířit o `coin` a `derivation_path`.
- Pro každý coin mít malý adapter: address derivation, RPC/explorer URL, balance query, TX build + sign.
- Přidat `coins.toml` / `wallet.chains` konfiguraci s RPC endpointy (default public, overridable).

**Bezpečnost:**
- Stejné šifrování jako dnes (AES-256-GCM + PBKDF2, 210k iterací).
- Seed zůstává lokální; každý coin může mít svůj derived private key, který se zeroizuje po podepsání.

### 4.2 Native Multichain Pool (`zion-pool`)

Namísto `JobMultiplexer` připojeného k upstream poolu představit **per-coin worker** v poolu:

```
CoinWorker (jeden pro každý aktivní coin)
├── TemplateProvider   # RPC/full-node, získává block template
├── JobBuilder         # sestavuje stratum job pro daný coin
├── ShareValidator     # nativní hasher, ověří share
├── BlockSubmitter     # odesílá block do rodičovské sítě
├── PplnsEngine        # per-coin sliding window
└── PayoutWallet       # hot wallet pro výplaty v nativním coinu
```

**Pool by podporoval dva režimy pro každý coin:**

1. **Native** — pool sám stahuje template a submituje bloky (cíl tohoto konceptu).
2. **B2b fallback** — ponechat současný mód forwardování do upstreamu pro coiny, pro které nemáme ještě full-node konektor.

**Režim by se volil v konfiguraci:**

```bash
ZION_POOL_NATIVE_COINS="DCR,ALPH,VRSC,XMR"
ZION_POOL_B2B_COINS="KAS,ETC,RVN"
```

### 4.3 Dharma Credits jako unifikovaná odměna

Namísto aby každý miner dostával 10 různých coinů může pool nabídnout **payout v Dharma Credits**:

- Miner při připojení zvolí payout mode: `native` (dostane DCR, ALPH, ...) nebo `credits`.
- V `credits` módu pool počítá USD hodnotu vytěženého hashrate podle `profit_router.rs`, přičte k internímu účtu a vyplácí jednou denně/týdně v Dharma Credits.
- Dharma Credits mohou být:
  - interní účetní kredit v pool DB (rychlé),
  - on-chain token bridged přes WARP (`wZION` / future `DharmaCredit` na Base + ZION L1),
  - směnitelné za ZION ve ZionDexu.

**Poznámka k pojmenování:** V `docs/docs2.9/DHARMA_CREDITS.md` existuje starý 2.9 koncept `DharmaCredits` ERC20. Tento koncept navrhuje **nový význam**: unifikovaný multi-asset účetní kredit v rámci ZION ekosystému, nikoliv návrat k legacy ERC20.

---

## 5. Fázový roadmap

| Fáze | Název | Co se dělá | Přibližná délka |
|------|-------|------------|-----------------|
| 0 | Inventura | Pro každý coin ověřit: block template zdroj (full-node/RPC), submit formát, consensus pravidla, light-client možnosti. | 1–2 týdny |
| 1 | Multichain wallet scaffold | Keyring, BIP44 derivace, address generace pro 5–10 prvních coinů, balance query přes public RPC. | 2–4 týdny |
| 2 | Pool native share validation | Odstranit/upřednostnit upstream forwarding: share se validuje lokálně pomocí `external_hashers.rs`. Počáteční coiny: DCR, ALPH, VRSC, RTM, XMR. | 3–5 týdnů |
| 3 | Block template + submit (PoC) | Pro DCR, ALPH, VRSC, XMR stáhnout template přes daemon RPC a submitovat block. Pool se stává nativním pro tyto coiny. | 4–6 týdnů |
| 4 | DAG/light-client coiny | KAS, ETC, RVN, EPIC, ZANO — vyžadují DAG nebo light-client. | 6–10 týdnů |
| 5 | Dharma Credits integrace | Vnitřní účet, konverze, výplaty, bridgovaný token. | 4–6 týdnů |
| 6 | Profit switching & UI | Nativní přepínání mezi nativními coiny, dashboard, admin API. | 4–6 týdnů |

Celkově jde o **odhadem 4–6 měsíců** plného vývoje pro prvních 5–10 coinů a základní Dharma Credits vrstvu.

---

## 6. Stavební kameny, které už máme

| Komponenta | Soubor | K čemu poslouží |
|------------|--------|-----------------|
| ExternalCoin / CoinProfile | `V3/L1/cosmic-harmony/src/profit_router.rs` | Seznam coinů, algoritmů, DAG velikostí. |
| Stream profit / stream weights | `V3/L1/cosmic-harmony/src/stream_profit.rs` | Výpočet profitability mezi proudy. |
| Native hashers | `AuXpow/src/external_hashers.rs` | Validace share lokálně. |
| OpenCL/CUDA/Metal kernely | `AuXpow/csrc/` | GPU hashe pro miner. |
| Stratum server | `V3/L1/pool/src/bin/server.rs` | TCP stratum framework pro ZION, rozšiřitelný na per-coin dialecty. |
| PPLNS engine | `V3/L1/pool/src/pplns.rs` | Rozdělování odměn; rozšířit o sloupec `coin`. |
| Share store | `V3/L1/pool/src/store.rs` | SQLite persistentní stav; rozšířit o `coin`. |
| Wallet CLI | `V3/cli/src/commands/wallet.rs` | Základ pro multi-coin CLI. |
| Pool CLI | `V3/cli/src/commands/pool.rs` | Stats, miners, earnings — doplnit per-coin. |
| Config | `V3/cli/src/config.rs` | Přidat `coins` / `multichain` sekci. |

---

## 7. Dopad na Edge topologii

Podle `StatusV3.md` běží na Edge:
- `zion-pool` na `0.0.0.0:8444` (Stratum) a `127.0.0.1:8455` (HTTP metrics).
- AuxPoW B2b mód je aktivní přes proměnné v `edge-deploy/config/edge-environment.sh` (`ZION_POOL_AUXPOW_ENABLED`, `ZION_POOL_AUXPOW_COIN`, `ZION_POOL_AUXPOW_WALLET_*`).

Pro nativní multichain pool by Edge potřeboval:
1. **Full-node / RPC přístup** pro každý nativní coin (např. `decred/dcrd`, `alephium/full-node`, `monerod`, `verusd`, ...).
2. **Hot wallet** pro každý coin na serveru — zásadní bezpečnostní riziko, nutné HSM/konzultace.
3. Zvýšený disk/RAM/IO — full-node běží lokálně nebo přes spolehlivý paid RPC.
4. Nové firewall/UFW pravidla pro RPC/peery jednotlivých sítí.
5. Zálohování wallet seedů — rozšířit `backup-edge.sh` o per-coin wallet files.

**Doporučení:** nespouštět nativní pool přímo na Edge produkci dokud není Phase 3 ověřena na stagingu. Ponechat současný B2b mód jako default a nativní režim zapínat feature flagem `ZION_POOL_NATIVE_MULTICHAIN=1`.

---

## 8. Rizika a otevřené otázky

1. **Full-node provoz** — 30 full-node není reálné na jednom VPS. Nutné light-clients, RPC providers, nebo selekce coinů.
2. **Block submit formáty** — každý coin má jiný `mining.submit` / `eth_submitWork` / custom block submit. Vyžaduje per-coin parser.
3. **Payout bezpečnost** — hot wallet pro 30 coinů na serveru je velký attack surface. Nutné multisig / HSM / custodial řešení.
4. **Regulace / DPH / daně** — multi-coin výplaty zvyšují compliance nároky.
5. **Dharma Credits vs ZION** — musí být jasně definováno, zda jde o nový token, interní kredit, nebo obal nad ZION/wZION. Vyhnout se záměně se starým 2.9 ERC20.
6. **Consensus ZION se nemění** — nativní mining ostatních coinů neimplikuje merge-mining do ZION bloku. Pro True AuxPoW (jeden hash platí pro dvě sítě) existuje samostatný koncept v `AuXpow/REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md`.
7. **ASIC / pool difficulty** — některé coiny (KAS, XMR) mají tak vysokou síťovou difficulty, že CPU pool share jsou prakticky neakceptovatelné. Pool potřebuje vardiff a realistic targety.

---

## 9. Závěr: jde to?

**Ano, jde to.** ZION má většinu potřebné infrastruktury:
- nativní hashe pro desítky algoritmů,
- stratum framework,
- PPLNS,
- profit router,
- pool/miiner pipeline.

**Největší práce** je postavit **per-coin block template provider + block submitter** a zajistit bezpečný payout. Pro první 3–5 coinů (DCR, ALPH, VRSC, XMR, RTM) je to reálné v řádech týdnů/měsíců. Plná podpora 30+ coinů a Dharma Credits vrstva je projekt na půl roku až rok.

**Doporučení:** začít jako `V31/L1/pool` feature (`native_multichain`) — čistý strom, žádné zásahy do produkčního `V3/` poolu, dokud nebude E2E ověřeno. Wallet a Dharma Credits payout by se měly integrovat s `V31/L2/multichain` podle [`MAINNET_ALPHA_L2_UNIFICATION.md`](MAINNET_ALPHA_L2_UNIFICATION.md).

---

## 10. Odkazy na existující kód

- `V3/L1/cosmic-harmony/src/profit_router.rs` — seznam externích coinů a metadat.
- `V3/L1/cosmic-harmony/src/stream_profit.rs` — výpočet profit vah.
- `AuXpow/REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md` — stávající B2b vs True AuxPoW návrh.
- `V3/L1/pool/src/bin/server.rs` — stratum server a AuxPoW integrace.
- `V3/L1/pool/src/pplns.rs` — PPLNS engine.
- `V3/cli/src/commands/wallet.rs` — CLI wallet.
- `V3/cli/src/config.rs` — konfigurační schéma.
- `StatusV3.md` — aktuální Edge topologie a coin E2E status.
- `docs/3.0.6/V3.1_MIGRATION_PLAN.md` — kam by tento kód patřil ve `V31/`.
- [`MAINNET_ALPHA_L2_UNIFICATION.md`](MAINNET_ALPHA_L2_UNIFICATION.md) — navrhované sjednocení wallet/bridge/swap/dex do jednoho `V31/L2/multichain` crate.

---

## Příloha A — Fokus na partnerství: BTC, ETC, DCR, XMR, ZANO

Z uživatelského návrhu vybíráme pět nejrelevantnějších coinů pro první fázi. Každý má jinou roli v ekosystému a jinou technickou připravenost.

| Coin | Role v ZION partnerství | Algoritmus | ZION readiness | Fokus (wallet / pool / obojí) | Priorita |
|------|-------------------------|------------|----------------|--------------------------------|----------|
| **BTC** | Store of value, bridge collateral, payout rail (2miners vyplácí v BTC) | SHA-256d | Pool mining **NENÍ** smysluplné (ASIC dominance). Wallet a WARP bridge už existují (`V3/L3/warp/src/btc_signer.rs`, `bitcoin.rs`). | **Wallet + bridge** | Vysoká (ekosystémová, ne mining) |
| **ETC** | EVM kompatibilita, DeFi/bridge partner, GPU-friendly | Ethash | CUDA kernel funguje (`ethash_kernel.cu`), CPU je DAG-less. Live share zatím pending. `V3/docs/AUXPOW_ALGORITHM_VERIFICATION_REPORT.md` §6.3. | **Pool (GPU) + wallet** | Vysoká |
| **DCR** | DAO governance kultura — přirozený partner pro ZION DAO, Blake3 = sdílená hash funkce | Blake3 | Pure-Rust hasher je připravený (`AuXpow/src/external_hashers.rs`), není live ověřen. Stratum v1 formát známý (`V3/docs/DCR.md`). | **Pool + wallet** | Vysoká |
| **XMR** | Privacy/cypherpunk ethos, CPU mining = democratizace | RandomX | Real `native-randomx` existuje (`V3/L1/native-ffi/csrc/randomx/`). Live pool E2E pending; v současnosti problém se stale job ID (`StatusV3.md`). | **Pool (CPU) + wallet** | Vysoká |
| **ZANO** | Privacy coin, GPU ProgPoWZ, potenciální komunitní partner | ProgPoWZ | OpenCL/CUDA kernel funguje, live share přijatý na HeroMiners (`docs/3.0.5/ZANO_PROGPOW_FIX_REPORT.md`). CPU fallback je placeholder. | **Pool (GPU) + wallet** | Vysoká |

### A.1 Proč zrovna tyto coiny?

1. **BTC** — je to nejsilnější značka pro partnerství, i když se netěží přímo. ZION může nabídnout BTC wallet, bridge a BTC-denominated payout rail pro ostatní coiny.
2. **ETC** — EVM kompatibilita je klíčová pro DeFi partnerství. ZION už má L2 bridge na Base; ETC by mohl být další EVM řetězec ve WARP.
3. **DCR** — Decred má on-chain governance a Treasury — přesně oblast, kde ZION DAO chce být aktivní. Blake3 je i interní hash ZION/Deeksha, takže sdílení hashpower je technicky nejjednodušší.
4. **XMR** — CPU-friendly mining přitáhne desktop uživatele, což je cílovka pro `zion` CLI. Privacy alignuje s Dharma hodnotami (svoboda, transparentnost na požádání).
5. **ZANO** — ProgPoWZ je GPU coin s aktivní komunitou. Po fixu z 2026-07-25 už ZION pool umí submitovat ZANO share na HeroMiners; nativní pool je nejbližší.

### A.2 Technická readiness detail

| Coin | Wallet: seed → address | Wallet: send | Pool: template provider | Pool: share validation | Pool: block submit | Pool: payout |
|------|-------------------------|--------------|------------------------|-----------------------|-------------------|--------------|
| BTC | Ano (BIP84 P2WPKH) | Ano (`btc_signer.rs`) | N/A (nebo NiceHash hashpower market) | N/A pro direct mining | N/A pro direct mining | BTC payout OK |
| ETC | Ano (secp256k1, EIP-55) | Ano (EVM signer existuje) | `eth_getWork` z full-node | CUDA `ethash_kernel` + DAG | `eth_submitWork` | Native ETC nebo BTC |
| DCR | Ano (secp256k1, DCR address) | Ano (bude potřeba DCR tx builder) | `getwork` / Stratum z `dcrd` | `blake3::hash` | `getwork` / `submitblock` | Native DCR nebo BTC |
| XMR | Ano (Ed25519 + Monero address) | Ne — bude potřeba Monero tx builder | `monerod` RPC / Stratum | `native-randomx` | `submitblock` / pool submit | Native XMR nebo BTC |
| ZANO | Ano (secp256k1, ZANO address) | Ne — bude potřeba ZANO tx builder | HeroMiners / vlastní zano node | `progpow_zano` OpenCL/CUDA | ZANO stratum / node RPC | Native ZANO nebo BTC |

### A.3 Doporučená fáze 0 PoC

1. **Wallet PoC**: BTC + ETC + DCR address generace z jednoho BIP39 seedu v `zion wallet`.
2. **Pool PoC**: DCR native share validation (`blake3`) a submit jednoho testovacího bloku do `dcrd` testnet/regtest.
3. **Pool PoC**: ZANO externí share acceptance potvrzení (už funguje na HeroMiners) → pak přechod na vlastní zano node template.
4. **Pool PoC**: XMR `monerod` regtest connect a `submitblock` s `native-randomx`.
5. **ETC** jako první DAG coin: vyřešit DAG cache a `eth_submitWork` proti lokálnímu ETC node.

### A.4 Co s coiny mimo shortlist?

Původní seznam ~30 coinů zůstává v backlogu. Doporučuji následující prioritu:

- **Tier 1 (hned po shortlistu):** ALPH, KAS, VRSC, RTM — už jsou v profit routeru, mají reálné hashe, stratum protokoly jsou známé.
- **Tier 2:** RVN, FLUX, BEAM, ERG, EVR, MEWC, CLORE, QUAI — vyžadují DAG/light-cache nebo GPU-only cestu.
- **Tier 3:** PRL, KLS, ZCL, QTC, VTC, IRON, NEXA, DNX, CKB, CFX, ZEC, PHX, KRX — speciální algoritmy, nízká priorita nebo vyžadují zásadní nový kód.

---

*Koncept připraven k diskuzi. Před jakoukoli implementací by měly být vyřešeny otázky v kapitole 8 a potvrzena shortlist pro PoC (BTC/ETC/DCR/XMR/ZANO nebo její podmnožina).*
