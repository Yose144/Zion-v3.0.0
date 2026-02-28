# CosmicHarmony v4 — Plán Upgradu (česky, pro každého)

> **Stav:** FÁZE NÁVRHU — zatím neimplementováno  
> **Datum:** 28. 2. 2026  
> **Určeno pro:** vývojáře i naprosté začátečníky — každý pojem je vysvětlen lidsky

---

## Obsah

1. [Co je ZION a jak funguje těžení?](#1-co-je-zion-a-jak-funguje-těžení)
2. [Proč nestačí obyčejný Proof of Work?](#2-proč-nestačí-obyčejný-proof-of-work)
3. [Co je CosmicHarmony a kde jsme teď?](#3-co-je-cosmicharmony-a-kde-jsme-teď)
4. [Co chceme v CHv4 přidat?](#4-co-chceme-v-chv4-přidat)
   - 4A. NPU Mixing — zapojení AI čipů do těžení
   - 4B. NCL PoUW — těžení = užitečná práce pro AI
   - 4C. ZK-Shark — matematický důkaz jako těžební práce
5. [Jaký hardware to využije?](#5-jaký-hardware-to-využije)
6. [Co se musí změnit v kódu?](#6-co-se-musí-změnit-v-kódu)
7. [Postupný plán — kdy a jak?](#7-postupný-plán---kdy-a-jak)
8. [Jak to ovlivní síť a fork?](#8-jak-to-ovlivní-síť-a-fork)
9. [Bezpečnost — co může jít špatně?](#9-bezpečnost---co-může-jít-špatně)
10. [Rizika a jak jim předejít](#10-rizika-a-jak-jim-předejít)

---

## 1. Co je ZION a jak funguje těžení?

### Těžení jednoduše

Představ si, že blockchain je velká účetní kniha. Každý, kdo chce přidat novou stránku (blok), musí nejdřív vyřešit složitou matematickou hádanku. Kdo ji vyřeší první, dostane odměnu v ZIONu. Tomuto procesu říkáme **těžení** (mining).

Hádanka je navržená tak, aby:
- Se nedala podvádět (každý si výsledek snadno ověří)
- Nedala se řešit jinak než hrubou výpočetní silou
- Byla vždy přibližně stejně těžká (síť se sama přizpůsobuje)

### Co je Proof of Work (PoW)?

**Proof of Work** neboli „Důkaz práce" je systém, kde těžař dokáže, že skutečně strávil čas a energii výpočtem. Je to jako soutěž: kdo vyhází nejvíc kostek a dostane číslo pod určitou hranici, vyhraje.

Bitcoin, Ethereum Classic, Monero — všechny používají PoW. ZION taky, ale chytřejší verzi.

---

## 2. Proč nestačí obyčejný Proof of Work?

### Tři velké problémy standardního PoW v roce 2026

**Problém 1: ASIC dominance**

> 🔧 *Co je ASIC?*  
> ASIC (Application-Specific Integrated Circuit) je speciální čip navržený pouze na jednu věc — třeba těžení Bitcoinu. Stojí statisíce korun, ale je tisíckrát rychlejší než tvůj počítač nebo grafická karta.

Velké firmy si nasadí tisíce ASICů → mají 99 % výpočetního výkonu sítě → běžní lidé nemají šanci → síť je centralizovaná u pár hráčů. To je přesně opak toho, proč blockchain vznikl.

**ZION chce:** aby mohl těžit každý — i s notebookem nebo mobilem.

---

**Problém 2: Promarněná energie**

Těžaři spotřebují obrovské množství elektřiny za výpočty, které **nemají žádný jiný účel** než zabezpečit síť. Je to jako topit penězi.

**ZION chce:** aby těžební práce byla zároveň **užitečná** — například aby stroje při těžení zpracovávaly AI úlohy pro zákazníky a vydělávaly tak navíc.

---

**Problém 3: Zastarělý příběh**

V roce 2026 je AI a NPU (AI čipy) všude. Každý nový telefon, laptop i herní PC má speciální čip pro umělou inteligenci. Blockchain, který toto ignoruje, působí zastarale.

**ZION chce:** být první blockchain, kde těžení nativně využívá AI hardware.

---

## 3. Co je CosmicHarmony a kde jsme teď?

### CosmicHarmony v3 — aktuální algoritmus ZIONu

CosmicHarmony v3 (zkráceně CHv3) je těžební algoritmus ZIONu. Na rozdíl od Bitcoinu (který používá prostý SHA256) CHv3 provádí **5 kroků za sebou** — každý jiný, každý jinak odolný vůči specializovaným čipům.

### Jak CHv3 funguje — krok za krokem (pro lajky)

```
Vstup: hlavička bloku + nonce (číslo, které těžař mění)
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Krok 1: Keccak-256                                 │
│                                                     │
│  Matematická mlýnská práce. Vstup rozmele           │
│  na 32 bajtů. Vedlejší produkt: sdílíme výsledek    │
│  s Ethereum Classic těžaři → ZION dostává fee.     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Krok 2: SHA3-512                                   │
│                                                     │
│  Jiný typ matematické „mlýnice". Výstup 64 bajtů.   │
│  Vedlejší produkt: sdílíme s Nexus/0xBTC těžaři.   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Krok 3: Zlatá matice (GoldenMatrix)                │
│                                                     │
│  Data projdou matematickou mřížkou (8×8) s          │
│  váhami odvozenými od zlatého řezu (φ = 1.618...).  │
│  Výstup: 64 bajtů.                                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Krok 4: Paměťový labyrint (MemoryHard)             │
│                                                     │
│  Data musí procházet velkou pamětí sem a tam.       │
│  ASIC čip to nedokáže rychleji než normální RAM —   │
│  tím je algoritmus odolný vůči ASICům.             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Krok 5: CosmicFusion (AES-NI)                      │
│                                                     │
│  Finální „zamíchání" pomocí šifrovacích instrukcí   │
│  (AES-NI). Výsledek: 32bajtový hash.                │
│  Porovná se s cílovým číslem (obtížnost).           │
│  Pokud hash < cíl → blok nalezen → odměna!         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
               VÝSLEDNÝ HASH
```

### Jak ZION rozděluje výpočetní výkon (50/25/25 model)

```
Celkový výpočetní výkon těžaře
├── 50% → Těžení ZION (kroky 1–5 výše)
│   ├── ZDARMA vedlejší: Keccak výsledek → ETC / NiceHash
│   └── ZDARMA vedlejší: SHA3 výsledek  → Nexus / 0xBTC
├── 25% → Přepínání mezi nejziskovějšími kryptoměnami
│             (Ergo / Ravencoin / Kaspa / Alephium)
└── 25% → NCL — AI výpočty pro zákazníky (L3 vrstva)
```

> 💡 **Důležité:** Těžař vydělává z 5 zdrojů, ale platí přímý výpočetní výkon jen za 3!
> ETC a Nexus jsou **zadarmo** — jsou vedlejší produkt ZION těžení.

---

## 4. Co chceme v CHv4 přidat?

CHv4 **nenahrazuje** CHv3. Přidává k němu 3 volitelná rozšíření.

---

### 4A. NPU Mixing — zapojení AI čipů do těžení

#### Co je NPU? (pro lajky)

> 🧠 *NPU = Neural Processing Unit*  
> Je to speciální čip uvnitř moderních telefonů, laptopů a počítačů, navržený specificky pro operace umělé inteligence (násobení matic, neuronové sítě). Najdeš ho v:
> - Apple M1/M2/M3/M4 (Apple Neural Engine — zelená ikonka v Activity Monitor)
> - Qualcomm Snapdragon 8 Gen 3+ (v moderních Android telefonech)
> - Intel Core Ultra „Meteor Lake" (v laptopech od 2024)
> - AMD Ryzen AI (v laptopech a desktopu od 2023)

**Problém:** standardní PoW algoritmy NPU vůbec nevyužívají. Čip tam sedí nečinný, zatímco CPU/GPU těží.

#### Co navrhujeme?

Přidat **6. krok do pipeline** mezi „Paměťový labyrint" a „CosmicFusion":

```
Po kroku 4 (MemoryHard) → přijde nový Krok 5½:

┌─────────────────────────────────────────────────────┐  ← NOVÉ v CHv4
│  Krok 5½: NPU Míchání (ONNX)                        │
│                                                     │
│  64 bajtů prochází malou neuronovou sítí.           │
│  Síť má 3 vrstvy: 64 → 128 → 64 neuronů.           │
│                                                     │
│  Na NPU čipu: ~50–200 mikrosekund (velmi rychlé)   │
│  Na CPU (záloha): ~500–1000 mikrosekund             │
│                                                     │
│  Model neuronové sítě: veřejný, neměnný,            │
│  jeho hash je zabudován v genesis bloku.            │
│  Kdokoliv podvrhne model → síť blok odmítne.        │
└──────────────────────┬──────────────────────────────┘
        │
        ▼
Krok 6: CosmicFusion (beze změny)
```

#### Proč je to dobré?

1. **NPU čip konečně pracuje** — kdo má Apple M-chip nebo Intel NPU, má výhodu
2. **ASIC je dražší na výrobu** — musí implementovat jak Keccak/AES-NI, tak ONNX MLP → 3× vyšší náklady
3. **CPU záloha dává stejný výsledek** — kdo nemá NPU, stále může těžit (výsledek je identický)
4. **Model je veřejný a neměnný** — nikdo nemůže podvést

#### Technicky (pro vývojáře)

```toml
# Cargo.toml — nový feature flag
[features]
native-npu = ["ort"]   # ONNX Runtime binding pro Rust
```

```rust
// Nový soubor: L1/cosmic-harmony/src/algorithms_npu.rs

pub struct NpuMixer {
    session: ort::Session,  // ONNX Runtime session
}

impl NpuMixer {
    // 64 bajtů vstup → 64 bajtů smíchané výstup
    pub fn mix(&self, scratchpad: &[u8; 64]) -> [u8; 64] {
        // normalizace → inference → denormalizace
    }
}

// Model je přiložen přímo do binárky při kompilaci
pub static CH_MIXING_V4_ONNX: &[u8] = include_bytes!("../models/ch_mixing_v4.onnx");
```

---

### 4B. NCL PoUW — těžení = užitečná práce pro AI

#### Co je PoUW? (pro lajky)

> ⚙️ *PoUW = Proof of Useful Work = Důkaz užitečné práce*  
> Normální PoW: počítač hledá číslo, které splňuje podmínku — práce je užitečná **pouze** pro konsenzus.  
> PoUW: počítač dělá práci, která je užitečná pro **někoho dalšího** (třeba zpracovává AI model pro zákazníka) — a zároveň to slouží jako důkaz pro blockchain.

#### Jak to funguje v ZIONu?

ZION má vrstvu L3 (NCL — Neural Compute Layer). Zákazníci sem posílají AI úlohy (inference = „zeptej se modelu"). Těžaři tyto úlohy zpracovávají.

**Nový nápad:** výsledek AI úlohy **se stane mining share** (příspěvkem do poolu).

```
Zákazník          NCL Marketplace          Těžař               Pool

 Pošle AI         Přiřadí task_id    ←──────────────── Stáhne úlohu
 úlohu            +cílový výsledek          │
                                     Spočítá inference
                                     (neural net forward)
                                            │
                                     hash(task_id + výsledek)
                                     < obtížnost target?
                                            │  ANO
                                     ────────────────────────→ Submit share
                                                               Pool ověří
                                                               a odmění
```

#### Jak se rozdělí výnosy?

```
Zákazník zaplatí za AI úlohu:
├── 85% → těžař (za výpočet)
├── 10% → ZION projekt (NCL poplatek)
└──  5% → zákazník dostane rabat za příští úlohu
```

#### Proč je to skvělé?

- Těžař dostane odměnu **dvakrát**: jako ZION blok reward + jako platba za AI výpočet
- Zákazník dostane AI výpočet za tržní cenu
- ZION síť je decentralizovaná AI výpočetní vrstva
- Energie není promarněná — dělá reálnou práci

#### Stub už existuje!

V kódu `L1/miner/src/ncl/` je již připravený základ (jen deaktivovaný). NCL PoUW je nejjednodušší upgrade — jen aktivujeme to, co už máme.

---

### 4C. ZK-Shark — matematický důkaz jako těžební práce

> ⚠️ *Toto je nejkomplexnější upgrade — plánovaný až po mainnetu (v3.0.x).*

#### Co je ZK důkaz? (pro lajky)

> 🔐 *ZK = Zero-Knowledge = Nulová znalost*  
> Je to matematická magie: dokážeš někomu, že znáš správnou odpověď, **aniž bys mu tu odpověď prozradil/a**.  
>  
> Příklad z reálného světa:  
> Chceš dokázat bance, že máš víc než milion korun, ale nechceš ukázat výpis z účtu. ZK důkaz ti to umožní — banka dostane matematický důkaz, ale nevidí čísla.

#### Jak ZK funguje v těžení?

Normálně: těžař hledá nonce (číslo), jehož hash splní podmínku. To jde ověřit za milisekundu.

ZK-Shark: těžař **vygeneruje matematický důkaz**, že provedl správně dopředný průchod neuronovou sítí. Pool ověří důkaz 40–600× rychleji, než ho těžař vytvořil.

```
Blok header + Nonce
        │
        ▼
  Těžař: DOKAŽTE(
    neuronová_síť(vstup, nonce) == tvrzený_výstup,
    model = zkml_model_v1
  )
        │
        ▼
  ZK Důkaz (~200 bajtů, obsahuje: „opravdu to spočítali správně")
        │
        ▼
  Pool: ověří důkaz za 5–50 ms
        PLUS hash(veřejné_vstupy_důkazu) < obtížnost
        │
        ▼
  Platný share → kandidát na blok
```

#### Proč je to revoluční?

| | Standardní PoW | ZK-Shark |
|--|--|--|
| Těžební práce | Hledání náhodného nonce | Generování ZK důkazu |
| Ověření | Okamžité (hash) | 5–50 ms, ale práce má smysl |
| Energetická efektivita | Vše promarněno | Práce = AI výpočet |
| Odolnost vůči ASIC | Střední | Vysoká (ZK obvody jsou extrémně drahé) |
| Decentralizace | CPU/GPU friendly | GPU + NPU friendly |

#### Co budeme potřebovat technicky?

- **ezkl** — Rust knihovna pro ZK důkazy neuronových sítí (projekt zkonduit)
- **Halo2** — kryptografický systém důkazů (bez nutnosti důvěryhodného nastavení)
- Upravený validátor v poolu
- On-chain ověřování ZK důkazů v L1/core

---

## 5. Jaký hardware to využije?

### Pro NPU Mixing (Fáze A)

| Zařízení | NPU čip | Od kdy | Výkon |
|----------|---------|--------|-------|
| MacBook / iMac (M1+) | Apple Neural Engine | 2020+ | 11–38 TOPS |
| iPhone 15 Pro / iPad Pro | Apple ANE | 2023+ | 35+ TOPS |
| Laptop s Intel Core Ultra | Intel NPU | 2024+ | 10–13 TOPS |
| Laptop s AMD Ryzen AI | AMD XDNA | 2023+ | 10–16 TOPS |
| Snapdragon 8 Gen 3 telefony | Qualcomm Hexagon | 2024+ | 45 TOPS |
| NVIDIA RTX 4000+ | Tensor Cores | 2022+ | 200+ TOPS |
| Jakýkoliv počítač | CPU záloha | vždy | funguje |

> 💡 *TOPS = biliónů operací za sekundu — míra výkonu AI čipu*

### Pro ZK Shark (Fáze C)

| GPU karta | Odhadovaná rychlost důkazu |
|-----------|--------------------------|
| RTX 4090 | 1–4 sekundy za důkaz |
| RTX 3090 | 3–8 sekund za důkaz |
| RX 7900 XTX | 5–12 sekund (ROCm) |
| Apple M3 Max | 8–20 sekund (Metal) |

---

## 6. Co se musí změnit v kódu?

### Fáze A — CHv4 NPU (střední složitost)

```
L1/cosmic-harmony/
├── Cargo.toml              → přidej feature "native-npu" a crate "ort"
├── models/
│   └── ch_mixing_v4.onnx   → vytvoř a vlož INT8 ONNX model
├── src/
│   ├── algorithms_npu.rs   → NOVÝ soubor: NpuMixer třída
│   ├── algorithms_opt.rs   → přidej funkci cosmic_harmony_v4()
│   ├── engine.rs           → přidej variantu CosmicHarmonyV4
│   └── lib.rs              → zpřístupni nový modul

L1/miner/
└── src/mining_loop.rs      → volá CHv4 nebo CHv3 podle konfigurace

L1/pool/
└── src/shares/validator.rs → ověřuj CHv4 sharey (stejná logika, jiná verze)
```

### Fáze B — NCL PoUW (nízká složitost — základ existuje)

```
L3/ncl/src/task.rs          → přidej typ NclShare, konverze z NclTask
L3/ncl/src/proof.rs         → NOVÝ soubor: hash-based důkaz pro NCL výsledek
L1/miner/src/ncl/           → aktivuj existující stub
L1/pool/src/shares/         → přidej validate_ncl_share() větev
```

### Fáze C — ZK-Shark (vysoká složitost, post-mainnet)

```
L3/ai-native/src/zkml_registry.rs   → NOVÝ: registr zkML modelů + ověřování hashe
L1/cosmic-harmony/src/zk_share.rs   → NOVÝ: typ ZkShare, verify_zk_proof()
L1/pool/src/shares/validator.rs     → přidej validate_zk_share() větev
L1/miner/src/zk_prover.rs          → NOVÝ: ezkl generátor důkazů
L1/core/src/consensus/zk.rs        → NOVÝ: on-chain validace ZK důkazů
```

---

## 7. Postupný plán — kdy a jak?

### Fáze A — CHv4 NPU Mixing (cíl: v2.10.x)

**Složitost:** Střední  
**Fork:** ANO — změna algoritmu vyžaduje hard fork  
**Trvání:** 3–5 týdnů práce

```
Týden 1: Natrénovat ch_mixing_v4.onnx model, INT8 kvantizace, spočítat hash
Týden 2: Implementovat NpuMixer (Rust crate ort), CPU záložní cesta
Týden 3: Zapojit do cosmic_harmony_v4() pipeline
Týden 4: Benchmarky NPU vs CPU, testy deterministiky
Týden 5: Integrace do pool validátoru, testnet fork
```

**Podmínky přijetí:**
- [ ] CPU i NPU cesta dávají **identický výstup** (INT8 determinismus)
- [ ] Zpomalení: CHv4 max o 500 mikrosekund pomalejší než CHv3 na jeden hash
- [ ] Pool správně ověřuje CHv4 sharey
- [ ] Hash modelu odpovídá genesis konstantě ve všech test vektorech
- [ ] Testnet stabilní po 2000+ bloků

---

### Fáze B — NCL PoUW (souběžně s fází A)

**Složitost:** Nízká (stub existuje)  
**Fork:** NE — nový typ share, zpětně kompatibilní  
**Trvání:** 2–3 týdny práce

```
Týden 1: Definovat formát NclShare, implementovat NclTask → NclShare
Týden 2: Pool validátor: validate_ncl_share() + formule ekvivalence obtížnosti
Týden 3: Test integrace s NCL marketplace, účetnictví výnosů
```

**Podmínky přijetí:**
- [ ] NCL sharey pool akceptuje spolu se standardními PoW sharey
- [ ] Výnosy správně rozděleny (85/10/5)
- [ ] Formule ekvivalence obtížnosti brání zneužití

---

### Fáze C — ZK-Shark (cíl: v3.0.x, po mainnetu)

**Složitost:** Vysoká  
**Fork:** ANO — vyžaduje konsensuální ZK ověřovač  
**Trvání:** 3–6 měsíců práce

```
Měsíc 1: Integrace ezkl, benchmark rychlosti důkazu pro různé velikosti modelu
Měsíc 2: Definice zkml_v1.onnx (malý model = rychlé důkazy), formát ZkShare
Měsíc 3: Pool-side fast_verify() implementace
Měsíc 4: On-chain validace ZK důkazů v L1/core
Měsíce 5–6: Testnet nasazení, kalibrace obtížnosti
```

**Podmínky přijetí:**
- [ ] Ověření důkazu ≤ 50 ms na běžném pool serveru
- [ ] Generování důkazu ≤ 15 sekund na RTX 3090
- [ ] ZK share formule obtížnosti dává ekvivalentní tempo bloků jako PoW sharey
- [ ] Žádné trusted setup (pouze Halo2 / STARKs)

---

## 8. Jak to ovlivní síť a fork?

### Co je hard fork? (pro lajky)

> 🍴 *Hard fork = „rozvětvení" blockchainu*  
> Když se změní pravidla hry natolik, že staré verze softwaru nové bloky odmítají, říkáme tomu hard fork.  
>  
> Příklad: Bitcoin Cash je hard fork Bitcoinu — část komunity nesouhlasila s pravidly a šla si vlastní cestou.  
>  
> ZION fork chceme provést **koordinovaně** — s hlasováním těžařů, konkrétní výškou bloku aktivace a dlouhým přechodovým oknem.

### Fork pravidla pro CHv4

Podle ZION MainNet Ústavy:
- Hard fork vyžaduje: **>66 % hash rate hlasuje PRO** (signál v coinbase datech bloku)
- Okno pro upgrade: **2016 bloků** (~2 týdny při 10 minutách/blok)
- Záchranná brzda: **CHv3 záložní režim** dostupný prvních 10 080 bloků po forku

### Verze nového konfiguračního souboru

```toml
# config/mainnet.toml (budoucí doplnění)
[consensus]
algorithm_version = 4                  # upgrade z 3
chv4_activation_height = TBD           # výška bloku aktivace CHv4
chv4_model_hash = "sha3:..."           # hash ch_mixing_v4.onnx
npu_fallback_enabled = true            # CPU záloha povolena

[ncl_share]
ncl_share_enabled = false              # Fáze B: zapnout až po stabilizaci Fáze A
ncl_difficulty_multiplier = 1.0        # ekvivalence obtížnosti NCL vs PoW

[zk_share]
zk_share_enabled = false               # Fáze C: jen experimentální
zkml_model_hash = ""
zk_proof_system = "halo2"
```

---

## 9. Bezpečnost — co může jít špatně?

### Fáze A — NPU Mixing

| Útok / Problém | Jak se bráníme |
|----------------|---------------|
| Někdo podvrhne jiný ONNX model | Hash modelu je v genesis bloku → jakákoliv změna = neplatný blok, síť odmítne |
| NPU dá jiný výsledek než CPU | Používáme INT8 (celá čísla) → žádné plovoucí desetinné odchylky → vždy stejný výsledek |
| Někdo přeskočí NPU krok | CPU záloha dá **stejný výsledek** → žádná výhoda z přeskočení |
| Bezpečnostní chyba v ONNX Runtime | Model je jednoduchá lineární transformace → žádné volání internetu, žádný side-channel |

### Fáze B — NCL PoUW

| Útok / Problém | Jak se bráníme |
|----------------|---------------|
| Těžař pošle falešný výsledek AI úlohy | `hash(task_id + výsledek)` musí splnit obtížnost → falešný výsledek nemůže splnit podmínku |
| Útok DOS na NCL marketplace | Pool přijímá jen NCL úlohy s task_id vydaným ověřeným smart kontraktem |
| Těžař hledá lehké NCL úlohy | Minimální obtížnost + task_id obsahuje nonce od ZION sítě → přes výběr task_id nelze podvádět |

### Fáze C — ZK-Shark

| Útok / Problém | Jak se bráníme |
|----------------|---------------|
| Matematická slabina v ZK systému | Používáme Halo2 — prověřený systém (Zcash heritage), nezavedujeme vlastní kryptografii |
| Nutnost „důvěryhodného nastavení" (trusted setup) | Halo2 a STARKs nepotřebují žádné trusted setup |
| Ověření je příliš pomalé | Měříme benchmarky ≤50 ms → pokud nedosáhneme, Fázi C neaktivujeme |
| Někdo použije jiný model | Hash modelu je součástí každého ZK sharee → pool odmítne nesprávný model |

---

## 10. Rizika a jak jim předejít

| Riziko | Pravděp. | Dopad | Prevence |
|--------|----------|-------|----------|
| NPU INT8 determinismus selže napříč výrobci | Střední | Vysoký | Rozsáhlá testovací sada na Apple/Intel/AMD/Qualcomm; CPU záloha vždy dostupná |
| Bezpečnostní chyba v ONNX Runtime | Nízká | Vysoký | Sandboxovaná inference; žádné síťové volání z modelu |
| CHv4 adopce příliš pomalá → split blockchainu | Střední | Kritický | Dlouhé aktivační okno (2016 bloků); >66 % práh |
| Špatně nastavená ekvivalence obtížnosti NCL | Střední | Střední | Konzervativní počáteční multiplikátor; měkce nastavitelné přes governance |
| ZK důkaz příliš pomalý → těžaři odchází | Vysoká (Fáze C) | Vysoký | Fáze C striktně experimentální dokud ≤15 s prove time nebude ověřeno |
| ezkl spotřebovává příliš mnoho GPU paměti | Střední | Střední | Limit GPU paměti pro ZK; dedikovaný ZK-mining režim |

---

## Shrnutí pro lajky — co to celé znamená?

```
Dnešní ZION (CHv3):
  Těžíš → počítač hledá číslo → dostaneš ZION
  Extra bonus: vedlejší produkty jdou do ETC/Nexus poolu

Zítřejší ZION (CHv4):
  Fáze A: Tvůj AI čip (NPU) se zapojí do výpočtu → moderní hardware má výhodu
  Fáze B: Tvůj počítač zpracovává AI úlohy pro zákazníky → těžíš + vyděláváš navíc
  Fáze C: Těžíš = generuješ matematický důkaz = děláš skutečnou AI práci
           → energie není promarněná, algoritmus je nejobtížnější na ASIC
```

**Výsledek:** ZION bude první blockchain, kde těžení:
1. Zapojuje moderní AI hardware (NPU)
2. Vytváří reálnou hodnotu (AI inference pro zákazníky)
3. Je matematicky nejodolnější vůči centralizaci (ZK důkazy)

---

## Technické reference

### Interní dokumenty
- [Technická dokumentace (EN)](COSMIC_HARMONY_V4_UPGRADE.md) — plná anglická verze s kódovými skeletons
- [L1-L4 Roadmap](L1-L4_ROADMAP.md) — celková architektura vrstev
- [ZK-Shark poznámky](../Zkshark.md) — původní návrhy z ztracené konverzace

### Externí zdroje
- **ezkl** (ZK důkazy pro neuronové sítě): https://github.com/zkonduit/ezkl
- **ONNX Runtime** (AI inference na NPU): https://onnxruntime.ai
- **Halo2** (ZK kryptografie bez trusted setup): https://github.com/zcash/halo2
- **Modulus Labs** (průkopníci zkML): https://www.modulus.xyz

---

*Tento dokument je živá specifikace. Všechny detaily implementace podléhají změnám na základě benchmarků, hlasování komunity a bezpečnostního auditu.*

*Poslední aktualizace: 28. 2. 2026 | ZION Core Team*
