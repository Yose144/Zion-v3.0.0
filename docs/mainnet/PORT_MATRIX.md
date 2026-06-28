# 🔌 ZION Port Matrix (Canonical)

> Aktualizace: 24. února 2026  
> Tento soubor je jediný zdroj pravdy pro porty napříč config/docker/website/E2E.

---

## MainNet

| Service | Internal | External | Purpose |
|---|---:|---:|---|
| Core P2P | 8333 | 8333 | Node peer-to-peer |
| Core RPC | 8443 | 8443 | JSON-RPC/health |
| Pool Stratum | 3333 | 3333 | Miner stratum |
| Pool API | 8080 | 8080 | Pool API + metrics |
| DAO API | 8450 | 8450 (or nginx `/dao-api`) | DAO daemon API |
| Website | 3000 | 3000 (or nginx `:443`) | Next.js app |
| Grafana | 3000 | 3001 | Monitoring UI |
| Prometheus | 9090 | 9090 | Metrics backend |

---

## TestNet

| Service | Internal | External | Purpose |
|---|---:|---:|---|
| Core P2P | 8334 | 8334 | Node peer-to-peer |
| Core RPC | 8444 | 8444 | JSON-RPC/health |
| Pool Stratum | 3333 | 3333 | Miner stratum |
| Pool API | 8080 | 8080 | Pool API + metrics |
| DAO API | 8450 | 8450 (or nginx `/dao-api`) | DAO daemon API |
| Website | 3000 | 3000 | Next.js app |
| Grafana | 3000 | 3001 | Monitoring UI |
| Prometheus | 9090 | 9090 | Metrics backend |

---

## Website v2.9 Proxy Paths

| Public path | Upstream |
|---|---|
| `/api/*` | backend API gateway |
| `/blockchain-rpc/*` | `core:8444` (testnet) / `core:8443` (mainnet) |
| `/pool/*` | `pool:8080` |
| `/dao-api/*` | `dao:8450` |

---

## E2E Defaults

- Pool integration E2E: `127.0.0.1:3333`
- Pool API checks: `http://127.0.0.1:8080`
- Core health checks (testnet): `http://127.0.0.1:8444/health`

---

## Notes

- `8080` je rezervovaný pro pool API.
- DAO daemon má vlastní port `8450` (aby nekolidoval s pool API).
- Jakákoli změna portů musí aktualizovat: `config/*.toml`, `docker/*.yml`, `APP&WEB/website-v2.9/.env*.example`, E2E testy a tento soubor.
