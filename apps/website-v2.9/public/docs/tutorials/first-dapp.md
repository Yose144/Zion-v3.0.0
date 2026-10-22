# První DApp — ZION TerraNova

Postav webovou aplikaci, která čte data z ZION blockchainu.

---

## Co postavíme

Jednoduchý Node.js/Express server, který:
1. Připojí se k ZION nodu přes JSON-RPC
2. Zobrazí blockchain statistiky na webové stránce

---

## Požadavky

- Běžící ZION node (viz [Quick Start →](#getting-started))
- Node.js 18+
- npm

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
    const supply = await rpcCall('get_supply');

    res.send(`
      <html>
        <head><title>ZION DApp</title></head>
        <body style="font-family: monospace; padding: 2em; background: #111; color: #0f0;">
          <h1>ZION Blockchain Status</h1>
          <table>
            <tr><td>Block height:</td><td>${info.height}</td></tr>
            <tr><td>Difficulty:</td><td>${info.difficulty}</td></tr>
            <tr><td>Peers:</td><td>${info.peers}</td></tr>
            <tr><td>Version:</td><td>${info.version}</td></tr>
            <tr><td>Circulating:</td><td>${supply.circulating_supply} ZION</td></tr>
            <tr><td>Block reward:</td><td>${supply.block_reward} ZION</td></tr>
          </table>
          <p><small>Refreshed: ${new Date().toISOString()}</small></p>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Error connecting to ZION node: ' + err.message);
  }
});

app.listen(3001, () => {
  console.log('ZION DApp running on http://localhost:3001');
});
```

---

## 3. Spusť

```bash
node server.js
```

Otevři `http://localhost:3001` v prohlížeči.

---

## 4. Co dál

- Přidej auto-refresh (polling každých 10s)
- Zobraz poslední bloky (`get_block`)
- Přidej vyhledávání transakcí
- Styluj pomocí Tailwind CSS

---

## Použité RPC metody

| Metoda | Popis |
|--------|-------|
| `get_info` | Výška, difficulty, peers, verze |
| `get_supply` | Supply, block reward |
| `get_block` | Detail bloku |
| `get_balance` | Zůstatek adresy |

Kompletní reference: [API →](#api)

---

## Zdroje

- [API Reference →](#api) — všechny RPC metody
- [GitHub](https://github.com/Zion-TerraNova/2.9.6) — zdrojový kód
- [Quick Start →](#getting-started) — rozjetí nodu

---

*ZION TerraNova v2.9.8 Deeksha*
