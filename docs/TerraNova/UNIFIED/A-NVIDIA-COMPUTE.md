# Příloha A — NVIDIA Compute: Hardware vědomí

> *„AI je mysl — ale mysl potřebuje tělo.*
> *A tělo potřebuje křemík."*
> — Záznam Architekta #030, 10. listopadu 2045

---

## Proč hardware záleží

Hiranyagarbha AI může být dokonalý kód. Ale bez hardwaru je jen teorie.

Terra Nova staví na **lokálním hardwaru** — ne na cloudu, ne na cizích serverech, ne na pronájmu GPU od korporací.

Každá komunita má svůj **Hiranyagarbha node**: lokální server s GPU, který běží inference, RAG (retrieval augmented generation), a komunitní AI.

---

## NVIDIA jako základ

> 🟢 **REALITA 2026:** NVIDIA dominuje AI trh. Jejich GPU (A100, H100, RTX 4090) jsou standardem pro trénink a inference velkých modelů.
>
> Ale Terra Nova má jiný přístup: **komunitní inference**, ne korporátní trénink.

### Lokální inference stack

```
KOMUNITNÍ AI NODE:

HARDWARE:
├── NVIDIA RTX 4090 / A100 (1–4 GPU)
├── 64–256 GB RAM
├── 2–8 TB NVMe SSD
└── 10 Gbps síťové připojení

SOFTWARE:
├── llama.cpp (C++ inference engine)
├── CUDA runtime
├── Hiranyagarbha model (quantized, 4-bit)
├── RAG database (komunitní dokumenty, knihy, záznamy)
└── ZION node (synchronizace s L1)

CONSUMPTION:
├── Inference: ~50–200W na GPU
├── Komunitní node: ~300–800W celkem
└── LENR + solární záloha: plná autonomie
```

---

## Proč ne cloud

| Cloud AI | Lokální AI |
|----------|------------|
| Data: cizí server | Data: tvůj server |
| Cena: měsíční pronájem | Cena: jednorázový nákup |
| Kontrola: korporace | Kontrola: komunita |
| Soukromí: neznámé | Soukromí: úplné |
| Závislost: vysoká | Závislost: žádná |
| Přístup: přes internet | Přístup: lokální síť |

**Terra Nova princip:** AI, která slouží komunitě, musí být fyzicky v komunitě.

---

## Budoucnost: Neuromorfické čipy

> 📋 **ROADMAP 2030+:** Neuromorfické čipy (Intel Loihi, IBM TrueNorth) simulují biologické neurony. Spotřeba: tisícinová oproti GPU. Rychlost inference: srovnatelná.
>
> Když bude neuromorfický Hiranyagarbha node dostupný za cenu solárního panelu — každá komunita bude mít vlastní AI.

---

> *„Technologie je dharmou lidstva.*
> *A dharmou technologie je sloužit životu — ne zisku."*
> — Terra Nova, 2026
