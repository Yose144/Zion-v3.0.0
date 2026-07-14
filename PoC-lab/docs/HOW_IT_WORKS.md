# Jak funguje PoC-lab (pro neodborníky)

*Proof-of-Care — co to je, proč existuje a jak to celé funguje*

---

## Základ: proč nestačí jen "těžit"

Klasický blockchain (Bitcoin) funguje tak, že počítače závodí v řešení
matematické hádanky. Kdo vyhraje, dostane odměnu. Tento systém spotřebuje
obrovské množství elektřiny, ale produkuje jen jedno číslo — důkaz, že
váš počítač pracoval.

ZION chce udělat krok dál. Místo plýtvání energií na zbytečné výpočty
chceme, aby validátoři (lidé a organizace, kteří síť zabezpečují) dělali
**skutečně užitečné věci**. Říkáme tomu **Proof-of-Care** — *Důkaz péče*.

---

## Kdo jsou validátoři?

Validátor je účastník sítě, který:

1. **Složil slib** (Sefirotový vow) — závazek, že bude síť chránit,
   nikoliv zneužívat.
2. **Vsadil ZION** — jako záruku. Pokud podvádí, o zálohu přijde (slashing).
3. **Provádí care tasky** — konkrétní práci, která má reálnou hodnotu.

Speciální validátoři (tzv. **Strážci / Guardians**) navíc složí
**Bódhisattvový slib** — inspirovaný buddhistickým závazkem sloužit
všem bytostem. Tito validátoři získávají o 5 % vyšší odměnu, protože
jejich závazek je hlubší.

---

## Co jsou "care tasky"?

Care tasks jsou konkrétní úkoly, které validátoři vykonávají každou epochu
(přibližně jeden blok). Každý task odpovídá jedné ze sefirot — sfér ze
stromu Života v kabale.

| Task | Sefirot | Co se dělá |
|------|---------|------------|
| ConstitutionalAudit | Keter | Kontroluje, zda síť dodržuje své vlastní pravidlo |
| NpuInferenceQuality | Chokmah | Ověřuje kvalitu AI výpočtů |
| L1AnomalyDetection | Binah | Hledá podezřelé bloky na L1 |
| LiquidityHealth | Chesed | Monitoruje DeFi likviditu |
| DaoProposalAudit | Gevurah | Kontroluje DAO návrhy |
| WarpBridgeAudit | Tiferet | Audituje cross-chain mosty |
| HiranInference | Netzach | Zodpovídá za AI inference přes Hiranyagarbhu |
| SmartContractVerify | Hod | Verifikuje smart kontrakty |
| CommunityHealth | Yesod | Hlídá zdraví komunity |
| LongHorizonMonitoring | Malkhut | Dlouhodobý dohled nad sítí |
| MythCodeConsistency | Da'at | Ověřuje soulad kódu s filosofií ZIONu |

---

## Jak se počítá skóre?

Každý validátor dostane na konci epochy **care score** — číslo,
které odráží, jak dobře svou práci odvedl.

```
care score = (přesnost × 50%) + (včasnost × 30%) + (pokrytí × 20%)
```

Na toto základní skóre se pak aplikují bonusy a úpravy:

```
finální skóre = základní skóre
              + dual-vow bonus (+5 % pro Strážce)
              + Hiran AI úprava (může být záporná pro podezřelé důkazy)
              + NCL reputation bonus (+1 % až +5 % dle reputace)
```

---

## Co je Hiran?

**Hiran** (plným jménem *Hiranyagarbha*) je AI agent — zlaté vejce
z hinduistické kosmologie, symbol prvotního vědomí. V ZIONu slouží jako
nestranný soudce, který kontroluje každý důkaz péče.

Hiran **nerozhoduje sám**. Řídíme se pravidlem:

> **"Hiran navrhuje, Guardian rozhoduje."**

Jinými slovy: Hiran může označit proof jako podezřelý a navrhnout
trest, ale finální rozhodnutí o slashingu nebo zákazu validátora
vždy musí udělat lidský Strážce.

Toto je zásadní bezpečnostní hranice — AI nikdy nesmí mít plnou
moc nad majetkem lidí.

### Hiran verdikty

| Verdict | Meaning |
|---------|---------|
| Accepted | Důkaz je v pořádku |
| AcceptedWithWarning | Přijato, ale s varovným příznakem |
| RejectedSuspicious | Podezřelý — navrhuje eskalaci do DAO |
| RejectedInvalid | Strukturálně vadný proof |
| Uncertain | Hiran si není jistý — potřeba Guardian přezkum |

---

## Co je NCL?

**NCL (Neural Compute Layer)** je vrstva sítě, která přiděluje
AI výpočetní úlohy. Každý validátor si buduje v NCL reputaci
podle toho, jak spolehlivě plní přidělené výpočty.

Reputační skóre se počítá takto:

```
NCL score = 100 × úspěšnost × (1 + vědomostní_bonus) × časový_faktor
```

Validátoři s nízkým NCL skóre (< 20) jsou ze sítě vyloučeni.
Validátoři s vysokým skóre (> 100) dostávají bonus k care score.

---

## Jak se rozdělují odměny?

Z každého bloku vznikne *block reward* (odměna za blok). Ta se dělí takto:

```
70 %  → care validátoři (proporcionálně dle care score)
10 %  → humanitární fond
10 %  → DAO pokladna
 5 %  → WARP bridge maintenance
 5 %  → Hiran AI research
```

Výplata pro jednotlivé validátory se počítá proporcionálně —
kdo má vyšší care score, dostane větší část ze 70% poolu.

---

## Co se stane, když validátor podvádí?

Pokud Hiran detekuje anomálii (gaming skóre, Sybil útok, replay attack…),
systém automaticky:

1. **Low severity** — zaznamená varování do audit logu.
2. **Medium severity** — sníží care score pro tuto epochu.
3. **High severity** — zamítne proof (validátor nedostane nic) + navrhne
   slash do DAO.
4. **Critical severity** — okamžitá eskalace na Guardian přezkum +
   návrh trvalého ban.

Skutečný slash (odebrání vložených ZION) musí schválit DAO hlasováním —
AI sám nemůže vzít validátorovi peníze.

---

## Stub mode — proč a jak?

Celý PoC-lab funguje i **bez živého Hiranu**. Když server není dostupný,
aktivuje se automaticky *stub mode*: všechny verdikty jsou `Accepted`
s confidence 1.0. Simulátor a testy fungují identicky.

To je záměrné — chceme, aby laboratorní prostředí bylo plně funkční
i offline, bez závislosti na externím AI serveru.

Stub mode se automaticky deaktivuje, jakmile zadáte `--hiran-url`:

```bash
cargo run -p poc-sim -- --hiran-url http://localhost:9000
```

---

## Fáze 2 — Co se přidalo

### Skutečná data (Real data sources)

Dosud care tasky pracovaly se simulovanými (mock) daty. Fáze 2 přidává
`DataSource` trait — rozhraní, přes které tasky získávají reálná data:

- **L1RpcSource** — stahuje bridge state, mempool a pool state z L1 RPC
  endpointu (`http://127.0.0.1:9443`).
- **WarpApiSource** — stahuje data z L3 WARP API (`http://127.0.0.1:8453`).
- **MockDataSource** — deterministická mock data (default, funguje offline).

Pokud live zdroj není dostupný, automaticky se přepne na mock —
laboratoř tedy funguje vždy, i bez běžícího node.

### Zabezpečená P2P (Crypto)

Fáze 1 přinesla TCP transport a gossip protokol. Fáze 2 přidává šifrování:

- **NodeIdentity** — každý uzel má Ed25519 klíč (podepisování zpráv).
- **EncryptedTransport** — X25519 klíčová výměna + AES-256-GCM šifrování
  (utajení + integrita každé zprávy).
- **PeerDiscovery** — seed-based peer list s exponential backoff a
  automatickým znovupřipojením.

### Adversarial economics — co když někdo podvádí?

Fáze 2 přidává `AdversarialSimulator` — simulátor, který modeluje
různé strategie podvodníků:

| Strategie | Co dělá | Jak se detekuje |
|-----------|---------|-----------------|
| **Honest** | Poctivě plní tasky | — |
| **Lazy** | Nedělá nic / minimum | Rejected nebo velmi nízký score |
| **ScoreGamer** | Optimalizuje jen na score | Score > 1.3× median ostatních |
| **BridgeSpoofer** | Falšuje bridge audit | ~33% náhodná detekce |
| **Colluding** | Skupina se domlouvají | ≥3 validátoři s podobným score |
| **Intermittent** | Střídavě podvádí | Detekce v cheat epochách |

Při detekci se aplikuje **slashing** — progresivní odebrání stake
(10% → 20% → 40% → trvalý ban). Simulátor měří také **Gini coefficient**
(rozdělení bohatství) a **survival rate** (kolik validátorů přežije).

### Persistent storage — ukládání proofů

Fáze 2 přidává crate `poc-storage` s třemi komponentami:

- **FileProofStore** — content-addressed úložiště proofů. Každý proof
  se uloží pod svým BLAKE3 hashem (2-level sharding). Index mapuje
  `(epoch, validator_id) → proof hash`.
- **EpochHistory** — append-only záznam epoch. Každá epocha obsahuje
  hash předchozí (chain hash) — podobně jako blockchain. Lze přehrát
  celou historii a ověřit konzistenci.
- **AuditTrail** — monotónický audit log s hash chain. Tamper-evident:
  jakákoliv úprava minulého záznamu rozbije chain.

---

## Struktura kódu

```
PoC-lab/
├── poc-core/       Základní typy: CareTask, CareProof, Hiran verdikty, anomálie
├── poc-npu/        NPU backend abstrakce + INT8 VM + OpenCL GPU (opencl)
├── poc-tasks/      Assigner + real executors + data sources (live-data)
├── poc-economics/  Reward split, slashing, final_care_score() s NCL bonusem
├── poc-registry/   Validátorský registr, Sefirot vow, Bodhisattva vow
├── poc-verifier/   Ověřuje strukturu a skóre každého CareProof
├── poc-sim/        End-to-end simulátor + adversarial economics
├── poc-hiran/      Hiran AI verdict engine (stub + live)
├── poc-p2p/        TCP transport + gossip + crypto (Ed25519/X25519/AES-GCM)
└── poc-storage/    FileProofStore + EpochHistory + AuditTrail
```

---

## Filosofický základ

PoC-lab vychází z knihy *Protokol Péče* (TerraNova), která navrhuje
ekonomiku postavenou na skutečné péči — o lidi, přírodu a vědomí.

Každý care task odpovídá jedné ze sefirot na Stromě života. Validátoři
nejsou jen "minéři" — jsou to strážci, kteří se zavázali k péči.

Bódhisattvový slib říká: *"Dokud jsou cítící bytosti, budu zde, abych
jim sloužil."* Tento závazek je v ZIONu zakódován přímo do protokolu —
nikoliv jako metafora, ale jako funkční ekonomická pobídka.

---

*Fáze 0: základní laboratoř. Fáze 1: OpenCL GPU, real executors, P2P. Fáze 2: real data, crypto, adversarial economics, storage.*
*Technická specifikace: `docs/3.0.4/POC_HIRAN_INTEGRATION_SPEC.md`*
*Filosofický základ: `docs/3.0.4/AI_NATIVE_VOW.md`, `docs/3.0.4/BODHISATTVA_VOW_COMPENDIUM.md`*
