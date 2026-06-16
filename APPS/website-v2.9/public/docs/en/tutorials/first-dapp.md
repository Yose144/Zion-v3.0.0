# First DApp — ZION TerraNova

Build a web application that reads data from the ZION blockchain.

---

## What we are building

A simple Node.js/Express server that:

1. connects to a ZION node via JSON-RPC,
2. renders blockchain statistics on a web page.

---

## Requirements

- a running ZION node, see [Quick Start →](#getting-started),
- Node.js 18+,
- npm.

---

## 1. Initialize the project

```bash
mkdir zion-dapp && cd zion-dapp
npm init -y
npm install express
```

---

## 2. Create the server

Create a file named `server.js`:

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

## 3. Run the app

```bash
node server.js
```

Open `http://localhost:3000` in your browser.

---

## 4. Where to go next

- add a `get_supply` endpoint,
- render the data with a real frontend framework,
- connect it to explorer or wallet flows.

---

*First practical app on top of ZION JSON-RPC*