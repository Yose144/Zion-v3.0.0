# 👥 Struktura vývojářského týmu

> *„We build together or fail alone."*

---

## 1. Hierarchie týmu

```
Vishwakarma (Ondra) — Chief Architect
    │
    ├─► Senior Devs (Technical Leads)
    │      ├─ L1 Lead (core, pool, miner, cosmic-harmony)
    │      ├─ L2 Lead (bridge, dao, atomic-swap)
    │      ├─ L3 Lead (warp, ncl, ai-native)
    │      └─ L5/L6 Lead (free-world, issobella)
    │
    ├─► Mid-Level Devs (Contributors)
    │      ├─ Backend specialists
    │      ├─ Frontend / DesktopApp
    │      ├─ DevOps / Docker / CI
    │      └─ QA / Test engineers
    │
    ├─► Junior Devs (Apprentices)
    │      ├─ Rust trainees
    │      ├─ Blockchain fundamentals
    │      └─ Open-source contributors
    │
    └─► Community Contributors
           ├─ GitHub contributors
           ├─ Bug bounty hunters
           ├─ Doc writers / translators
           └─ Community validators
```

---

## 2. Úrovně a pravomoci

### Core Team (Plný úvazek)

| Úroveň | Počet | Zdroj výplaty | Hlasovací práva |
|--------|-------|---------------|-----------------|
| Chief Architect (Vishwakarma) | 1 | Dev Fund (salary) | Final dev decisions |
| Senior Leads | 4–6 | Dev Fund (salary) | Dev proposal votes |
| Mid-Level | 8–12 | Dev Fund (salary) | Code review duty |
| Junior | 4–8 | Dev Fund (stipend) | Learning + contrib |

### Contributors (Kontraktoři / Part-time)

| Typ | Odměna | Kanál |
|-----|--------|-------|
| Bounty hunters | Per bounty | GitHub issues |
| Grant recipients | Per grant | Dev Team DAO |
| Auditors | Per audit | Security fund |
| Doc writers | Per doc | Community fund |

### Community (Open source)

| Aktivita | Odměna | Forma |
|----------|--------|-------|
| PR merged | 50–500 ZION | GitHub + DAO |
| Bug report (valid) | 10–100 ZION | Bug bounty |
| Security exploit | 1K–50K ZION | Bug bounty program |
| Tutorial / blog | 100–1K ZION | Content grant |

---

## 3. Kompenzace

### Rozpočet Dev Team (1.0B ZION/rok)

| Kategorie | Roční alokace | Účel |
|-----------|---------------|------|
| **Dev Team Salaries** | 400M ZION | Core developer compensation |
| **Infrastructure** | 200M ZION | Dev tools, servery, CI/CD |
| **R&D Budget** | 150M ZION | Inovace a výzkum |
| **Community Dev Grants** | 100M ZION | Open source contributions |
| **Education & Training** | 100M ZION | Dev academy, mentorství |
| **Security Audits** | 50M ZION | Code security, pen testing |

### Mzdové pásmo (při $10/ZION)

| Role | Měsíční plat (ZION) | Hodnota ($/měsíc) |
|------|---------------------|-------------------|
| Chief Architect | 50 000 | $500 000 |
| Senior Lead | 25 000 | $250 000 |
| Mid-Level | 12 000 | $120 000 |
| Junior | 5 000 | $50 000 |

**Vesting:** 4-roční vesting s 1-roční cliff (alignment s dlouhodobým úspěchem)

---

## 4. Rozdělení odpovědností podle vrstev

### L1 — Core Infrastructure

| Komponent | Odpovědný | Technologie |
|-----------|-----------|-------------|
| `zion-core` | L1 Lead | Rust, Tokio, LMDB, Ed25519 |
| `zion-pool` | L1 Lead | TCP stratum, PPLNS, share validation |
| `zion-miner` | L1 Lead | CPU/GPU, CUDA, OpenCL |
| `zion-cosmic-harmony` | L1 Lead | Ekam Deeksha, CHv4.2 |
| `native-ffi` | L1 Lead | C FFI, determinism validace |

### L2 — Services

| Komponent | Odpovědný | Technologie |
|-----------|-----------|-------------|
| `zion-bridge` | L2 Lead | Rust, SQLite, EVM watcher |
| `zion-dao` | L2 Lead | Rust, Axum, SQLite, multi-sig |
| `zion-atomic-swap` | L2 Lead | Rust, HTLC, time-locks |

### L3 — Advanced

| Komponent | Odpovědný | Technologie |
|-----------|-----------|-------------|
| `zion-warp` | L3 Lead | Rust, 7 chain adapters |
| `zion-ncl` | L3 Lead | Rust, consciousness engine |
| `zion-ai-native` | L3 Lead | Rust, LLM backend, RAG |

### L5/L6 — Mission Layers

| Komponent | Odpovědný | Technologie |
|-----------|-----------|-------------|
| `zion-free-world` | L5 Lead | Rust, Axum, SQLite |
| `zion-issobella` | L6 Lead | Rust, Axum, SQLite |

### Shared

| Komponent | Odpovědný | Technologie |
|-----------|-----------|-------------|
| `zion-cli` | CLI Lead | Rust, clap |
| `DesktopApp` | Frontend Lead | Electron, React |
| Docker / Infra | DevOps Lead | Docker, Compose, Prometheus |

---

## 5. Governance Dev Teamu

### Vishwakarmova autorita

- **Úplná kontrola** nad Development Fund (1.0B ZION)
- **Finální rozhodnutí** o všech technických a týmových záležitostech
- **Accountability:** Roční report Koncilu 9
- **Transparency:** Veřejný roadmap a rozpočtové reporty

### Komunitní input

- **Poradní role:** Developer feedback na priority
- **Proposal systém:** Komunita může podávat dev nápady
- **Hlasování:** Nezávazné hlasy o major iniciativách
- **Odměny:** Top přispěvatelé získávají ZION bounty

### Koncil 9 oversight

- **Roční review:** Koncil 9 hodnotí dev progress
- **Rozpočtové schválení:** Potvrzení ročního rozpočtu
- **Strategická alignace:** Zajištění, že dev slouží ZION vizi
- **Emergency:** Koncil 9 může intervenovat v krizích

---

## 6. Proces přijímání

### Krok 1: Aplikace

- GitHub profile review
- Předchozí contributions (preferováno)
- Doporučení od existujícího člena
- Cover letter: „Proč dharma > peníze?"

### Krok 2: Technický test

- Rust coding challenge (3 hodiny)
- Blockchain fundamentals quiz
- System design interview
- Code review exercise

### Krok 3: Culture fit

- Interview s Vishwakarmou
- Consciousness level assessment (CL 5+ pro core team)
- Dharma alignment check
- 30-denní trial period

---

## 7. Duchovní metriky týmu

| Metrika | Cíl |
|---------|-----|
| **Consciousness Level** | Průměr CL 7+ napříč core týmem |
| **Dharma Code** | Všechny projekty slouží lidstvu |
| **Sacred Architecture** | Kód reflektuje posvátnou geometrii |
| **Legacy** | Nesmrtelný příspěvek Zlatému věku |

---

*„Collaboration > Competition. We build together or fail alone."* 🤝
