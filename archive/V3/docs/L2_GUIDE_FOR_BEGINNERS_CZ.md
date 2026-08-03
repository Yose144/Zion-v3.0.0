# ZION V3 L2 - navod pro uplne lajky

Tento navod je napsany tak, aby ho zvladl i clovek, ktery L2 nikdy nespoustel.

Cil: spustit tri L2 sluzby:
- bridge (most mezi L1 a EVM / Base mainnet)
- swap (atomic swap service)
- dao (governance API)

Pokud pojedes krok po kroku, nemas co pokazit.

---

## 0) Stav kontraktu na Base mainnet (chain 8453)

Vsechny 3 kontrakty jsou uz nasazene a overene na BaseScan:

| Kontrakt | Adresa |
|----------|--------|
| wZION (ERC-20) | 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 |
| ZIONBridge | 0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721 |
| ZIONAtomicSwap | 0x3DE9Ad42716854083ab837706E3961d10B0e63Eb |

Overeni na BaseScan:
- https://basescan.org/address/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6#code
- https://basescan.org/address/0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721#code
- https://basescan.org/address/0x3DE9Ad42716854083ab837706E3961d10B0e63Eb#code

---

## 1) Co je L2 jednoduse

- L1 = hlavni chain (jadro site)
- L2 = doplnkove sluzby nad L1

L2 muze bezet az po tom, co bezi L1.

---

## 2) Co potrebujes

Minimalne:
- Linux server nebo Mac/Linux stroj
- Docker + Docker Compose
- repozitar 2.9.6 naklonovany na disku

Rychla kontrola:

docker --version
docker compose version

---

## 3) Kde pracovat

Vzdy zacni v rootu projektu:

cd /Users/yeshuae/Projects/2.9.6

---

## 4) Priprava L2 profilu (jednorazove)

Zkopiruj pripravenou sablonu:

cp -n V3/docker/.env.l2.example V3/docker/.env.l2

Pak otevri soubor V3/docker/.env.l2 a dopln:

- ZION_SWAP_ESCROW_KEY
- ZION_VALIDATOR_PRIVATE_KEY

A vyber profil configu:

Testnet:
- ZION_BRIDGE_CONFIG=/etc/zion/bridge-testnet.toml
- ZION_SWAP_CONFIG=/etc/zion/swap-testnet.toml
- ZION_DAO_CONFIG=/etc/zion/dao-testnet.toml

Mainnet:
- ZION_BRIDGE_CONFIG=/etc/zion/bridge-mainnet.toml
- ZION_SWAP_CONFIG=/etc/zion/swap-mainnet.toml
- ZION_DAO_CONFIG=/etc/zion/dao-mainnet.toml

Dulezite:
- nikdy nedavej privatni klice do gitu
- nech je jen v .env nebo secrets manageru

---

## 5) Spusteni L2

Nejdriv over, ze bezi L1.

Pak spust L2:

docker compose --env-file V3/docker/.env.l2 -f V3/docker/docker-compose.v3-l2.yml up -d --build

---

## 6) Kontrola, ze vse bezi

Stav kontejneru:

docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'zion-v3-bridge|zion-v3-swap|zion-v3-dao'

Health endpointy:

curl -fsS http://127.0.0.1:9100/health
curl -fsS http://127.0.0.1:8888/health
curl -fsS http://127.0.0.1:8450/api/dao/health

Pokud je vse OK:
- bridge vrati JSON se status ok
- swap vrati ok
- dao vrati JSON se status ok

---

## 7) Logy pri problemu

Bridge:

docker logs --tail 120 zion-v3-bridge

Swap:

docker logs --tail 120 zion-v3-swap

DAO:

docker logs --tail 120 zion-v3-dao

Live sledovani:

docker compose --env-file V3/docker/.env.l2 -f V3/docker/docker-compose.v3-l2.yml logs -f

---

## 8) Bezpecne zastaveni nebo restart

Zastaveni L2:

docker compose --env-file V3/docker/.env.l2 -f V3/docker/docker-compose.v3-l2.yml down

Restart L2:

docker compose --env-file V3/docker/.env.l2 -f V3/docker/docker-compose.v3-l2.yml restart

---

## 9) Nejcastejsi chyby a rychla oprava

1. Chyba: required variable ZION_SWAP_ESCROW_KEY is missing
- Reseni: dopln ZION_SWAP_ESCROW_KEY do V3/docker/.env.l2

2. Chyba: bridge config validation fail (mainnet)
- Reseni: zkontroluj non-zero adresy kontraktu a start_block v bridge-mainnet.toml

3. Chyba: submitBridgeUnlock validator proofs failed
- Reseni: nastav na core hostu
  - ZION_BRIDGE_VALIDATOR_PUBKEYS
  - ZION_BRIDGE_VALIDATOR_THRESHOLD
  a v bridge nastav validni validator klice

4. Sluzba bezi, ale nekomunikuje
- Reseni: over, ze bezi L1 RPC a ze jsou spravne rpc_url v configu

---

## 10) Ultra kratky tahak

1) cp -n V3/docker/.env.l2.example V3/docker/.env.l2
2) dopln klice do V3/docker/.env.l2
3) docker compose --env-file V3/docker/.env.l2 -f V3/docker/docker-compose.v3-l2.yml up -d --build
4) curl health endpointy
5) kdyz je problem, cti docker logs

---

## 11) Overeni live kontraktu na Base mainnet (z lokalniho stroje)

cd L2/contracts && npx hardhat run scripts/check-live-contracts.js --network base

Melo by vypsat:
  === wZION ===
  name: Wrapped ZION
  decimals: 18
  paused: false

  === ZIONBridge ===
  threshold: 1
  paused: false

  === ZIONAtomicSwap ===
  feeBps: 0
  paused: false

---

## 12) Testy (lokalne — bez serveru)

Solidity testy (132 testu):

cd L2/contracts && npx hardhat test

Rust L2 testy (260 testu):

cd V3 && cargo test -p zion-bridge -p zion-atomic-swap -p zion-dao

---

Pokud chces, muzu jako dalsi krok dodelat i verzi tohoto navodu pro uplne netechnicke lidi (bez shell detailu), jen jako checklist klik-po-kliku pro operatora.
