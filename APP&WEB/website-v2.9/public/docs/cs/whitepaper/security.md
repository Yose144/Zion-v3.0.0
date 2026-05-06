# Bezpečnost — ZION v2.9.5

---

## Bezpečnostní vrstvy

### 1. Rust — paměťová bezpečnost

ZION core je napsán v Rustu, který eliminuje:
- Buffer overflows
- Use-after-free
- Data races
- Null pointer dereferences

Rust poskytuje bezpečnost na úrovni kompilátoru bez runtime overhead.

### 2. Konsenzus

- **Cosmic Harmony v3** — multi-algo PoW s LWMA DAA
- **Soft finality**: 60 bloků (~60 minut)
- **Max reorg depth**: 10 bloků — omezuje možnost reorganizace
- **Min difficulty**: 1000 — chrání proti difficulty dropu

### 3. P2P síť

- Rate limiting: 100 msg/s per peer
- Ban duration: 3600 s (mainnet) za protokolové porušení
- Max peers: 128 (96 inbound, 32 outbound)
- Peer scoring a automatické odpojení

### 4. RPC

- Bind na `127.0.0.1` v produkci (ne 0.0.0.0)
- Max 100 spojení
- Žádná privátní data přes RPC bez autentizace

---

## Ochrana proti útokům

| Útok | Ochrana |
|------|--------|
| 51% attack | LWMA DAA, multi-algo rotace |
| Selfish mining | Max reorg depth 10 |
| Sybil attack | Peer scoring, rate limiting |
| DDoS (P2P) | Rate limiting, banning |
| DDoS (RPC) | Connection limit, localhost bind |
| Time warp | Timestamp validation |

---

## Doporučení pro operátory

1. **Firewall** — otevři pouze porty 8334 (P2P) a 8444 (RPC lokálně)
2. **SSH** — key-only autentizace, Fail2ban
3. **Aktualizace** — sleduj [GitHub releases](https://github.com/Zion-TerraNova/2.9.6/releases) pro security patche
4. **Monitoring** — loguj a sleduj neobvyklou aktivitu
5. **Izolace** — spouštěj node pod separátním uživatelem

---

## Auditní strategie

- Interní code review při každém PR
- Plánovaný externí audit před Mainnet launchem
- Bug bounty program (v přípravě)
- Veřejný kód — kdokoli může auditovat

---

## Responsible Disclosure

Najdeš bezpečnostní chybu? Kontaktuj nás přes:
- GitHub Security Advisory na [Zion-TerraNova](https://github.com/Zion-TerraNova/2.9.6/security)
- Neoznamuj veřejně — dej nám 90 dní na opravu

---

## Související

- [Governance →](#whitepaper-governance)
- [Architektura →](#arch-overview)
- [Pokročilý Setup →](#setup)

---

*ZION TerraNova v2.9.5*
