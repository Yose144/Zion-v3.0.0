# Tutoriály — ZION TerraNova

Praktické návody pro práci se ZION blockchainem.

---

## Dostupné tutoriály

### [První DApp →](#tutorial-dapp)

Postav jednoduchou webovou aplikaci, která komunikuje se ZION nodem přes JSON-RPC. Naučíš se:

- připojit se k nodu,
- číst blockchain data, například výšku chainu, difficulty a supply,
- zobrazit ta data na webové stránce.

---

## Než začneš

1. Běžící ZION node — viz [Quick Start →](#getting-started)
2. Nainstalovaný Node.js 18+
3. Základní znalost JavaScriptu

---

## Připoj se k nodu

Ověř, že tvůj node běží:

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}' \
  -H 'Content-Type: application/json'
```

---

## Další tutoriály (plánované)

- CLI Wallet — správa peněženky z příkazové řádky
- Explorer integrace — čtení bloků a transakcí
- Pool telemetrie — přehled hashratu a payoutů

---

*Practical tutorials for the ZION public line*