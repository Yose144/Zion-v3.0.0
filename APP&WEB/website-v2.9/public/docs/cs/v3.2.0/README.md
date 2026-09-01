# ZION v3.2.0 "One Love" — Mainnet Stable

> **Vydáno:** 6. srpna 2026  
> **Aktuální veřejná linka:** v3.2.0 "One Love"  
> **Stav:** Mainnet Stable — live, pool aktivní, těžba běží, bridge a DEX nasazeny  
> **Oficiální veřejný launch:** 31. prosince 2026  
> **Genesis hash:** `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`

---

## Co je v3.2.0 "One Love"

v3.2.0 "One Love" je **Mainnet Stable** vydání ZION TerraNova. Spojuje Ekam Deeksha proof-of-work konsenzus, jednotnou multichain peněženku, decentralizovanou burzu ZionDex a kompletní protokolové bezpečnostní zpřísnění.

Název "One Love" znamená sjednocení sítě, peněženky a komunitní vrstvy pod jednu runtime linii. Všechny služby jsou aktivní a chain běží nepřetržitě od srpnového hard resetu v roce 2026.

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

## Bezpečnost

Interní bezpečnostní audit byl dokončen **26. 8. 2026** a remediation pass skončil **1. 9. 2026**.

- **44 findings** reviewováno (2 Critical, 10 High, 20 Medium, 12 Low/Info).
- **43 z 44** findings je opraveno nebo akceptováno s dokumentovanými mitigacemi.
- **1 finding** je odložen na v3.3 dependency migration s kompenzačními opatřeními.
- V produkčních cestách nebyly nalezeny chyby způsobující ztrátu prostředků.

Více v dokumentu [Security Audit 3.2](./security-audit.md).

---

## Live infrastruktura

| Služba | Stav |
|--------|------|
| Core node | Aktivní |
| Veřejný pool | Aktivní |
| Miner binárky | Aktivní |
| Web + peněženka | Aktivní |
| Bridge / WARP | Aktivní |
| DAO | Aktivní |
| OASIS | Aktivní |
| Identity service | Aktivní |

Aktuální výšku a stav poolu najdeš na stránce [Síť](/network) a v [Průzkumníkovi](/explorer).

---

## Stahování

Všechna v3.2.0 vydání jsou na GitHubu s SHA256 checksumy:

- **Terminal Miner** — jedno kliknutí pro GPU/CPU auto-detekci, TUI dashboard.
- **Community CLI** — jeden `zion` binary pro peněženku, node, pool a těžbu.
- **Desktop App** — vestavěný miner, peněženku a dashboard (Linux AppImage/DEB, macOS DMG, Windows installer/ZIP).

Přímé odkazy najdeš na stránce [Download](/download).

---

## Důležitá upozornění

- Síť je **Mainnet Stable**, ale do oficiálního veřejného launchi 31. 12. 2026 je stále v předlaunch beta fázi.
- Těžba, bridge a účast probíhají **na vlastní riziko**.
- Jde o experimentální open-source protokol, nikoliv investiční produkt.
