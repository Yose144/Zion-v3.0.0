# ZION v3.0.0 — MainNet Ready

> **Stav:** Mainnet readiness release
> **Datum:** květen 2026
> **Účel:** Docker, systemd, fee split, genesis freeze, Edge topologie příprava

---

## Co je 3.0.0

v3.0.0 byl **MainNet Ready** milník. Veškerý L1 konsenzus kód byl zamrzl, genesis parametry uzamčeny a operační infrastruktura připravena na Genesis Launch.

### Klíčové deliverables

- ✅ **Docker Compose profily** — `dev`, `mainnet`, `monitoring`
- ✅ **systemd jednotky** — hardened service definice pro Edge
- ✅ **Fee split 89/5/5/1** — konstituční on-chain vymáhání
- ✅ **Genesis freeze** — neměnný genesis blok, 13 premine outputů
- ✅ **Edge topologie** — Core + Edge dvouvrstvá architektura
- ✅ **Bridge mainnet** — wZION, ZIONBridge, ZIONAtomicSwap na Base
- ✅ **DAO governance** — životní cyklus návrhů, hlasování, treasury
- ✅ **Unified CLI** — `zion` operátor CLI s L1/L2/L3 příkazy
- ✅ **Healthchecks** — všechny služby s proper monitoring
- ✅ **Non-root kontejnery** — security-hardened Docker setup

---

## Architektura

```
Core (autoritativní):
  L1 node, konsenzus, kanonický chain state

Edge (operační):
  L1 node (sync)
  Pool server
  Bridge relay
  DAO governance daemon
  WARP bridge
  Atomic swap koordinátor
  Monitoring / metriky
```

**Edge server:** `77.42.71.94`
**Local dev:** `100.86.102.5` (Windows 11)

---

## Dokumenty

- [Plán upgradu na v3.0.1](./UPGRADE_3.0.1_PLAN.md)
- [Edge Primary Topologie](./EdgePrimary.md)
- [V3 Workspace README](https://github.com/Zion-TerraNova/2.9.6/tree/main/V3/README.md)

---

*ZION TerraNova v3.0.0 MainNet Ready • aktualizováno květen 2026*
