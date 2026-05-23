# 📜 L2 — Solidity Smart Contracts (wZION Bridge)

> **Vrstva:** L2 — DeFi  
> **Stack:** Solidity 0.8.20 · Hardhat · OpenZeppelin 5.1 · TypeScript  
> **Chain:** Base Sepolia (testnet) → Base mainnet (post-audit)

---

## Co to je?

ERC-20 token **wZION** (Wrapped ZION) a **ZIONBridge** multisig kontrakt — umožňují převod ZION z L1 na EVM chainy a zpět.

```
ZION L1  ──lock──▶  Bridge Validators  ──mint──▶  wZION (ERC-20)
wZION    ──burn──▶  Bridge Validators  ──unlock──▶  ZION L1
```

---

## Kontrakty

| Soubor | Popis |
|--------|-------|
| `sol/wZION.sol` | ERC-20, 18 decimals, MAX_SUPPLY 144B, BRIDGE_ROLE mint/burn, EIP-2612 permit |
| `sol/ZIONBridge.sol` | 3-of-5 multisig, 24h timelock >1M, 10M daily limit, 60 block finality |

### Klíčové parametry

| Parametr | Hodnota |
|----------|---------|
| Min bridge amount | 100 wZION |
| Multisig threshold | 3-of-5 validátorů |
| Timelock | 24h pro převody > 1,000,000 wZION |
| Daily limit | 10,000,000 wZION/den |
| L1 finality | 60 bloků (~1 hodina) |
| Decimal konverze | L1: 6 dec → EVM: 18 dec (×1e12) |

---

## Rychlý start

```bash
cd contracts
npm install

# Kompilace
npx hardhat compile

# Testy (75 testů — wZION: 31, ZIONBridge: 30, E2E: 14)
npx hardhat test

# Pouze E2E testy
npx hardhat test test/E2E.test.ts
```

---

## Deploy na testnet

1. Zkopíruj `.env.example` → `.env`
2. Vyplň `DEPLOYER_PRIVATE_KEY` — **EVM privátní klíč** (např. z MetaMask exportu)
3. Získej testnet ETH z faucetu: [base-sepolia faucet](https://www.alchemy.com/faucets/base-sepolia)
4. Deploy:

```bash
npm run deploy:base-sepolia
```

5. Verifikace kontraktů na block exploreru:

```bash
WZION_ADDRESS=0x... BRIDGE_ADDRESS=0x... npx hardhat run scripts/verify.ts --network base-sepolia
```

> ⚠️ **Privátní klíč** je obyčejný Ethereum/EVM klíč (64 hex znaků).
> Na testnetu stačí nový MetaMask účet — žádné reálné peníze!

---

## Struktura

```
contracts/
├── sol/                    # Solidity zdrojáky
│   ├── wZION.sol           # ERC-20 Wrapped ZION
│   └── ZIONBridge.sol      # Bridge multisig controller
├── test/
│   ├── wZION.test.ts       # Unit testy wZION (31)
│   ├── ZIONBridge.test.ts  # Unit testy Bridge (30)
│   └── E2E.test.ts         # End-to-end lifecycle (14)
├── scripts/
│   ├── deploy.ts           # Deploy script (wZION + Bridge + role setup)
│   └── verify.ts           # Block explorer verification
├── hardhat.config.ts       # Hardhat konfigurace + sítě
├── package.json            # Dependencies
├── .env.example            # Šablona pro secrets
└── .gitignore              # Chrání .env a build artifacts
```

---

## Cílové sítě

| Priorita | Síť | Chain ID | DEX |
|----------|-----|----------|-----|
| 🥇 | Base | 8453 | Uniswap v3 |
| 🥈 | Arbitrum | 42161 | Uniswap v3 |
| 🥉 | BSC | 56 | PancakeSwap |

---

## Souvislosti

- **Rust relay** → `../bridge/` (L1 watcher + EVM watcher + relayer)
- **WARP** → `../warp/` (rozšíření na 7 chain families)
- **Architektura** → `../docs/L2_WZION_BRIDGE.md`
- **Konfigurace** → `../config/bridge-testnet.toml`
