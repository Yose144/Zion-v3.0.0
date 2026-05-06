# ZION TerraNova v2.9 — „Quantum Leap“

> **Éra: říjen – prosinec 2025 · Stav: Legacy (nahrazeno v2.9.5)**
> **Poznámka archivu:** stránka zůstává jako historický snímek Python éry a nepopisuje současnou veřejnou launch bránu ani aktuální provozní topologii.

v2.9 „Quantum Leap“ byla první vícevrstvá, víceuzlová TestNet éra ZION. Běžela na Python/FastAPI stacku a ustavila architektonickou vizi, která definovala všechny pozdější verze.

---

## Co bylo v2.9

v2.9 nebylo jediné vydání — byl to vývojový blok od října do prosince 2025 s podverzemi v2.9.0 až v2.9.4. Klíčový milník byl **první provozní multi-node TestNet** se živou těžbou.

### Technologický stack (éra v2.9)

| Komponenta | Technologie |
|------------|-------------|
| Jádro blockchainu | Python 3.11 (src/core/) |
| API server | FastAPI (Python) |
| Mining pool | Python (Stratum v2) |
| Web | Next.js (TypeScript) |
| Databáze | SQLite / v paměti |
| Kontejnerizace | Docker Compose |
| Monitoring | Prometheus + Grafana |
| Reverse proxy | Nginx |

### Infrastruktura

```
Internet
    │
    ├─ Port 80/443 → NGINX
    │      ├─ / → statický web (Next.js)
    │      ├─ /api/ → FastAPI (Python)
    │      ├─ /pool/ → statistiky poolu
    │      └─ /grafana/ → Grafana
    │
    └─ Port 3333 (Stratum) → Mining pool

Docker síť (zion-internal):
    ├─ blockchain  (RPC: 8545, P2P: 18081)
    ├─ pool        (Stratum: 3333, stats: 8080)
    ├─ api         (8001)
    ├─ redis       (6379)
    ├─ prometheus  (9090)
    └─ grafana     (3000)
```

---

## Klíčové milníky éry v2.9

### Říjen 2025 — start „Quantum Leap“
- vydání v2.9.0, navazuje na Python základ v2.8.9
- první produkční Docker stack s health checky
- nasazen block explorer
- artikulovaný návrh P2P napříč regiony

### Listopad 2025 — GPU těžba a multi-node
- přidána podpora GPU těžby (OpenCL)
- zdokumentována první 2 MH/s GPU session
- funkční sync P2P mezi více uzly
- kritický bug v emisi opraven (v starším kódu byl špatně spočítaný total supply → opraveno na tvrdý strop 144B)
- implementován PPLNS výplatní systém poolu

### Prosinec 2025 — závěr roku a rozhodnutí o přepisu
- reálný audit projektu (14. prosince 2025):
  - blockchain běžel, ale jen na genesis bloku
  - Python pool neběžel v produkci  
  - 76+ pahýlů `NotImplementedError` napříč kódem
  - backend presale byl připraven, ale nebyl publikován
- rozhodnutí: úplný Rust přepis v lednu 2026
- začíná vývoj v2.9.5 „Native Awakening“

---

## Algoritmus Cosmic Harmony ve v2.9

Linie CHv3 během éry v2.9:

| Podverze | Algoritmus | Poznámky |
|----------|-----------|----------|
| v2.9.0 | CHv1 (Python) | ~200 KH/s, proof-of-concept |
| v2.9.2 | CHv2 (Python + C vazby) | ~800 KH/s, lepší memory hardness |
| v2.9.4 | CHv2+ (GPU prototyp) | ~15 MH/s GPU, CUDA/OpenCL |

Návrh algoritmu byl koncem v2.9 zralý — struktura bloku, 4-fázový hash a parametry memory hardness byly ustavené. Ve v2.9.5 se změnil **implementační jazyk** (Python → Rust), ne návrh algoritmu.

---

## Odměna za blok (éra v2.9)

Na začátku v2.9 byla odměna za blok zkoumána v rámci tokenomiky. Matematická odvodnění:

```
MINING_EMISSION = 127 720 000 000 ZION
TOTAL_BLOCKS    = 23 652 000 (45 let × 525 600 bloků/rok)
BLOCK_REWARD    = 127 720 000 000 / 23 652 000 = 5 400,067 ZION
```

Tato hodnota 5 400,067 byla odvozená ve v2.9 a zůstala odměnou bloků přes v2.9.5. (v2.9.6 pak přidal Decade Decay nad tímto základem.)

Časná dokumentace v2.9 občas používala placeholder „50 ZION“ — to byl naivní odhad opravený po doladění celé matematiky zásoby.

---

## Přechod v2.9 → v2.9.5

Největší změna v historii ZION:

| Aspekt | v2.9 (prosinec 2025) | v2.9.5 (leden 2026) |
|--------|----------------------|---------------------|
| Jazyk | Python + FastAPI | 100 % Rust |
| Testy | ~400 (mnoho rozbitých) | 108 (všechny prošly) |
| NotImplementedErrors | 76+ | 0 |
| Těžba v produkci | ❌ neběžela | ✅ live |
| Pool v produkci | ❌ neběžel | ✅ live |
| Úložiště LMDB | ❌ SQLite/paměť | ✅ LMDB |
| Podpisy | smíšené ECDSA | jednotné Ed25519 |
| Řádků Rustu | 0 | ~15 245 |
