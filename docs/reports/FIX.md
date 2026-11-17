# 🔧 FIX.md — Explorer & Emission Critical Fixes

> **Vytvořeno:** 10. února 2026  
> **Priorita:** P0 — Explorer zobrazuje kompletně špatná data  
> **Rozsah:** Website frontend (Next.js), RPC klient, pool fee distribuce  
> **Odhadovaný čas:** 4–6 hodin  

---

## 📋 Přehled problémů

Explorer Emission Monitor ukazuje:
- ❌ Block reward = **50 ZION** (správně: **5,400.067 ZION**)
- ❌ Mined = **0 ZION** (správně: `height × 5,400.067`)
- ❌ Daily Emission = **72,000 ZION** (správně: **7,776,096 ZION**)
- ❌ Mining Duration = **~5,476 years** (správně: **~45 let**)
- ❌ Total Fees = **0** (nikdy se neplní z RPC)
- ❌ Humanitarian Tithe = **0** (nikdy se neplní z RPC)
- ❌ Block reward v exploreru = **5.4000** (dělení `1e9` místo `1e6`)

**Root Cause:** Kód webu pochází z Monero-style šablony. ZION má:
- `1 ZION = 1,000,000 atomic` (6 decimals) — NE `1,000,000,000` (9 decimals jako Monero)
- Block reward = `5,400.067 ZION` — NE `50 ZION` (starý Bitcoin-style model z v2.9.5OLD)

---

## 🐛 Detailní analýza bugů

### BUG 1 — Špatný block reward "50" (P0) ⭐ KRITICKÝ

**Soubory:**
- `website-v2.9/src/app/api/blockchain/emission/route.ts` řádky 30–37
- `website-v2.9/src/app/api/blockchain/stats/route.ts` řádek 29

**Problém:**
```typescript
// emission/route.ts — řádek 30
const baseReward = 50;                         // ❌ ŠPATNĚ!

// stats/route.ts — řádek 29
const baseRewardPerBlock = 50;                 // ❌ ŠPATNĚ!
```

**Správně:**
```typescript
const baseReward = 5_400.067;                  // ✅ ZION konstantní emise
```

**Dopad:** Emission Monitor ukazuje 108× menší hodnoty. Daily Emission 72K místo 7.78M. Mining Duration 5,476 let místo 45.

**Odkaz na Rust:**
```rust
// core/src/blockchain/reward.rs řádek 57
pub const BLOCK_REWARD_ATOMIC: u64 = 5_400_067_000;   // = 5,400.067 ZION
```

---

### BUG 2 — Dělení `1e9` místo `1e6` (P0) ⭐ ROOT CAUSE "5.4000"

**Soubory:**
- `website-v2.9/src/app/api/blockchain/stats/route.ts` řádek 113
- `website-v2.9/src/app/api/blockchain/block/route.ts` řádky 62, 68, 81, 86
- `website-v2.9/src/lib/zion-rpc.ts` řádky 577, 578, 651, 655

**Problém:**
```typescript
// stats/route.ts řádek 113  
reward: lastBlock.reward / 1e9,     // ❌ 5,400,067,000 / 1e9 = 5.4000

// block/route.ts řádek 62
amount: block.reward / 1e9,         // ❌ Stejný problém
```

**Správně:**
```typescript
reward: lastBlock.reward / 1e6,     // ✅ 5,400,067,000 / 1e6 = 5,400.067
```

**Vysvětlení:**
- Monero: `1 XMR = 1,000,000,000,000 piconero` → dělení `1e12`
- ZION: `1 ZION = 1,000,000 atomic` → dělení `1e6`
- Kód používá `1e9` (Monero nano, nesprávné) → výsledek 1,000× menší

**Všechna místa kde se dělí `1e9` (musí být `1e6`):**

| Soubor | Řádek | Kontext |
|--------|-------|---------|
| `stats/route.ts` | L34 | `realEmission = emission.emission_amount / 1e9` |
| `stats/route.ts` | L113 | `reward: lastBlock.reward / 1e9` |
| `block/route.ts` | L62 | `amount: block.reward / 1e9 : baseReward / 1e9` |
| `block/route.ts` | L68 | `amount: out.amount / 1e9` |
| `block/route.ts` | L81 | `fee: tx.fee / 1e9` |
| `block/route.ts` | L82 | `amount: totalOut / 1e9` |
| `block/route.ts` | L86 | `amount: input.key.amount / 1e9` |
| `block/route.ts` | L90 | `amount: out.amount / 1e9` |
| `emission/route.ts` | L24 | `emission.total = emissionData.emission_amount / 1e9` |
| `emission/route.ts` | L25 | `emission.fees = emissionData.fee_amount / 1e9` |
| `zion-rpc.ts` | L577 | `emission_amount: (res?.circulating ...) * 1e9` |
| `zion-rpc.ts` | L578 | `fee_amount: (res?.burned ...) * 1e9` |
| `zion-rpc.ts` | L651 | `total: emissionData.emission_amount / 1e9` |
| `zion-rpc.ts` | L652 | `fee: emissionData.fee_amount / 1e9` |

---

### BUG 3 — `getCoinbaseTxSum()` čte neexistující klíče z RPC (P0)

**Soubor:** `website-v2.9/src/lib/zion-rpc.ts` řádky 573–582

**Problém:**
```typescript
async getCoinbaseTxSum(height: number, count: number): Promise<ZionEmission> {
    const res = await this.rpcCall<any>('getSupplyInfo');
    return {
      emission_amount: (res?.circulating || res?.mined || 0) * 1e9,   // ❌
      fee_amount: (res?.burned || 0) * 1e9,                            // ❌
    };
}
```

RPC `getSupplyInfo` vrací:
```json
{
  "total_supply_zion": 144000000000,
  "mined_so_far_zion": 8640107,          // ← toto pole
  "mined_so_far_atomic": 8640107000000,  // ← nebo toto
  "circulating_supply_zion": ...,        // NE "circulating"!
  "burned_zion": ...,                    // NE "burned"!
  "block_reward_zion": 5400.067,
  "height": 1600
}
```

Kód čte `res.circulating` a `res.mined` → **neexistují** → výsledek je `0`.

**Správně:**
```typescript
async getCoinbaseTxSum(height: number, count: number): Promise<ZionEmission> {
    const res = await this.rpcCall<any>('getSupplyInfo');
    return {
      emission_amount: res?.mined_so_far_atomic || (res?.mined_so_far_zion || 0) * 1e6,
      fee_amount: res?.burned_atomic || (res?.burned_zion || 0) * 1e6,
      status: 'OK',
    };
}
```

---

### BUG 4 — Emission fallback "50" (P1)

**Soubor:** `website-v2.9/src/app/api/blockchain/emission/route.ts` řádek 28

**Problém:**
```typescript
emission.total = height * 50;   // ❌ Fallback když RPC selže
```

**Správně:**
```typescript
emission.total = height * 5_400.067;   // ✅ ZION block reward
```

---

### BUG 5 — Emission komentář v hlavičce souboru (P2)

**Soubor:** `website-v2.9/src/app/api/blockchain/emission/route.ts` řádek 4

**Problém:**
```typescript
* ZION Economics: 50 ZION base/block + consciousness bonus, no halving, 144B max supply.
```

**Správně:**
```typescript
* ZION Economics: 5,400.067 ZION/block, constant emission, no halving, 144B max supply.
```

---

### BUG 6 — Pool fee distribuce nezobrazena v exploreru (P1)

**Problém:** Explorer nezobrazuje jak se coinbase reward dělí na 3 části.

**Rust konstanty (správné):**
```rust
// core/src/blockchain/reward.rs
pub const TITHE_PERCENT: u64 = 10;        // 10% humanitarian
pub const POOL_FEE_PERCENT: u64 = 1;      // 1% pool
pub const MINER_SHARE_PERCENT: u64 = 89;  // 89% miner
```

**Pool implementace (správné):**
```rust
// pool/src/shares/processor.rs řádek 182
let miner_share = (coinbase_reward as f64 * 0.89) as u64;  // ✅
```

**Co chybí na webu:**
- Emission API nevrací info o 89/10/1 split
- EmissionMonitor komponenta ukazuje "Humanitarian Tithe: 10% of all rewards" ale hodnota je 0
- Explorer nerozlišuje miner reward vs tithe vs pool fee ve výpisu transakcí

**Řešení:** Přidat do emission API a stats API pole:
```typescript
reward_distribution: {
  miner: 5400.067 * 0.89,        // = 4,806.06 ZION
  humanitarian_tithe: 5400.067 * 0.10,  // = 540.01 ZION
  pool_fee: 5400.067 * 0.01,     // = 54.00 ZION
}
```

---

### BUG 7 — `get_info` RPC vrací příliš málo dat (P1)

**Soubor:** `core/src/jsonrpc/mod.rs` řádky 460–475

**Problém:** `get_info` vrací pouze `{status, height, difficulty, tip}`. Website očekává mnoho dalších polí (viz `ZionNetworkInfo` interface):
- `target` (block time) → chybí → fallback `60`
- `tx_count` → chybí → `0`
- `tx_pool_size` → chybí → `0`
- `incoming_connections_count` → chybí → `0`
- `outgoing_connections_count` → chybí → `0`
- `version` → chybí → `''`
- `start_time` → chybí → `0`
- `database_size` → chybí → `0`

**Řešení:** Rozšířit `get_info` v Rust core o všechna pole, nebo vytvořit adaptér na webu.

---

### BUG 8 — `getLastBlockHeader` neexistuje v RPC (P1)

**Problém:** Website `getLastBlockHeader()` v `zion-rpc.ts` (řádek ~370) volá:
```typescript
async getLastBlockHeader(): Promise<ZionBlockHeader> {
    const info = await this.getInfo();
    return this.getBlockHeaderByHeight(info.height > 0 ? info.height - 1 : 0);
}
```
Což funguje, ale `getBlockHeaderByHeight` volá REST `/api/block/height/:height` a pak ručně parsuje — nekonzistentní s JSON-RPC.

---

## 📊 Shrnutí oprav podle priority

| # | Bug | Priorita | Soubory | Složitost |
|---|-----|----------|---------|-----------|
| 1 | Block reward `50` → `5400.067` | 🔴 P0 | emission/route.ts, stats/route.ts | Easy |
| 2 | Dělení `1e9` → `1e6` (14 míst) | 🔴 P0 | stats, block, emission routes + zion-rpc.ts | Easy ale 14 míst |
| 3 | `getCoinbaseTxSum()` špatné klíče | 🔴 P0 | zion-rpc.ts | Easy |
| 4 | Emission fallback `50` | 🟡 P1 | emission/route.ts | Easy |
| 5 | Komentář "50 ZION" | 🟢 P2 | emission/route.ts | Trivial |
| 6 | Fee distribuce v exploreru | 🟡 P1 | emission/route.ts + EmissionMonitor.tsx | Medium |
| 7 | `get_info` nevrací dostatek dat | 🟡 P1 | core/src/jsonrpc/mod.rs | Medium |
| 8 | `getLastBlockHeader` nekonzistentní | 🟢 P2 | zion-rpc.ts | Low |

---

## 🔧 Plán oprav (pořadí)

### Krok 1 — Globální konstanta `ATOMIC_DIVISOR` (5 min)

Vytvořit sdílenou konstantu aby se už nikdy neopakoval problém:

```typescript
// website-v2.9/src/lib/constants.ts (NOVÝ SOUBOR)
export const ATOMIC_UNITS_PER_ZION = 1_000_000;   // 1e6, NE 1e9!
export const BLOCK_REWARD_ZION = 5_400.067;
export const BLOCK_REWARD_ATOMIC = 5_400_067_000;
export const TOTAL_SUPPLY_ZION = 144_000_000_000;
export const MINING_SUPPLY_ZION = 127_220_000_000;
export const GENESIS_PREMINE_ZION = 16_780_000_000;
export const BLOCKS_PER_DAY = 1_440;
export const MINING_YEARS = 45;
export const TOTAL_MINING_BLOCKS = 23_652_000;
export const MINER_SHARE_PCT = 89;
export const HUMANITARIAN_TITHE_PCT = 10;
export const POOL_FEE_PCT = 1;
```

### Krok 2 — Fix `getCoinbaseTxSum()` v zion-rpc.ts (10 min)

Opravit klíče a jednotky tak, aby `emission_amount` vracelo **atomic units** (konzistentní s tím jak to volající kód dělí):

```typescript
async getCoinbaseTxSum(height: number, count: number): Promise<ZionEmission> {
    const res = await this.rpcCall<any>('getSupplyInfo');
    return {
      emission_amount: res?.mined_so_far_atomic || (res?.mined_so_far_zion || 0) * ATOMIC_UNITS_PER_ZION,
      fee_amount: res?.burned_atomic || (res?.burned_zion || 0) * ATOMIC_UNITS_PER_ZION,
      status: 'OK',
    };
}
```

### Krok 3 — Fix `1e9` → `ATOMIC_UNITS_PER_ZION` ve všech 14 místech (20 min)

Nahradit `/ 1e9` za `/ ATOMIC_UNITS_PER_ZION` (= `/ 1e6`) ve všech API routes a klientu.

### Krok 4 — Fix block reward `50` → `BLOCK_REWARD_ZION` (5 min)

Nahradit hardcoded `50` za importovanou konstantu.

### Krok 5 — Emission API rozšíření o fee distribuce (15 min)

Přidat `reward_distribution` do emission response.

### Krok 6 — Rozšířit `get_info` RPC v Rustu (30 min)

Přidat chybějící pole do JSON-RPC response.

### Krok 7 — Rebuild & Deploy web (15 min)

Docker rebuild na Helsinki, ověření v prohlížeči.

---

## ✅ Verifikace po opravě

Po implementaci ověřit:

```
Block #1600:
  Reward: 5,400.067 ZION (ne 5.4000, ne 50)
  
Emission Monitor:
  Mined: ~8.64M / 144.00B ZION (ne 0)
  Emission: 0.006000% (ne 0.000000%)
  Daily Emission: 7,776,096.48 ZION (ne 72,000)
  Base reward: 5,400.067 ZION × 1,440 blocks (ne 50 × 1,440)
  Mining Duration: ~45 years (ne ~5,476)
  Humanitarian Tithe: ~864K ZION (ne 0)

Stats API:
  circulating_supply: ~8,640,107 ZION (ne 80,000)
  emission_pct: ~0.006% (ne 0.000055%)

Reward Distribution:
  Miner (89%): 4,806.06 ZION/block
  Humanitarian (10%): 540.01 ZION/block
  Pool Fee (1%): 54.00 ZION/block
```

---

## 📁 Dotčené soubory

```
NOVÉ:
  website-v2.9/src/lib/constants.ts            — sdílené ZION konstanty

OPRAVIT (web):
  website-v2.9/src/app/api/blockchain/emission/route.ts   — block reward + 1e6
  website-v2.9/src/app/api/blockchain/stats/route.ts      — block reward + 1e6
  website-v2.9/src/app/api/blockchain/block/route.ts      — 1e6 (6 míst)
  website-v2.9/src/lib/zion-rpc.ts                        — getCoinbaseTxSum + klíče + 1e6

OPRAVIT (Rust — volitelně):
  core/src/jsonrpc/mod.rs                      — rozšířit get_info response

BEZ ZMĚN (správné v Rustu):
  core/src/blockchain/reward.rs                — ✅ BLOCK_REWARD_ATOMIC = 5_400_067_000
  pool/src/shares/processor.rs                 — ✅ miner_share = 0.89
  pool/src/pplns/calculator.rs                 — ✅ PPLNS kalkulace
```

---

## ⚠️ Poznámky

1. **Consciousness bonus** v Emission Monitor je placeholder (offchain L4, ještě neimplementováno). Ponechat jako informativní ale označit "(coming in L4)".

2. **Humanitarian Tithe** — pool dělí reward na 89/10/1 v `processor.rs`, ale na L1 je celý coinbase reward jedním UTXO. Tithe se děje na pool úrovni, ne na úrovni blockchainu. Explorer by měl zobrazovat "Pool-level distribution" ne "L1 protocol enforcement".

3. **Total Fees = 0** je technicky správné pokud zatím nejsou žádné user TX (jen coinbase). Fee burning nastane až budou normální transakce.

4. **Tenhle fix je mimo hlavní roadmapu** — neblokuje 72h stability run ani Fázi 2, ale je kritický pro důvěryhodnost exploreru.

---

*Vytvořeno: 10. února 2026 ~03:15 CET*  
*Status: ⬜ Ready for implementation on 11. února 2026*
