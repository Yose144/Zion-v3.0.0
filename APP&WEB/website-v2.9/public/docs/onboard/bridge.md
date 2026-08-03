# Bridge a WARP

WARP je nativní most ZION pro přenosů tokenů mezi L1 a L2.

## Základní pojmy

- **wZION** — wrapped ZION na EVM kompatibilních řetězcích.
- **WARP** — cross-chain routing a likvidita.
- **ZION Bridge** — kontrakt pro lock/release mezi L1 ↔ L2.

## Kontrakt

- wZION: `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`

## Jak to funguje

1. Uzamkneš ZION na L1 bridge kontraktu.
2. Mintne se ti ekvivalentní množství wZION na cílovém L2.
3. Pro zpětný převod wZION spálíš a L1 bridge release původní ZION.

## API

```bash
curl https://api.zionterranova.com/api/bridge/status
```

Vrátí aktuální stav mostu, likviditu a poslední transakce.

## Bezpečnost

- Vždy ověřuj adresu kontraktu na oficiálním zdroji.
- Nezasílej tokeny na cizí adresy.
- Pro testy použij malé částky.
