# Tutorials — ZION TerraNova

Practical guides for working with the ZION blockchain.

---

## Available tutorials

### [First DApp →](#tutorial-dapp)

Build a simple web application that communicates with a ZION node over JSON-RPC. You will learn how to:

- connect to a node,
- read blockchain data such as chain height, difficulty, and supply,
- display that data on a web page.

---

## Before you begin

1. A running ZION node — see [Quick Start →](#getting-started)
2. Node.js 18+ installed
3. Basic JavaScript knowledge

---

## Connect to the node

Verify that your node is running:

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}' \
  -H 'Content-Type: application/json'
```

---

## More tutorials (planned)

- CLI Wallet — command-line wallet management
- Explorer integration — reading blocks and transactions
- Pool telemetry — hashrate and payout visibility

---

*Practical tutorials for the ZION public line*