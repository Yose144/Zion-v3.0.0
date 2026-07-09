# Těžba ZION

> ZION se těží pomocí Proof-of-Work s algoritmem **Cosmic Harmony Deeksha**. Těžba je jediný mechanismus nové emise — žádné stakingy, ICO ani presale.

---

## Cosmic Harmony Deeksha

Cosmic Harmony Deeksha je kanonická PoW cesta pro současné řady ZION:

- **přívětivý k CPU** — vyvážený pro běžný hardware (x86, ARM)
- **akcelerovatelný na GPU** — OpenCL/CUDA je konkurenceschopné, nedominuje
- **odolný vůči ASIC** — memory-hard design ztěžuje specializovaný hardware
- **anti-botnet** — kalibrace tak, aby to dávalo smysl na spotřebním hardware, ne na kompromitovaných strojích

Algoritmus je implementován v Rustu a zpřístupněn přes nativní vazby pro různé platformy.

---

## Odměna za blok

| Epochová dekáda | Odměna / blok | Roky |
|-----------------|---------------|------|
| Genesis (2026) | 5 400,067 ZION | 0–10 |
| Dekáda 2 | ~4 320 ZION | 10–20 |
| Dekáda 3 | ~3 456 ZION | 20–30 |
| … (−20 % / dekáda) | … | … |
| Tail (trvalý) | 725 ZION | 100+ |

Decay je automatický na úrovni protokolu — bez hlasování minerů, bez měkkého vidlice jen kvůli tomu.

Každý blok se odměna rozdělí:

| Příjemce | Podíl |
|----------|-------|
| **Těžař** | 89 % |
| Humanitární fond | 5 % |
| Nadace Issobella | 5 % |
| Mining pool | 1 % |

Veškeré **transakční poplatky se pálí**. Není samostatný dev fee.

---

## Těžba přes pool

Veřejný pool ZION běží na **primárním hostu Zion2** a používá Stratum v2 s PPLNS.

**Adresa poolu:** `stratum+tcp://seed.zionterranova.com:3333`

```bash
zion-miner \
  --pool stratum+tcp://seed.zionterranova.com:3333 \
  --wallet VASE_ZION_ADRESA \
  --threads 4
```

Okno PPLNS: výplata proporcionální k share v posledních N příspěvcích — čím déle těžíte stabilněji, tím hladší výplaty.

---

## Solo těžba

Připojte se přímo na RPC seed uzlu:

```bash
zion-miner \
  --rpc http://seed.zionterranova.com:8444 \
  --wallet VASE_ZION_ADRESA \
  --solo
```

Solo při nalezení bloku dává 100 % miner podílu (89 % celkově). Při vysoké obtížnosti vyžaduje výrazný hashrate.

---

## Dual mining (ZION + VRSC)

Podpora dual mining — **Cosmic Harmony Deeksha** současně s **VerusHash**:

```bash
zion-miner \
  --pool stratum+tcp://seed.zionterranova.com:3333 \
  --wallet VASE_ZION_ADRESA \
  --dual-pool stratum+tcp://VERUS_POOL:PORT \
  --dual-wallet VASE_VRSC_ADRESA
```

---

## Peněženka

Generujte peněženku lokálně — klíče neopouštějí stroj:

```bash
zion-wallet gen-mnemonic --out wallet.json --print
zion-wallet address --from wallet.json
zion-wallet balance --address VASE_ADRESA --rpc http://seed.zionterranova.com:8444
```

Soubory používají Ed25519 (BIP39 seed → Ed25519). Mnemotechniku uchovávejte offline.

---

## Plný uzel

Plné uzly validují bloky a posilují síť:

```bash
zion-node \
  --network testnet \
  --rpc-port 8444 \
  --p2p-port 8334 \
  --data-dir ~/.zion/testnet

curl -X POST http://localhost:8444/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getblockchaininfo","id":1}'
```

Seed uzly:
- `seed.zionterranova.com:8334` (Zion2)
- `seed1.zionterranova.com:8334`
- `seed2.zionterranova.com:8334`
- `seed3.zionterranova.com:8334`

---

## DAA

**LWMA** (Linearly Weighted Moving Average), okno 60 bloků, limit úpravy ±25 % na okno — stabilní ~60 s mezi bloky.

---

## Stáhnout

[soubory CLI — zionterranova.com/download](https://zionterranova.com/download)

Binárky: `zion-node`, `zion-miner`, `zion-wallet`, `zion-pool`

---

_Pozn.: Soubor v repu `design-system.md` obsahuje provozní těžební dokumentaci._
