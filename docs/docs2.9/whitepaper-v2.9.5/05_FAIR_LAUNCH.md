# 🚀 Kapitola 5: Fair Launch & Distribuce

> *"Žádné ICO. Žádné VC. Žádné presale. Jen těžba."*

---

## 5.1 Proč Fair Launch?

### Rozhodnutí z ledna 2026

Dne **15. ledna 2026** jsme zrušili plánovaný presale a přešli na model **čistého Fair Launch**. Důvody:

| Důvod | Popis |
|-------|-------|
| **MiCA regulace** | EU Markets in Crypto-Assets nařízení klasifikuje presale tokeny jako cenné papíry |
| **AML compliance** | KYC/AML požadavky by vyžadovaly centralizovanou identifikaci kupujících |
| **Etika projektu** | ZION má být o svobodě, ne o regulovaných finančních produktech |
| **Komunita** | Fair Launch zajišťuje rovné podmínky pro všechny |

### Co to znamená

```
PRESALE MODEL (zrušen):
┌────────────────────────────────────────┐
│ 1. Investors buy tokens at discount    │
│ 2. Team holds significant allocation   │
│ 3. Retail buys at higher price         │
│ 4. Insiders dump on retail             │
└────────────────────────────────────────┘
          ❌ NEPOUŽÍVÁME

FAIR LAUNCH MODEL (aktivní):
┌────────────────────────────────────────┐
│ 1. Mining starts - everyone equal      │
│ 2. No pre-sale, no VC, no insiders     │
│ 3. First miner = first tokens          │
│ 4. Price discovery through mining      │
└────────────────────────────────────────┘
          ✅ ZION MODEL
```

---

## 5.2 Timeline

### Oficiální milníky

| Datum | Událost | Status |
|-------|---------|--------|
| **Q4 2024** | Vývoj Rust native stack | ✅ Done |
| **Q1 2025** | TestNet alpha (interní) | ✅ Done |
| **Q2 2025** | TestNet beta (veřejný) | ✅ Done |
| **31.12.2025** | TestNet v2.9.5 launch | ✅ Live |
| **Q1-Q3 2026** | TestNet stabilizace, audity | ⏳ In Progress |
| **odložen (TBD)** | **MainNet Genesis** | 📅 Plánováno |

### Genesis Block

```
ZION MainNet Genesis Block
═══════════════════════════════════════════════════════════════
Timestamp: postponed (TBD) UTC
Block #0: Genesis

Coinbase Message:
"Where Technology Meets Spirit - ZION TerraNova Genesis 2026"

Genesis Allocation: 16,780,000,000 ZION
═══════════════════════════════════════════════════════════════
```

---

## 5.3 Jak získat ZION

### Jediná cesta: Těžba

Po MainNet launchi existuje **pouze jeden způsob** jak získat nové ZION tokeny:

```
┌─────────────────────────────────────────────────────────────┐
│                    ZÍSKÁNÍ ZION                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ TĚŽBA (Mining)                                          │
│     └── CPU mining (Cosmic Harmony algoritmus)              │
│     └── Připojení k poolu: pool.zionterranova.com:3333     │
│     └── Solo mining (vlastní node)                          │
│                                                             │
│  ✅ OBCHOD (po listingu)                                    │
│     └── DEX (decentralizované burzy)                        │
│     └── P2P obchody                                         │
│     └── OTC deals                                           │
│                                                             │
│  ❌ PRESALE - NEEXISTUJE                                    │
│  ❌ ICO - NEEXISTUJE                                        │
│  ❌ AIRDROP - NEEXISTUJE                                    │
│  ❌ VC ALLOCATION - NEEXISTUJE                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Mining Quick Start

```bash
# 1. Stáhni ZION miner
git clone https://github.com/Yose144/Zion-2.9
cd Zion-2.9/2.9.5

# 2. Build native miner
cargo build --release -p zion-miner

# 3. Generuj wallet
./target/release/zion-wallet generate

# 4. Spusť mining
./target/release/zion-miner \
  --pool stratum+tcp://pool.zionterranova.com:3333 \
  --wallet ZION_YOUR_ADDRESS \
  --threads 4
```

---

## 5.4 Genesis Distribuce (16.78B)

### Alokace v genesis bloku

Genesis block obsahuje **16.78B ZION** (11.65% total supply) distribuovaných takto:

```
Genesis Block Distribution (16.78B ZION):
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ OASIS + Golden Egg: 4,950,000,000 ZION (29.5%)          │ │
│ │ └── OASIS odměny + výherní ceny (sloty 1–3)             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ L5 Free World Projects: 3,300,000,000 ZION (19.7%)      │ │
│ │ └── 6 komunitních projektů + rezerva (sloty 4–5)        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ L6 Issobella: 2,500,000,000 ZION (14.9%)                │ │
│ │ └── Orbital Station & Quantum Research Fund (slot 6)    │ │
│ │ └── Time-lock: blok 144 000 (~100 dní)                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ DAO Treasury: 1,500,000,000 ZION (8.9%)                 │ │
│ │ └── Granty 1B (slot 7) + Bootstrap 0.5B (slot 8)        │ │
│ │ └── Time-lock: blok 144 000 (~100 dní)                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Infrastructure + Genesis: 2,590,000,000 ZION (15.4%)    │ │
│ │ └── Core dev 1B + P2P seed 1B + Genesis 0.59B (9–11)    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Humanitarian Fund: 1,440,000,000 ZION (8.6%)            │ │
│ │ └── Children Future Fund — Humanitarian DAO (slot 12)   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Bridge Seed + Vault: 500,000,000 ZION (3.0%)            │ │
│ │ └── EVM bridge likvidita (sloty 13–14)                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Vesting Schedule

| Alokace | Unlock Model | Délka |
|---------|--------------|-------|
| Všechny premine výstupy | Admin lock (3-of-3 multisig + DAO hlasování) | do schválení DAO |
| L6 Issobella + DAO Treasury (sloty 6–8) | + Time-lock blok 144 000 | ~100 dní |

---

## 5.5 Žádný Insider Advantage

### Rovné podmínky

ZION je navržen tak, aby **nikdo neměl neférovou výhodu**:

| Aspekt | Tradiční projekt | ZION |
|--------|------------------|------|
| **VC alokace** | 20-40% | 0% |
| **Team tokens** | 15-25% | 0% (pouze mining) |
| **Presale discount** | 50-80% | N/A |
| **Mining start** | Po insiderech | Všichni současně |
| **Genesis info** | Neveřejná | Plně transparentní |

### Zakladatelé těží jako ostatní

Tým ZION **nemá žádnou speciální alokaci**. Pokud chceme ZION, musíme těžit jako všichni ostatní.

```
Team Allocation: 0 ZION (premine)
Team Mining: Same rules as everyone
Team Advantage: None
```

---

## 5.6 Transparentnost

### On-chain auditovatelnost

Veškerá genesis distribuce je **on-chain ověřitelná**:

```python
# Genesis addresses (veřejné)
GENESIS_ADDRESSES = {
    "mining_operators": "ZION_GENESIS_MINING_OPS_...",
    "dao_treasury": "ZION_GENESIS_DAO_TREASURY_...",
    "infrastructure": "ZION_GENESIS_INFRA_...",
    "humanitarian": "ZION_GENESIS_HUMANITARIAN_...",
}
```

### Ověření

1. **Block explorer:** Každá transakce z genesis adres je veřejná
2. **GitHub:** Všechny adresy jsou v `src/core/premine.py`
3. **Audit report:** Nezávislý audit genesis bloků (plánováno Q3 2026)

---

## 5.7 TestNet vs MainNet

### Aktuální stav (TestNet)

| Parametr | TestNet | MainNet |
|----------|---------|---------|
| **Status** | ✅ Aktivní | 📅 odložen (TBD) |
| **Block Reward** | 50 ZION | 5,400.067 ZION |
| **Genesis Premine** | Mock data | 16.78B skutečné |
| **Tokeny** | Bezcenné (test) | Skutečné |
| **Reset** | Možný kdykoliv | Nikdy |

### Migration Path

```
TestNet → MainNet Migration:
═══════════════════════════════════════════

1. TestNet NEZÁVISÍ na MainNet
   - Žádný token swap
   - Žádný snapshot
   - Čistý start

2. MainNet Genesis = Block #0
   - Fresh blockchain
   - Genesis premine distributed
   - Mining begins

3. TestNet tokens = WORTHLESS
   - Pouze pro testování
   - Žádná hodnota
   - Budou smazány
```

---

## 5.8 Právní disclaimer

### Co ZION NENÍ

```
⚠️ DŮLEŽITÉ UPOZORNĚNÍ:

ZION NENÍ:
├── Cenný papír (security)
├── Investiční produkt
├── Finanční nástroj
├── Garantovaná návratnost
└── Schéma rychlého zbohatnutí

ZION JE:
├── Open-source software
├── Decentralizovaná síť
├── Experimentální technologie
└── Komunitní projekt
```

### Rizika

| Riziko | Popis |
|--------|-------|
| **Technické** | Software může obsahovat chyby |
| **Tržní** | Cena může být 0 |
| **Regulatorní** | Zákony se mohou změnit |
| **Operační** | Síť může selhat |

**Účastníte se na vlastní riziko.**

---

## 5.9 Srovnání launch modelů

| Projekt | Launch Model | VC % | Team % | Fair? |
|---------|--------------|------|--------|-------|
| Bitcoin | Fair Launch | 0% | 0%* | ✅ |
| Ethereum | Presale | ~17% | ~10% | ⚠️ |
| Solana | VC Heavy | ~48% | ~13% | ❌ |
| Monero | Fair Launch | 0% | 0% | ✅ |
| **ZION** | **Fair Launch** | **0%** | **0%** | **✅** |

*Satoshi si vytěžil ~1M BTC, ale za stejných podmínek jako ostatní.

---

## 5.10 Q&A

### "Proč ne presale? Potřebujete financování."

**Odpověď:** Financování zajišťujeme jinými způsoby (granty, consulting, osobní prostředky). Presale by kompromitoval etiku projektu.

### "Jak zaplatíte vývoj?"

**Odpověď:** 
- Infrastructure Fund (2.5B ZION) = vývoj po MainNet
- Dobrovolná práce před MainNet
- Alternativní revenue streams (knihy, consulting)

### "Co když ZION nebude mít hodnotu?"

**Odpověď:** To je riziko každého krypto projektu. ZION nemá žádnou garantovanou hodnotu. Hodnotu vytváří komunita, adopce a utility.

### "Můžu těžit teď na TestNetu?"

**Odpověď:** Ano! TestNet je aktivní. Ale testnet tokeny nemají hodnotu a nebudou převedeny na MainNet.

---

## 5.11 Shrnutí

```
ZION FAIR LAUNCH PRINCIPLES:
═══════════════════════════════════════════════════════════════

✅ NO PRESALE          - Žádné předprodeje tokenů
✅ NO ICO              - Žádné počáteční nabídky
✅ NO VC               - Žádné venture capital
✅ NO TEAM ALLOCATION  - Tým těží jako ostatní
✅ EQUAL START         - Všichni začínají stejně
✅ TRANSPARENT GENESIS - Vše on-chain, auditovatelné
✅ OPEN SOURCE         - Kód veřejný, MIT licence

═══════════════════════════════════════════════════════════════
```

**MainNet Genesis:** odložen (TBD), 23:59:59 UTC

---

**Pokračování:** [Kapitola 6 — DAO Governance](06_DAO_GOVERNANCE.md)

---

*"We don't sell promises. We ship code."*  
**— ZION Fair Launch Manifesto**
