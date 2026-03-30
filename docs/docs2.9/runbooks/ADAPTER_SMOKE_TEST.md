# Wallet Adapter Smoke Test

Quickly verify adapter health after deploy.

## Pre-reqs
- `.env` configured with `ADAPTER_API_KEY`
- Adapter running and reachable internally

## Tests

1) Healthz
```bash
curl -H "X-API-KEY: $ADAPTER_API_KEY" http://localhost:18099/healthz
```
- Expect `{ ok: true, height: {...}, balance: {...} }`

2) Address Validation
```bash
curl -X POST -H "Content-Type: application/json" \
     -H "X-API-KEY: $ADAPTER_API_KEY" \
     -d '{"address":"Z3abc..."}' \
     http://localhost:18099/wallet/validate
```
- Expect `{ valid: true|false }`

3) Balance
```bash
curl -H "X-API-KEY: $ADAPTER_API_KEY" http://localhost:18099/wallet/balance
```
- Expect numeric balances

4) Explorer Summary
```bash
curl -H "X-API-KEY: $ADAPTER_API_KEY" http://localhost:18099/explorer/summary
```
- Expect `{ height, last_block_header }`
