# 🔌 ZION v2.9.5 — TestNet Port Matrix (kanon)

**Datum:** 2026-02-03  
**Scope:** pouze v2.9.5 native Rust stack (`2.9.5/`).

## 1) Vnitřní porty vs. veřejné porty

Doporučení: veřejně vystavovat jen to, co musí být veřejné.
- veřejné: Stratum, web, (volitelně) pool stats
- interní/localhost: core JSON-RPC (pokud není potřeba veřejně), Redis, DB

## 2) Kanonické porty (doporučení pro sjednocení)

### Core (zion-core)
- P2P: `8334/tcp`
- JSON-RPC: `8444/tcp`

### Pool (zion-pool)
- Stratum: `3333/tcp`
- Stats/API: `8080/tcp`

### Gateway API (Python FastAPI)
- `8001/tcp`

### Web
- `3000/tcp` (přes nginx)

### Redis
- `6379/tcp` (interní)

## 3) Proč je to takhle

- Porty `8334` (P2P) a `8444` (RPC) jsou konzistentní s v2.9.5 docker compose:  
  [2.9.5/docker-compose.native-2.9.5.yml](../../../2.9.5/docker-compose.native-2.9.5.yml)

- Core bin má defaulty sjednocené na `8444/8334`, aby nevznikal drift vůči compose.  
  Pokud potřebujeme lokální odlišné porty, přepisujeme je CLI args nebo env.

## 4) Checklist sjednocení

- Core: spouštět s `--rpc-port 8444 --p2p-port 8334`
- Pool: `ZION_CORE_RPC=http://<core-host>:8444/jsonrpc`
- Miner: vždy míří na Stratum `:3333`
- P2P: seed list a firewall otevřený pro `8334/tcp`

## 5) Poznámka k legacy dokumentům

Dokumenty s porty `18080/18081` nebo `8545/8334..8338` clusterem jsou historické/legacy vůči v2.9.5.
