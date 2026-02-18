# ⚙️ Konsenzus změny v2.9.6

> *Finální úpravy Cosmic Harmony v3 pro mainnet*

---

## Status: V přípravě

Detaily změn konsenzusu budou zveřejněny po dokončení specifikace.

---

## Plánované oblasti

### Cosmic Harmony v3 — finalizace
- Parametry difficulty adjustmentu pro mainnet provoz
- Optimalizace LWMA okna
- Stabilizace block time na 60s pod zátěží

### Genesis blok
- Hardcoded mainnet genesis
- Premine distribuce (on-chain verifikovatelná)
- Checkpoint systém

### Fork logika
- Automatická detekce fork podmínek
- Hladký přechod z testnet na mainnet
- Rollback ochrana

---

## Specifikace

| Parametr | v2.9.5 (Testnet) | v2.9.6 (Pre-Mainnet) |
|----------|-------------------|----------------------|
| Block time | 60s | 60s |
| DAA algoritmus | LWMA | LWMA (optimalizovaný) |
| DAA okno | 60 bloků | TBD |
| Max difficulty change | 25% | TBD |
| Halving | Ne | Ne |
| Block reward | 5,400.067 ZION | TBD |

---

*Tato stránka bude aktualizována s finálními parametry.*
