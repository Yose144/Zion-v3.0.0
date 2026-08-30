# NIRVANA — Epizoda 4: Dům Lumi
## Domov — První stavení, otevřené dveře a teplo sdíleného ohně

> *„Domov není palác obehnaný hradbami. Domov je místo, kde hoří stálý oheň, na stole leží sůl a dveře se otevírají dovnitř i ven pro každého poutníka bez výjimky."*

---

## Příběh

Na prvním svahu Terra Nova postavili poutníci první stavení.

Nebylo z mramoru ani ze zlata. Základy vytesali z tvrdého čediče přivezeného z Araratu, trámy vyřezali z pevných cedrů zachráněných z archy a spáry utěsnili jílem a mechem z nového údolí. Dům měl jedinou velkou světnici s vysokým krovem. Uprostřed stál kamenný krb, v němž plál oheň, živený suchým dřívím.

Kolem krbu stála dřevěná lavice, na níž se vešli všichni. Na prostém dubovém stole ležela miska s hrubou solí — tou samou solí smlouvy, kterou nesli v kapsách od prvního večera u Galilejského jezera.

Vchodové dveře byly široké a neměly žádnou závoru ani klíčovou dírku. Poutník, který k nim přišel v noci, nemusel klepat ani prokazovat svůj původ, bohatství či společenské postavení. Stačilo zatlačit na kovanou kliku. Nad veřeji byl vytesán jediný symbol: zlatý paprsek protínající vlnu.

Nazvali ten dům **Lumi** — na věčnou památku prvního světla, které je vyvedlo z beznaděje.

Když se večer sešli u stolu a rozdělili si čerstvě upečený chléb, tesař řekl: *„Tento dům nepatří jednomu člověku. Patří každému, kdo ctí jeho pokoj. A dokud v něm hoří oheň, nikdo na této zemi nezmrzne."*

---

## Co to znamená

**Dům Lumi je symbolem uživatelsky suverénního, otevřeného a bezpečného decentralizovaného přístupu k ekosystému ZION.**

V technologické realitě to znamená prostředí, kde uživatel není produktem centralizovaných korporací, ale **plnoprávným suverénním občanem**:

1. **ZIS (ZION Identity Service):** Jednotný, bezpečný přístup k celému světu ZION bez prodeje osobních údajů. Žádné heslo, které by mohl někdo ukrást z centrální databáze — přihlašování funguje na bázi moderních Passkeys, kryptografických podpisů Ed25519 a WebAuthn biometriky.
2. **Otevřené dveře pro každého:** Každý si může zdarma stáhnout peněženku, připojit se k těžebnímu poolu, spustit vlastní node nebo vstoupit do OASIS. Neexistuje žádný kádrový posudek, KYC diskriminace ani geografická blokace.
3. **Sdílený stůl a spravedlivé odměny:** Každý těžař na poolu dostává odměnu vypočtenou matematicky exaktním systémem PPLNS (Pay Per Last N Shares) s minimálním poplatkem a okamžitým on-chain potvrzením.

---

## Kotva pravdy — ověřitelná fakta

> Stabilita domu Lumi je opřena o funkční infrastrukturu sítě ZION.

| Prvek příběhu | Co je na síti ZION ověřitelné |
|---|---|
| **Jednotný a bezpečný vchod** | ZIS běží na `auth.zionterranova.com` (Fastify + Prisma + Ed25519/SIWE); health endpoint vrací `200 OK`. |
| **Dveře bez petlice** | Veřejné SDK (`APP&WEB/zion-wallet-sdk`) s plnou podporou lokální generace klíčů BIP39/Ed25519. |
| **Teplo krbu (Pool)** | PPLNS pool na portu `8444` s nulovým podílem neoprávněně zadržených odměn; 442 000+ accepted shares. |
| **Sůl na stole** | Transparentní rozdělení poplatků přímo v coinbase výstupech, kontrolovatelné přes jakýkoliv L1 block explorer. |
| **Svoboda odchodu i příchodu** | Žádný vendor lock-in — uživatel má vždy plnou kontrolu nad svými privátními klíči a může kdykoliv migrovat. |

---

*→ Pokračování: [Epizoda 5 — Cesta domů (Maják na Araratu)](./05-Cesta-Domu.md)*

---

*[Zpět na index Nirvany → `00-README.md`](./00-README.md)*
