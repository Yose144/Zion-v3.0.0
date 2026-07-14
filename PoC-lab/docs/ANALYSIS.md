# Proof-of-Care — Analýza možností a next steps

> **Status:** Konceptuální analýza pro PoC-lab.  
> **Upstream:** [`docs/3.0.4/PoC_CONCEPT.md`](../docs/3.0.4/PoC_CONCEPT.md).

---

## 1. Proč Proof-of-Care dává smysl pro ZION

ZION už není „jen blockchain“. Má:

- **L1 PoW** (bootstrap + distribuce),
- **L2 DeFi/DAO/Bridge** (hodnota a governance),
- **L3 WARP** (12 chainů, cross-chain bridge),
- **L3 Hiran AI** (lokální inference),
- **L5/L6** (komunity, long-horizon).

PoW v této fázi dává smysl, ale dlouhodobě je kritizován za:

1. **Waste energy** — hash nemá užitečný výstup.
2. **ASIC centralizace** — kdo má nejvíce peněz, ten má největší sílu.
3. **Žádná vazba na ekosystém** — miner nemusí pomáhat síti, jen hledat hashe.

Proof-of-Care řeší všechny tři body:

- **Užitečná práce** — každý blok obsahuje care proofs (audit bridge, anomaly detection, inference).
- **Demokratizace** — NPU je v každém telefonu/laptopu; není potřeba drahý ASIC rig.
- **Propojení s ekosystémem** — validátor dostává tasky podle toho, co síť právě potřebuje.

---

## 2. Možné cesty implementace

### Cesta A: Soft layer nad stávajícím PoW (nejbezpečnější)

**Idea:** Care proofs se sbírají a ukládají jako metadata k blokům, ale **konsensus zůstává PoW**. Care score ovlivňuje pouze **soft incentives** (např. priorita v mempoolu, extra yield z poolu, reputation).

**Výhody:**
- Žádný hard fork.
- Můžeme testovat celý pipeline (assignment → inference → verification → scoring).
- Slouží jako příprava pro hybrid.

**Nevýhody:**
- PoC není skutečný konsensus.
- Riziko gamingu, protože není ekonomická sankce.

**Kroky:**
1. Rozšířit `poc-verifier` o reputation registry.
2. Vytvořit side-car v `V3/L1/core` (read-only, žádná validace bloku) který sbírá care proofs z mempoolu.
3. Dashboard zobrazuje care score validátorů.

---

### Cesta B: PoW + PoC hybrid (2027)

**Idea:** Konsensus stále PoW, ale **block production pravděpodobnost** je částečně vážena care scorem. Např.:

```
effective_difficulty = base_difficulty * (1 + alpha * care_score)
```

Validátor s vyšším care scorem má nižší efektivní obtížnost.

**Výhody:**
- Zachovává decentralizaci PoW.
- Zavádí useful work bez radikální změny.

**Nevýhody:**
- Vyžaduje hard fork.
- Musíme vyřešit determinismus NPU inference.
- Komplexní interakce PoW a PoC rewardů.

**Kroky:**
1. Specifikovat `ZION_HYBRID_POC_HEIGHT` a alpha parametr.
2. Implementovat `CareRegistry` v L1 (on-chain/off-chain hybrid).
3. Připravit RandomNPU model generátor a INT8 VM.

---

### Cesta C: Plný Proof-of-Care (2028+)

**Idea:** Nahradit hashrate za **care score** jako hlavní metrika block production. Validátory se střídají podle care score; každý blok obsahuje care proofs.

**Výhody:**
- Maximální alignment validátorů se zdravím sítě.
- Ekologicky udržitelné (NPU inference vs brute-force hashing).

**Nevýhody:**
- Obrovský hard fork.
- Potřebujeme robustní anti-Sybil, slashing, determinismus.
- Bez PoW by se změnil bezpečnostní model — musíme dokázat, že care score je dostatečně nákladný k falšování.

**Kroky:**
1. Dokončit formální specifikaci konsensu.
2. Vytvořit testnet s plným PoC.
3. Bezpečnostní audit a fuzzing.
4. Hard fork po schválení DAO.

---

## 3. Technické možnosti

### 3.1 Deterministická INT8 VM

**Nutnost:** Bez ní nemůžeme ověřovat care proofs cross-platform.

**Přístupy:**

| Přístup | Náročnost | Determinismus | Výkon |
|---------|-----------|---------------|-------|
| Čistý CPU reference | Nízká | ✅ | ❌ pomalý |
| ONNX Runtime CPU EP | Nízká | ⚠️ závisí na EP | 🟡 |
| ONNX Runtime NPU EP | Střední | ❌ různý rounding | ✅ |
| Vlastní INT8 VM + lookup tables | Vysoká | ✅ | 🟡 |
| TEE (Intel TDX, ARM CCA) | Velmi vysoká | ✅ | ✅ |

**Doporučení:** Začít s vlastní INT8 VM jako reference, pozvolna přidávat ONNX CPU EP, pak NPU EP s circuit breaker.

### 3.2 ASIC resistance

Současný `NPU Mix` v `V3/L1/cosmic-harmony/src/algorithms_npu.rs` je statický (4 topologie). Pro skutečnou ASIC resistance potřebujeme:

- **Random topologie per epoch** (layer count, dims, activations, skip connections).
- **Randomizaci compute grafu**, ne jen vah.
- **Memory-hard + compute-hard kombinaci** (Neural Memory-Hard koncept).

### 3.3 NPU Attestation

Pro důkaz, že inference proběhlo na reálném NPU, máme možnosti:

1. **Vendor SDK quote** — CoreML, OpenVINO, QNN (ale není standardizované).
2. **TEE attestation** — spustit celý miner v TEE, podepsat výstup.
3. **Proof-of-elapsed-time + challenge** — náhodně vybrané nonce pro inference, které musí projít rychle.
4. **Honest majority cross-validation** — více validátorů ověřuje stejný output, odlišný výsledek = slashing.

**Doporučení:** Pro prototyp použít honest-majority cross-validation. Pro produkci TEE + vendor quote.

---

## 4. Otevřené otázky

1. **Jak přesně měřit accuracy care proofu?**
   - Pro anomaly detection: shoda s většinovým výsledkem?
   - Pro bridge audit: shoda s on-chain state?
   - Pro Hiran inference: subjektivní? Musíme definovat canonical tasky.

2. **Jak zabránit Sybil útoku?**
   - Stake? Identity? Sefirot Vow registry? Hardware attestation?
   - Kombinace pravděpodobně nutná.

3. **Jak integrovat s L1 bez bezpečnostních rizik?**
   - PoC kód musí být izolován od transakční validace.
   - Jakýkoliv PoC konsensus change = samostatný audit.

4. **Jaké je spravedlivé rozložení rewardů?**
   - Současný 89/5/5/1 split by se změnil.
   - Musíme modelovat inflation dopad.

5. **Kdy přejít z PoW?**
   - Až bude PoC dostatečně testován na testnetu a bezpečnostně auditován.
   - Doporučení: nejdřív Cesta A, pak B, pak C.

---

## 5. Doporučený next steps roadmap

### Fáze 0 — Laboratoř (PoC-lab) — ✅ HOTOVO (standalone verze)
- ✅ Datové struktury (`poc-core`), task assignment (`poc-tasks`), NPU abstrakce (`poc-npu`).
- ✅ Reálná deterministická INT8 VM s lookup-table aktivacemi a RandomNPU
  topologií generovanou z `(seed, epoch)` (`poc-npu::vm`).
- ✅ Multi-backend cross-validation (honest majority) (`poc-verifier::cross_validation`).
- ✅ Validator registry se stake-based Sybil resistance a plným Sefirot Vow
  lifecyklem (break/suspend/renew/revoke/cooldown) (`poc-registry`).
- ✅ Reward distribution (70/10/10/5/5 split, largest-remainder rozdělení
  care poolu) a eskalující slashing model (`poc-economics`).
- ✅ End-to-end network simulátor spojující všechny vrstvy, s CLI demem
  (`poc-sim`, `cargo run -p poc-sim`).
- ✅ Hiran AI verdict engine — stub + live mode (`poc-hiran`).
- ✅ 277 unit/integration testů (default), vše deterministické a reprodukovatelné.

### Fáze 1 — Soft layer (PoC-lab) — ✅ HOTOVO
- ✅ OpenCL GPU backend pro INT8 VM (AMD RX 5600 XT / ROCm, bit-exact s CPU)
  (`poc-npu::opencl`, feature `opencl`).
- ✅ `ProgramConfig` presets (CI ~4K MAC, BENCH ~100-200K, PRODUCTION ~2M MAC).
- ✅ Batch inference s program reuse (`NpuBackend::infer_batch`).
- ✅ Real care task executors — Warp, Anomaly, Liquidity, Constitutional
  + `CompositeExecutor` router (`poc-tasks::executors`).
- ✅ P2P multi-process simulátor — TCP transport, gossip protokol,
  `P2pNode`, cross-validation across nodes (`poc-p2p`).
- ✅ 325 testů se všemi features (opencl + live-data + crypto).

### Fáze 2 — Hardening (PoC-lab) — ✅ HOTOVO
- ✅ Real data sources — `DataSource` trait + `L1RpcSource` + `WarpApiSource`
  s automatickým fallback na mock (`poc-tasks::data_sources`, feature `live-data`).
- ✅ P2P hardening — `NodeIdentity` (Ed25519), `EncryptedTransport` (X25519 ECDH
  + AES-256-GCM), `PeerDiscovery` s exponential backoff (`poc-p2p::crypto`,
  feature `crypto`).
- ✅ Adversarial economics — `AdversarialSimulator` s 6 strategiemi (Honest, Lazy,
  ScoreGamer, BridgeSpoofer, Colluding, Intermittent), gaming detection, slashing
  enforcement, Gini coefficient, survival rate (`poc-sim::adversarial`).
- ✅ Persistent storage — `FileProofStore` (content-addressed bincode), `EpochHistory`
  (chain hash, replay), `AuditTrail` (tamper-evident hash chain) (`poc-storage`).

**Co v laboratoři zatím chybí / je zjednodušené:**
- `NpuAttestation` je hash-based stub, ne reálný vendor quote / TEE attestation.
- Sybil resistance je stake-based + gaming detection, ale bez identity/hardware attestation.
- Live data sources jsou read-only (žádná zpětná integrace do L1).
- P2P crypto je laboratorní (bez produkční key management / PKI).
- Žádná L1 konsensus integrace — PoC-lab zůstává izolovaný od `V3/`.

### Fáze 3 — Hybrid PoW+PoC (hard fork, produkce)
- Side-car v `V3/` který sbírá care proofs z mempoolu / P2P.
- Napojit `poc-registry` reputation model na reálné validátory (read-only).
- Dashboard vizualizace care score (mohlo by navázat na Zohar tree-health API).
- Portovat `poc-npu::vm::RandomNpuProgram` do
  `V3/L1/cosmic-harmony` jako alternativu/rozšíření `algorithms_npu.rs`.
- INT8 VM CPU reference integrovaný do L1 pro verifikaci.
- Block production vážená care scorem (`effective_difficulty` model, viz §2 Cesta B).
- Portovat `poc-registry` Sefirot Vow lifecycle na on-chain kontrakty
  (navazuje na již existující `SefirotVowToken`/`SefirotVowRegistry` v `V3/L2`).

### Fáze 4 — Full PoC (hard fork)
- Care score nahrazuje hashrate.
- Portovat `poc-economics` reward/slashing model do L1 s plnou ekonomickou
  a game-theoretic analýzou.
- Testnet → mainnet migrace, plný bezpečnostní audit.

---

## 6. Související dokumenty

- [`docs/3.0.4/PoC_CONCEPT.md`](../docs/3.0.4/PoC_CONCEPT.md)
- [`docs/3.0.3/evoluZion.md`](../docs/3.0.3/evoluZion.md)
- [`docs/NPU_HARDWARE_MINING_THEORY.md`](../docs/NPU_HARDWARE_MINING_THEORY.md)
- [`V3/L5/docs/GOVERNANCE/sefirot-vow.md`](../V3/L5/docs/GOVERNANCE/sefirot-vow.md)
- [`docs/Zohar/02-ROADMAP.md`](../docs/Zohar/02-ROADMAP.md)
