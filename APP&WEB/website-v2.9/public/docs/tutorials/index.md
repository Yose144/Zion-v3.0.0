# Tutoriály — ZION TerraNova

Praktické návody pro práci s ZION blockchainem.

---

## Dostupné tutoriály

### [První DApp →](#tutorial-dapp)

Postav jednoduchou webovou aplikaci, která komunikuje s ZION nodem přes JSON-RPC. Naučíš se:
- Připojit se k nodu
- Číst blockchain data (výška, difficulty, supply)
- Zobrazit data na webové stránce

---

## Než začneš

1. Běžící ZION node — viz [Quick Start →](#getting-started)
2. Node.js 18+ nainstalovaný
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
- Pool Dashboard — monitoring mining poolu
- Block Explorer — vlastní průzkumník bloků

---

## Přispěj tutoriálem

Máš nápad na tutoriál? Pošli PR na [GitHub](https://github.com/Zion-TerraNova/2.9.6).

---

*ZION TerraNova v2.9.8 Deeksha*
