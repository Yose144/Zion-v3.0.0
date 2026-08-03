# První DApp na ZION

Postav jednoduchou webovou aplikaci, která čte data z ZION blockchainu přes JSON-RPC.

## Co postavíme

- Node.js/Express server
- Endpoint, který vrátí výšku, difficulty a total supply

## Požadavky

- Node.js 18+
- Běžící ZION node nebo veřejný RPC

## Inicializace projektu

```bash
mkdir zion-dapp && cd zion-dapp
npm init -y
npm install express
```

## Jednoduchý server

```javascript
const express = require('express');
const app = express();

const ZION_RPC = 'http://localhost:8444/jsonrpc';

async function rpcCall(method, params = {}) {
  const res = await fetch(ZION_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const data = await res.json();
  return data.result;
}

app.get('/', async (req, res) => {
  const info = await rpcCall('get_info');
  res.send(`
    <h1>ZION Live</h1>
    <p>Height: ${info.height}</p>
    <p>Difficulty: ${info.difficulty}</p>
    <p>Supply: ${info.total_supply}</p>
  `);
});

app.listen(3000, () => console.log('DApp running on http://localhost:3000'));
```

## Spuštění

```bash
node server.js
```

Otevři `http://localhost:3000` a uvidíš živá data z chainu.
