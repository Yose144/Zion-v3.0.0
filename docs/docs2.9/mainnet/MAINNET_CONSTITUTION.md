# 📜 ZION MAINNET CONSTITUTION

**Version 1.0 — Immutable Protocol Charter**

---

## 0. Účel dokumentu

Tento dokument definuje **neměnné parametry** ZION MainNetu.

Jakmile je MainNet spuštěn, **žádná zde uvedená položka nesmí být změněna** bez hard forku.

Tento dokument slouží jako:
- technická ústava
- referenční specifikace
- veřejný závazek vůči komunitě

---

## 1. Identita sítě

| Parametr | Hodnota |
|----------|---------|
| **Network name** | ZION MainNet |
| **Chain ID** | `zion-mainnet-1` |
| **Consensus** | Proof of Work (Cosmic Harmony v3) |
| **Block time target** | 60 seconds |
| **Genesis timestamp** | *(bude vyhlášeno před launch)* |

---

## 2. Supply & Ekonomika

### 2.1 Celková nabídka

| Kategorie | Hodnota | Podíl |
|-----------|---------|-------|
| **Total supply (max)** | 144,000,000,000 ZION | 100% |
| **Mining supply** | 127,220,000,000 ZION | 88.35% |
| **Genesis premine** | 16,780,000,000 ZION | 11.65% |

### 2.2 Emise

| Parametr | Hodnota |
|----------|---------|
| **Initial block reward** | 5,400.067 ZION |
| **Block interval** | 60 s |
| **Emission model** | Smooth decay |
| **Mining horizon** | ~45 let |

> Emise je **deterministická** a plně vypočitatelná z výšky bloku.

### 2.3 Poplatky (fees)

- Transakční poplatky jsou součástí protokolu
- **Default**: fees burned
- Žádný implicitní treasury routing v base layer

---

## 3. Genesis Premine — Rozdělení

Genesis premine je vytvořen **výhradně v Genesis blocku**.

### 3.1 Kategorie

Premine je rozdělen na následující logické skupiny:

| Kategorie | Účel |
|-----------|------|
| **DAO / Governance** | Decentralizované rozhodování |
| **Humanitarian Fund** | Podpora humanitárních projektů |
| **Infrastructure** | Core development & maintenance |
| **Ecosystem Bootstrap** | Granty, bounties, tooling |

### 3.2 Lock & Unlock pravidla

- ✅ Všechny premine prostředky jsou **on-chain sledovatelné**
- ✅ Část premine je **časově uzamčena**
- ✅ Unlock je založen na **block height**
- ✅ Unlock je **automatický** a nevyžaduje důvěru

> **Žádné ruční odemykání. Žádné výjimky.**

---

## 4. Presale Status

| Položka | Stav |
|---------|------|
| Presale na MainNetu | ❌ **NEEXISTUJE** |
| Presale tokeny | ❌ **NEEXISTUJÍ** |
| Privátní alokace | ❌ **NEEXISTUJÍ** |

> Historické presale koncepty byly **zrušeny v lednu 2026**.

---

## 5. Konsensus & Obtížnost

### 5.1 Difficulty Adjustment Algorithm (DAA)

| Parametr | Hodnota |
|----------|---------|
| **Typ** | LWMA (Linearly Weighted Moving Average) |
| **Target block time** | 60 s |
| **Window size** | 60 blocks |
| **Max change per block** | +25% / −25% |
| **Timestamp sanity** | clamp ±2× target |

### 5.2 Reorg & Finality

| Parametr | Hodnota |
|----------|---------|
| **Max reorg depth** | 10 blocks |
| **Soft finality** | 60 blocks |
| **Fork choice rule** | Highest accumulated work |

---

## 6. Validace & Bezpečnost

Každý plný uzel:
- ✅ validuje celý chain
- ✅ odmítá neplatné bloky

**Neexistuje žádný:**
- ❌ admin klíč
- ❌ master node
- ❌ privilegovaný účet

> Síť je **plně permissionless**.

---

## 7. Upgrade politika

- ZION MainNet **nemá automatické upgrady**
- Změny protokolu vyžadují:
  - pouze **hard fork**
  - **veřejné oznámení**
  - **dostatečný předstih**

---

## 8. Neměnnost

Následující položky jsou **navždy neměnné**:

| Položka | Status |
|---------|--------|
| Chain ID | 🔒 LOCKED |
| Total supply | 🔒 LOCKED |
| Emission model | 🔒 LOCKED |
| Genesis premine částky | 🔒 LOCKED |
| Konsensus | 🔒 LOCKED |
| DAA typ | 🔒 LOCKED |
| Block time | 🔒 LOCKED |

---

## 9. Závěrečné ustanovení

Tento dokument reprezentuje **společenskou smlouvu** mezi:
- vývojáři
- těžaři
- uzly
- uživateli
- budoucími generacemi

**ZION MainNet je:**
- ✅ otevřený
- ✅ decentralizovaný
- ✅ suverénní
- ✅ nezávislý

---

## 10. Hash & Freeze

Po schválení bude:
1. Dokument uložen do repozitáře
2. Vygenerován **SHA-256 hash**
3. Hash zveřejněn
4. Dokument označen jako **IMMUTABLE**

---

**🔒 STAV: DRAFT → READY FOR FREEZE**

---

*Document Version: 1.0*  
*Last Updated: 2026-02-03*
