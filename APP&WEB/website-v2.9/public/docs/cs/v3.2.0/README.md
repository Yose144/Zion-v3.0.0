# ZION v3.2.0 "One Love" — Mainnet Stable

> **Vydáno:** 6. srpna 2026  
> **Aktuální veřejná linka:** v3.2.0 "One Love"  
> **Stav:** Mainnet Stable — live, pool aktivní, těžba běží, bridge a DEX nasazeny  
> **Oficiální veřejný launch:** 31. prosince 2026  
> **Genesis hash:** `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`

---

## One Love ve třech větách

1. **ZION je blockchain, který si můžeš ověřit, ne jen uvěřit.** Otevřený kód v Rustu pod MIT licencí, nový blok každou minutu, běžící produkční síť — žádný slib na papíře.
2. **Každý blok automaticky dělí odměnu: 89 % těžaři, 5 % humanitárnímu fondu, 5 % fondu vědy a budoucnosti (Issobella), 1 % se spálí.** Toto rozdělení vynucuje sám protokol — nejde vypnout hlasováním ani rozhodnutím firmy.
3. **Nikdo nedostal VIP vstup.** Žádné ICO, žádný předprodej. Genesis alokace je veřejně zdokumentovaná v kódu a vše ostatní vzniká poctivou těžbou.

---

## Co je v3.2.0 "One Love"

v3.2.0 „One Love" je **Mainnet Stable** vydání ZION TerraNova. Spojuje Ekam Deeksha proof-of-work konsenzus, jednotnou multichain peněženku, decentralizovanou burzu ZionDex a kompletní protokolové bezpečnostní zpřísnění.

Název „One Love" znamená sjednocení sítě, peněženky a komunitní vrstvy pod jednu runtime linii. Všechny služby jsou aktivní a chain běží nepřetržitě od srpnového hard resetu v roce 2026.

---

## Klíčová čísla

| Parametr | Hodnota |
|---|---|
| Celková nabídka | 144 000 000 000 ZION (tvrdý strop) |
| Čas bloku | ~60 sekund |
| Odměna za blok (1. dekáda, 2026–2036) | 5 400,067 ZION |
| Emisní model | Decade Decay: −20 % každých 10 let, věčný tail ~724,78 ZION/blok od ~2126 |
| Rozdělení odměny | 89 % těžař / 5 % humanitární / 5 % Issobella / 1 % burn |
| Těžební algoritmus | Ekam Deeksha v3.2 — paměťově náročný PoW (CPU/GPU, odolný vůči ASIC) |
| Atomická jednotka | 1 ZION = 1 000 000 flowers (6 desetinných míst) |
| Genesis hash (V3 compat) | `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71` |
| Genesis hash (V31 native) | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` |
| Licence | MIT |

---

## Klíčové vlastnosti

- **Nativní Rust těžba** — GPU i CPU, jedno kliknutí pro auto-detekci na Linuxu, macOS a Windows.
- **Terminal Miner + Desktop App** — příkazový řádek s TUI a plná GUI aplikace s peněženkou a minerem.
- **ZION Identity Service (ZIS)** — přihlášení emailem, Google, MetaMask nebo X, stejná identita napříč webem a CLI.
- **Multichain peněženka** — per-user deposit adresy, ledger a výběry pro ZION L1 a EVM chainy.
- **ZionDex** — swap a likvidita na Base Mainnet s multichain routováním a reálným on-chain settlementem.
- **HTLC atomic swapy** — nativní L1 lock/claim/refund pro cross-chain obchody bez custodial rizika.
- **Bridge + WARP** — wrapped ZION (wZION) na Base a cross-chain převody.
- **DAO governance** — návrhy, hlasování a treasury operace on-chain.
- **OASIS + L5/L6 trackery** — pasivní sledování fondů a herní vrstvy.

---

## Vyber si cestu

### Pozorovatel — „Nejdřív chci důkaz" (2 minuty)

1. Otevři [zionterranova.com](https://zionterranova.com) a sleduj živou síť.
2. Prolistuj kód na [GitHubu](https://github.com/Zion-TerraNova/v3-Mainnet) — nic není skryté.
3. Zeptej se komunity na cokoliv. Dobrá komunita umí říct „nevím" a ukázat zdroj.

### Hráč — „Chci to zažít" (5 minut)

1. Vstup do OASIS: [oasis.zionterranova.com](https://oasis.zionterranova.com).
2. Projdi warp intro, proleť 3D galaxií 55 světů, prohlédni Avatar Codex.
3. Prozkoumej NFT tržiště na [market.zionterranova.com](https://market.zionterranova.com).

> **Poctivě:** OASIS je **živý preview ve výstavbě** — ne hotová hra. Obsah, questy i progrese se mohou během vývoje měnit nebo resetovat. Golden Egg a plná herní ekonomika jsou budoucnost, ne dnešní realita. Vstupuješ jako spolutvůrce zahrady, ne jako zákazník hotového produktu.

### Těžař — „Chci zapojit svůj stroj" (15 minut)

1. Vytvoř si **vlastní** peněženku — mnemonik nikdy nikomu nedávej.
2. Stáhni Terminal Miner nebo Desktop App ze stránky [Stáhnout](/download), nebo si kód přelož:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V31
cargo build --release --bin zion-miner
./target/release/zion-miner \
  --pool pool.zionterranova.com:8444 \
  --wallet zion1...tvoje_adresa \
  --worker muj-prvni-stroj
```

3. Sleduj přijaté share a teploty; začni konzervativně.

> **Proč začít brzy:** první dekáda nese nejvyšší naplánovanou odměnu za blok a malá síť znamená, že se naučíš peněženku, rig i bezpečnost dřív, než přijde dav. To není slib zisku — skutečný výnos závisí na tvém hashratu, difficulty, nákladech a tržní ceně. Je to popis emisního plánu, který si ověříš v kódu.

### Stavitel — „Chci nést kus mostu"

1. Přelož workspace, spusť testy, otevři issue nebo pull request.
2. Zlepši dokumentaci, přidej test, oprav chybu, navrhni lepší UX.
3. Přines dovednost, kterou už máš — design, překlad, bezpečnost, hudbu, komunitu.

---

## Bezpečnost

Interní bezpečnostní audit byl dokončen **26. 8. 2026** a remediation pass skončil **1. 9. 2026**.

- **48 findings** bylo reviewováno celkem; severity rating má přiřazených 44 z nich (2 Critical, 10 High, 20 Medium, 12 Low/Info). Zbývající 4 závislostní/odložené položky jsou sledovány bez severity.
- **37 je opraveno**, **7 akceptováno s dokumentovanými mitigacemi**, **4 odloženo** na v3.3 dependency migration (alloy migration) s kompenzačními opatřeními.
- V produkčních cestách nebyly nalezeny chyby způsobující ztrátu prostředků.

Více v dokumentu [Security Audit 3.2](./security-audit.md).

---

## Live infrastruktura

| Služba | Stav | Veřejný endpoint |
|---|---|---|
| Core node | Aktivní | `rpc.zionterranova.com:8443` |
| Veřejný pool | Aktivní | `pool.zionterranova.com:8444` (Stratum) |
| Miner binárky | Aktivní | stránka [Stáhnout](/download) |
| Web + peněženka | Aktivní | `https://zionterranova.com` |
| Bridge / WARP | Aktivní | přes [Multichain](/multichain) |
| DAO | Aktivní | přes [DAO](/dao) |
| OASIS | Aktivní | `https://oasis.zionterranova.com` |
| Identity service | Aktivní | `https://auth.zionterranova.com` |

Aktuální výšku a stav poolu najdeš na stránce [Síť](/network) a v [Průzkumníkovi](/explorer).

---

## Stahování

Všechna v3.2.0 vydání jsou na GitHubu s SHA256 checksumy:

- **Terminal Miner** — jedno kliknutí pro GPU/CPU auto-detekci, TUI dashboard.
- **Community CLI** — jeden `zion` binary pro peněženku, node, pool a těžbu.
- **Desktop App** — vestavěný miner, peněženku a dashboard (Linux AppImage/DEB, macOS DMG, Windows installer/ZIP).

Přímé odkazy najdeš na stránce [Stáhnout](/download).

---

## Důležitá upozornění

- Síť je **Mainnet Stable**, ale do oficiálního veřejného launchi 31. 12. 2026 je stále v předlaunch fázi.
- OASIS je **živý preview ve výstavbě** — obsah, questy i progrese se mohou během vývoje měnit nebo resetovat.
- Těžba, bridge, swap a účast probíhají **na vlastní riziko**.
- Jde o experimentální open-source protokol, nikoliv investiční produkt.
