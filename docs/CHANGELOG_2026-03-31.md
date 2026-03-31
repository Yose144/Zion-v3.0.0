# Changelog — 2026-03-31

## Souhrn

Tři infrastrukturní a kódové změny provedeny během aktivního 72h V3 rehearsalu.

---

## 1. Pool + Miner nasazen na USA node (5.78.194.94)

**Problém:** Mining běžel pouze na Prague (SPOF — single point of failure).  
**Řešení:**
- Přidán 2GB swap na USA server (`fallocate -l 2G /swapfile`)
- Upravena funkce `resolve_services()` v `scripts/deploy-v3-mainnet.sh`:
  `primary|us` nyní vrací `"core seed1 pool miner redis"`
- Nasazen pool + miner + redis na USA (`docker compose up -d pool miner redis`)

**Stav po nasazení:**
- 5 kontejnerů běží: `zion-core`, `zion-seed-1`, `zion-pool`, `zion-miner`, `zion-redis`
- Pool health: `healthy`, 1 aktivní miner
- RAM: 1.7G/1.9G used + 2G swap (161MB swap used)
- Chain v plném agreement s Prague a Singapore

**Soubory změněny:**
- `scripts/deploy-v3-mainnet.sh` — `resolve_services()` a `expected_container_floor()` pro `us`

---

## 2. Exit Criteria formalizovány (v1.1 → v1.2)

**Problém:** Dokument `MAINNET_EXIT_CRITERIA.md` byl DRAFT bez live evidence.  
**Řešení:**
- Closure checklist A–D vyplněn s live daty ze všech 3 nodů
- Restart klasifikace: Prague 0 restartů, USA+SG po 1 plánovaném upgradu
- Pool stats: 4763 accepted / 37 rejected (0.77% reject rate ✓)
- Divergence: max 1 blk transient, steady-state 0 ✓
- Stav změněn z `DRAFT` na `FORMALIZED`
- Předběžný verdikt: **AMBER** (72h window nedoběhlo + BFG pending)

**Zbývající blokátory:**
1. 72h window nedokončeno
2. BFG scrub private keys z git historie
3. Grafana orphan rate dashboard
4. Genesis ceremony offline
5. Whitepaper finální verze

**Soubory změněny:**
- `docs/mainnet/MAINNET_EXIT_CRITERIA.md` — verze 1.2, formalized

---

## 3. Persistent P2P connections (OutboundPool)

**Problém:** Každý P2P message = nové TCP spojení (`p2p_roundtrip()` creates new TcpStream every call).
Při 3 peerech a 30s cyklu to znamená 6+ TCP handshakes/cyklus jen pro ping+status, plus discovery a IBD.

**Řešení:**
- Nové struktury `PeerConn` a `OutboundPool` v `V3/L1/core/src/bin/node.rs`
- `OutboundPool` udržuje persistentní TCP spojení per peer
- Automatický reconnect: při chybě se stará konexe eviktuje a vytvoří nová
- Outbound loop (`Ping`, `GetStatus`, `GetPeers`, `IBD RequestBatch`) nyní používá `pool.roundtrip()`
- Relay threads (`relay_block_to_peers`, `relay_tx_to_peers`) a `sync_from_peer` zůstávají na ephemeral `p2p_roundtrip()` (fire-and-forget z threadů)

**Dopad:**
- TCP handshakes per cyklus klesnou z ~6-10 na ~0 (pro živé peery)
- Latence heartbeatu a status pollingu výrazně nižší
- Bloky se budou propagovat rychleji díky rychlejšímu stavu awareness

**Kompilace:** ✅ `cargo test --no-run -p zion-core` — úspěch (jen 1 warning: `evict` unused)

**Soubory změněny:**
- `V3/L1/core/src/bin/node.rs` — přidány `PeerConn`, `OutboundPool`, import `HashMap`; 5 callsites přepsány z `p2p_roundtrip()` na `pool.roundtrip()`

---

## Souhrn živých dat (snapshot 2026-03-31 ~15:00 UTC)

| Node | Height | Tip Hash | Started | Restarts | Pool |
|------|--------|----------|---------|----------|------|
| Prague | 5104 | `0001c143…9b65` | 2026-03-29T12:05 | 0 | 4763 acc / 37 rej |
| USA | 5105 | `0000dee0…3fa5` | 2026-03-30T15:32 | 1 (planned) | Fresh (31.3.) |
| Singapore | 5105 | `0000dee0…3fa5` | 2026-03-30T12:30 | 1 (planned) | — |

---

*Autor: Copilot + Yeshua | Datum: 2026-03-31*
