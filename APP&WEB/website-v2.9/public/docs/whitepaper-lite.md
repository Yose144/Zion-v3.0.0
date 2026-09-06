# Whitepaper Lite — ZION TerraNova v2.9.9 public line

Rychle shrnuti aktualni verejne komunikovane ZION linie bez toho, aby se rehearsal runtime zaměnoval za spusteny mainnet.

---

## Co je ZION dnes

ZION je nativni Rust Proof-of-Work protokol s verejne pristupnym **V3 test-mainnet rehearsal** runtime. Aktualni public surface je vedena pres release linii **v2.9.9 Pure Code** na kanonicke runtime baze **v2.9.8**.

To znamena:

- verejny web, explorer, RPC a mining vstupy jsou online,
- sit slouzi jako kontrolovany rehearsal runtime,
- verejny mainnet launch jeste neprosel vsemi closure gate podminkami.

---

## Verejne parametry

| Parametr | Hodnota |
|----------|---------|
| Celkova emise | 144 000 000 000 ZION |
| Mining supply | 127 220 000 000 ZION |
| Premine | 16 780 000 000 ZION |
| Block time target | 60 sekund |
| Fee policy | Burn |
| Aktualni public runtime | CHv3-line rehearsal |
| Final public launch consensus | stale open |

---

## Architektura v jedne minute

- **Core**: Rust runtime, LMDB storage, Ed25519 wallet flow
- **P2P**: libp2p sit s verejnym primary hostem a internimi validator linkami
- **RPC / REST**: verejne endpointy pro explorer, tooling a monitoring
- **Mining**: verejny stratum pool pro CPU / Cosmic Harmony klienty
- **Docs / Ops**: live index, API reference, network status a monitoring povrch

---

## Public truth

Aktualni web a docs maji byt ctene takto:

- **ano**: controlled public rehearsal runtime,
- **ano**: aktivni verejne endpointy a binarky,
- **ne**: spusteny verejny mainnet,
- **ne**: uzavreny launch gate proces.

Public launch zustava **NO-GO**, dokud nejsou uzavreny audit, explorer evidence, wallet readiness a final launch konfigurace.

---

## Launch cesta

1. Stabilni rehearsal runtime.
2. Closure evidence a auditni material.
3. Finalni launch readiness package.
4. Az potom public mainnet genesis.

Cilove okno end-2026 zustava smer, ne potvrzeny live stav.

---

## Odkazy

- [Docs Hub](/docs)
- [Network Status](/network)
- [GitHub](https://github.com/Zion-TerraNova)
- [Web](https://www.zionterranova.com)
