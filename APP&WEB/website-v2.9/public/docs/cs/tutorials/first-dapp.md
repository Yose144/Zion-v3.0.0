# První DApp — ZION TerraNova

Postav webovou aplikaci, která čte data ze ZION blockchainu.

---

## Co postavíme

Jednoduchý Node.js/Express server, který:

1. připojí se ke ZION nodu přes JSON-RPC,
2. zobrazí blockchain statistiky na webové stránce.

---

## Požadavky

- běžící ZION node, viz [Quick Start →](#getting-started),
- Node.js 18+,
- npm.

---

## 1. Inicializace projektu

```bash
mkdir zion-dapp && cd zion-dapp
npm init -y
npm install express
```

---

## 2. Vytvoř server

Vytvoř soubor `server.js`:

```javascript
const express = require('express');
const app = express();

const ZION_RPC = 'http://localhost:8444/jsonrpc';

async function rpcCall(method, params = {}) {
  const res = await fetch(ZION_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  });
  const data = await res.json();
  return data.result;
}

app.get('/', async (req, res) => {
  try {
    const info = await rpcCall('get_info');
    res.send(`
      <h1>ZION DApp</h1>
      <p>Height: ${info.height}</p>
      <p>Difficulty: ${info.difficulty}</p>
      <p>Peers: ${info.peers}</p>
    `);
  } catch (error) {
    res.status(500).send('RPC error');
  }
});

app.listen(3000, () => {
  console.log('DApp running on http://localhost:3000');
});
```

---

## 3. Spusť aplikaci

```bash
node server.js
```

Otevři `http://localhost:3000` v prohlížeči.

---

## 4. Kam pokračovat

- přidej endpoint pro `get_supply`,
- vykresli data stylovaněji přes frontend framework,
- napoj explorer nebo wallet workflow.

---

*First practical app on top of ZION JSON-RPC*