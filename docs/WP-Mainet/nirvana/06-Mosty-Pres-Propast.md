# NIRVANA — Epizoda 6: Mosty přes propast
## L2 Multichain, WARP Relay & ZionDex — Sjednocení všech ostrovů

> *„Izolovaná pevnina je jen větším vězením, pokud k ní nevedou mosty. Skutečná svoboda začíná tam, kde může hodnota proudit bez celníků, prostředníků a zbytečných poplatků."*

---

## Příběh

Terra Nova byla úrodná a klidná, ale v dálce za mořskou úžinou ležely další ostrovy.

Na jednom ostrově lidé kovali z černého kovu těžké mince (Bitcoin), na jiném stavěli složité kamenné automaty a počítadla (Ethereum a Base), a na dalším létaly rychlé šípy s bleskovými zprávami (Solana). Každý ostrov mluvil jiným jazykem, uctíval jiné protokoly a stavěl kolem svých přístavů vysoké celní zdi. Pokud chtěl někdo převézt obilí z jednoho ostrova na druhý, musel zaplatit lichvářům v přístavu polovinu nákladu a čekat celé dny, než mu dovolili vyplout.

Stavitelé z domu Lumi se podívali přes moře a řekli: *„Nezboříme jejich ostrovy. Postavíme mezi námi mosty z čistého světla."*

A tak začali klenout oblouky. První oblouk mířil k ostrovu černé oceli, druhý k ostrovu kamenných automatů a třetí k ostrovu blesků. Tyto mosty neměly mýtné brány ani strážní věže. Fungovaly na prastarém zákonu zrcadlení: **co zamkneš na jedné straně s tajemstvím v srdci, to se odemkne na straně druhé přesně ve chvíli, kdy tajemství vyslovíš.**

Pojmenovali tuto síť mostů **WARP** a centrální tržiště na křižovatce **ZionDex**.

Od toho dne mohl sedlák z Terra Nova vyměnit své květy (flowers) za ocel z Bitcoinu nebo olej z Etherea během jediného nádechu. Bezpečně, atomicky, beze strachu z podvodu.

---

## Co to znamená

**L2 Multichain a WARP Relay jsou decentralizovaným oběhovým systémem ekosystému ZION.**

L1 blockchain ZION je bezpečný a robustní základ, ale skutečné globální asimilace lze dosáhnout pouze **plynulou interoperabilitou**:

1. **WARP Cross-Chain Relays:** Protokol pro decentralizovaný přenos hodnoty a zpráv napříč různorodými sítěmi (EVM řetězce, Bitcoin UTXO, Solana, Cosmos, SUI).
2. **HTLC (Hashed Time-Locked Contracts):** Kryptografická garance atomických swapů. Pokud nedojde k úspěšnému dokončení výměny v dohodnutém čase, prostředky se automaticky vrátí původnímu majiteli na L1 i L2.
3. **ZionDex AMM Settlement:** Automatický tvůrce trhu s fondy likvidity (`ZION/BTC`, `wZION/ETH`, `ZION/USDC`), který umožňuje okamžitou směnu aktiv bez spoléhání na centralizované burzy náchylné k insolvenci či konfiskacím.
4. **Decentralizovaná síť solverů:** Otevřená federace nezávislých solverů, kteří soutěží o nejlepší kurz a nejrychlejší vyřízení uživatelských swapů.

---

## Kotva pravdy — ověřitelná fakta

> Multichainová vrstva je plně implementována v repozitáři `V31/L2/multichain`.

| Prvek příběhu | Co je na síti ZION ověřitelné |
|---|---|
| **Světelné mosty (WARP)** | Binárka `warpd` běží jako služba `zion-v31-multichain.service` na portu `8453` (WARP) a `8454` (DEX API). |
| **Zákon zrcadlení (HTLC)** | Nativní L1 HTLC skripty (`OP_SHA256 <hash> OP_EQUALVERIFY OP_CHECKSIG`) a EVM HTLC kontrakty pro atomické swapy. |
| **Křižovatka trhu (ZionDex)** | `/v1/swap/quote`, `/v1/swap/quote/multi` a `/v1/swap/execute-v2` plně funkční v produkčním režimu. |
| **Bezpečné uzamčení** | Automatický reconciler (`V31/L2/multichain/src/reconciliation.rs`) nepřetržitě porovnává on-chain zůstatky s interními saldy. |
| **Podpora Base EVM** | Nasazen pilotní wZION ERC-20 kontrakt na síti Base s 5/7 multisig validátorským konsensem. |

---

*→ Pokračování: [Epizoda 7 — Zlaté lůno Hiranyagarbha (L3 Orchestrace & Vědomí)](./07-Zlate-Luno-Hiranyagarbha.md)*

---

*[Zpět na index Nirvany → `00-README.md`](./00-README.md)*
