# First DApp on ZION

Build a simple web application that reads data from the ZION blockchain via JSON-RPC.

## What we will build

- Node.js/Express server
- An endpoint that returns height, difficulty and total supply

## Requirements

- Node.js 18+
- Access to the public RPC or your own node

## Project setup

```bash
mkdir zion-dapp && cd zion-dapp
npm init -y
npm install express
```

## Simple server

```javascript
const express = require('express');
const app = express();

const ZION_RPC = 'http://rpc.zionterranova.com:8443';

async function rpcCall(method, params = []) {
  const res = await fetch(ZION_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const data = await res.json();
  return data.result;
}

app.get('/', async (req, res) => {
  const info = await rpcCall('getChainInfo');
  res.send(`
    <h1>ZION Live</h1>
    <p>Height: ${info.height}</p>
    <p>Difficulty: ${info.difficulty}</p>
    <p>Supply: ${info.total_supply}</p>
  `);
});

app.listen(3000, () => console.log('DApp running on http://localhost:3000'));
```

## Run

```bash
node server.js
```

Open `http://localhost:3000` and you will see live data from the chain.

> **Warning:** The RPC is plain HTTP. Use only public data. Never display your seed or private key in code.
