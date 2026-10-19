# NIRVANA — Epizoda 5: Cesta domů
## Maják na Araratu a kompas pro každého stavitele

> *„Loď nezmizí jen proto, že první poutníci dorazili na břeh. Maják musí zůstat rozsvícený a hlídat hladinu, dokud každý, kdo hledá novou zemi, bezpečně nedopluje."*

---

## Příběh

Ne všichni byli hned v bezpečí světnice domu Lumi.

Část lidí zůstala ještě na palubě staré archy, protože potřebovali čas, aby uvěřili, že pevnina pod nohama je skutečná. Jiní byli na skalnatém úbočí Araratu a vynášeli na vrchol těžké kameny. A další ještě bloudili v mlhách širého moře na chatrných vorech starého světa.

A tak se stavitelé dohodli: na samém temeni hory Ararat vybudují kamennou věž a na jejím vrcholu zapálí věčný oheň.

Nebyl to oheň, který by plýtval dřevem a pálil lesy v divokém plamenu. Byl to **udržovaný, harmonický a soustředěný paprsek**, usměrněný soustavou leštěných křišťálových zrcadel tak, aby byl viditelný na stovky mil daleko přes rozbouřenou hladinu.

Každou noc u něj držela hlídku dvojice strážců. Když spatřili v dálce blikající světlo zbloudilého člunu, pootočili zrcadlo a vyslali signál: *„Plujte za tímto světlem. Kurz západ. Zde je pevná zem a domov."*

A tak Ararat přestal být pouhou holou skálou. Stal se **věčným majákem Terra Nova**.

---

## Co to znamená

**Cesta domů je nepřetržitý proces provozu, údržby, decentralizace a budování infrastruktury.**

ZION nekončí vydáním jedné verze ani spuštěním jednoho serveru. Znamená to **neustálou bdělost a odolnost**:

1. **Vysoká dostupnost a monitorování (Edge Sentinel):** Automatické hlídání zdraví uzlů, P2P topologie a poolových spojení 24/7/365. Pokud uzel narazí na chybu, systém ho bezpečně restartuje a resynchronizuje bez ztráty dat.
2. **Konzistentní zálohování a obnova po havárii:** Pravidelné snapshoty databází (`sqlite3 .backup`), off-site replikace na geograficky oddělené servery a ověřování integrity zaručují, že historie sítě přežije i totální výpadek datacentra.
3. **Kompas pro vývojáře:** Otevřená dokumentace, standardizované CLI rozhraní a SDK umožňují komukoliv na světě postavit vlastní uzel, napojit vlastní rig nebo vytvořit vlastní dApp nad vrstvami ZIONu.

---

## Kotva pravdy — ověřitelná fakta

> Maják sítě ZION je plně monitorovaný a ověřitelný v reálném čase.

| Prvek příběhu | Co je na síti ZION ověřitelné |
|---|---|
| **Věčný oheň majáku** | Edge server uptime 99.9+ %; produkční služby běží pod systemd s automatickým restartem a alertovacím systémem. |
| **Křišťálová zrcadla (Monitorování)** | Zero-dependency Python dashboard na portu `8766` (`dashboard.zionterranova.com`) + integrované Prometheus & Grafana metriky. |
| **Záchranné čluny (Disaster Recovery)** | Plný zálohovací systém L1–L6 (`backup-edge.sh` + off-site replikace do chráněného úložiště). |
| **Otevřená navigace** | Veřejná CLI binárka `zion` (`V31/cli`) umožňující správu peněženky, odesílání transakcí, těžbu i interakci s DAO. |
| **Pevný kurz** | Veřejně deklarovaná a striktně dodržovaná roadmapa směřující k finální verzi 3.3 Nirvana. |

---

*→ Pokračování: [Epizoda 6 — Mosty přes propast (L2 Multichain & WARP)](./06-Mosty-Pres-Propast.md)*

---

*[Zpět na index Nirvany → `00-README.md`](./00-README.md)*
