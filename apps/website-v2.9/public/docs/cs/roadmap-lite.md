# Roadmap Lite — launch readiness

**Aktualni verejny stav:** kontrolovany V3 test-mainnet rehearsal  
**Stav verejneho launchu:** NO-GO, dokud neni hotova closure evidence  
**Aktivni verejna linie:** v2.9.9 Pure Code nad kanonickym runtime v2.9.8

---

## K cemu tato roadmapa slouzi

Tato lite roadmapa je verejna zkracena verze launch cesty. Neni to slib, ze mainnet uz ma pevne stanovene zive datum. Popisuje poradi praci, ktere musi byt hotove pred jakymkoli rozhodnutim o verejnem launchi.

---

## Aktualni faze

ZION bezi jako **kontrolovany rehearsal runtime** s:

- jednim verejnym primarnim hostem pro web, explorer, RPC a pool ingress,
- internimi validacnimi linkami pro quorum a synchronizaci,
- verejnou dokumentaci, monitoringem a API povrchem,
- archivovanou release linii 2.9.7 -> 2.9.8 -> 2.9.9 jako auditni stopou.

To znamena verejne pristupny rehearsal runtime, ne deklarovany zivy public mainnet.

---

## Launch sekvence

### Faze 1 — stabilita rehearsal runtime

- udrzet kontrolovany runtime zdravy,
- drzet node, pool, explorer a telemetrii ve shode,
- sbirat runtime evidence a operacni vzorky.

### Faze 2 — closure evidence

- uzavrit externi audit,
- verejne dolozit explorer a API chovani,
- dokoncit wallet distribution readiness,
- dokoncit recovery a operacni evidence.

### Faze 3 — launch-readiness package

- zmrazit verejnou launch konfiguraci,
- publikovat closure report,
- potvrdit governance a listing-readiness material,
- rozhodnout, jestli se launch muze posunout z NO-GO na GO.

### Faze 4 — rozhodnuti o public mainnetu

- pokud jsou closure kriterie splnene, otevrit genesis a launch operace,
- pokud ne, pokracovat v rehearsal runtime a launch nevyhlasovat.

---

## Co zustava otevrene

| Oblast | Stav | Verejna poznamka |
|--------|------|------------------|
| Externi audit | OPEN | Zatim neni verejny close-out |
| Explorer closure evidence | OPEN | Verejny dukaz musi zustat aktualni |
| Wallet readiness | OPEN | Finalni distribucni flow neni uzavren |
| Finalni consensus / launch config | IN PROGRESS | Verejna launch verze neni zmrazena |
| Independent miner / node evidence | OPEN | Je potreba sirsi externi validace |
| Listing package | IN PROGRESS | CoinGecko / CMC material se jeste cisti |

Dokud tyto body zustavaji otevrene, verejny launch zustava **NO-GO**.

---

## Jak cist verejny web

- `/network` ukazuje aktivni rehearsal topologii.
- `/docs` je verejny docs hub.
- `/download` nese aktualni binarky pro verejnou linii.
- `/api-reference` ukazuje aktualni RPC / REST povrch.
- `/roadmap` ukazuje sirsi delivery track a gate logiku.

---

## Casovy ramec

Konec roku 2026 zustava **cilove okno** pro rozhodovani a pripadnou launch readiness, ne dukaz, ze launch uz je pevne garantovan.

---

## Viz take

- [Docs Hub](/docs)
- [Verejna launch cesta](/docs#mainnet-plan)
- [Network Status](/network)
- [Roadmap](/roadmap)
