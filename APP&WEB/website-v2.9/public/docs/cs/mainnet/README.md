# Verejna launch cesta 2026 — ZION TerraNova

**Aktualni verejny stav:** kontrolovany V3 test-mainnet rehearsal  
**Public launch:** NO-GO, dokud nejsou uzavreny launch gate dukazy  
**Aktivni verejny runtime:** v2.9.9 Pure Code nad kanonickou runtime linii v2.9.8

---

## Co je verejne live dnes

- Verejny primary host v Praze pro web, explorer, RPC a stratum
- Interni validacni linky USA + Singapore pro quorum a rehearsal synchronizaci
- Verejny pool endpoint pro mining klienty
- Verejna dokumentace, live index, health endpointy a monitoring povrch
- Archivovana release linie 2.9.7 -> 2.9.8 -> 2.9.9 jako auditni stopa

To znamena, ze ZION ma **verejne pristupny rehearsal runtime**, ne spusteny verejny mainnet.

---

## Co jeste neni uzavrene

Nasledujici body zustavaji gate podminky pred verejnym launch:

| Gate | Stav | Poznamka |
|------|------|----------|
| Externi audit L1 / runtime | OPEN | Verejne publikovatelny auditni zaver zatim chybi |
| Explorer closure evidence | OPEN | Verejna funkcnost musi zustat dolozena bez mock path |
| Wallet distribution readiness | OPEN | Finalni verejne wallet delivery flow jeste neni uzavren |
| CHv4 / final consensus path | IN PROGRESS | Verejna launch verze neni finalizovana |
| Independent miner / node evidence | OPEN | Potrebna sirsi externi operacni validace |
| Listing readiness package | IN PROGRESS | CoinGecko / CMC material se stale cisti |
| Launch governance / constitution closure | OPEN | Public launch potrebuje uzavreny governance frame |

Dokud jsou tyto body otevrene, launch zustava **NO-GO**.

---

## Verejna launch sekvence

1. Udrzet stabilni rehearsal runtime a sbirat closure evidence.
2. Uzavrit audit, explorer, wallet a operacni gate podminky.
3. Finalizovat verejne publikovatelnou launch konfiguraci.
4. Teprve potom otevrit public mainnet genesis a launch event.

End-2026 zustava **cilove okno**, ne hotovy slib ani aktivni stav.

---

## Parametry, ktere jsou dnes verejne komunikovane

| Parametr | Verejny stav |
|----------|--------------|
| Celkova emise | 144 000 000 000 ZION |
| Mining supply | 127 720 000 000 ZION |
| Premine | 16 280 000 000 ZION |
| Block time | 60 s target |
| Fee policy | burn |
| Aktualni verejny runtime | CHv3-line public rehearsal |
| Final public launch consensus | jeste neuzavreno |

Tyto parametry jsou soucasti verejneho launch materialu, ale **neznamenaji, ze mainnet uz bezi**.

---

## Jak cist aktualni web

- `/docs#live-index` = aktualni public snapshot a release matrix
- `/network` = ziva topologie rehearsal runtime
- `/download` = aktualni binarky kompatibilni s verejnou linii
- `/api-reference` = verejny RPC / REST povrch

Historicke multi-host rollouty a drivejsi testnet framing zustavaji v archivnich release dokumentech, ne jako tvrzeni o dnesnim produkcnim stavu.

---

*Viz take: [Docs Hub](/docs) · [Network Status](/network) · [API Reference](/api-reference)*