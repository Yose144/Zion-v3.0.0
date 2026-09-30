# ZionDEX — Uživatelský průvodce

> **Verze:** v3.2.0 "One Love"  
> **Web:** [Multichain → DEX](/multichain#dex) · [Swap](/multichain#swap) · [Výnosy](/multichain#earn) · [Bridge](/multichain#bridge)

---

## Co je ZionDEX

ZionDEX je nativní ZION rozhraní pro decentralizovanou směnu. Spojuje dvě věci na jednom místě:

- **cross-chain swap engine** napájený L3 WARP bridge — přesouvá hodnotu napříč 13+ chainy bez syntetických wrap tokenů,
- **Uniswap V3 trh** `wZION/USDT` na Base Mainnetu, obchodovaný přímo z tvé vlastní EVM peněženky.

Všechno žije na stránce [Multichain](/multichain) — záložky DEX, Swap, Výnosy, Bridge, Governance a Aukce.

---

## Cross-chain swap — záložka DEX

Záložka **DEX** ([/multichain#dex](/multichain#dex)) obsahuje cross-chain swap widget, živý graf ceny `wZION/USDT` a seznam poolů s on-chain rezervami.

1. Otevři [/multichain#dex](/multichain#dex).
2. Vyber **zdrojový chain a token**, který chceš prodat, a **cílový chain a token**, který chceš obdržet — podporované chainy jsou mimo jiné Base, Arbitrum, BSC, Polygon, Optimism, Avalanche, Solana, Tron, Stellar, Cardano, Cosmos, Aptos, Sui, Near, TON, ZION L1 a Bitcoin/Lightning.
3. Zadej částku a **cílovou adresu**.
4. Zkontroluj quote a routu, kterou engine vybral.
5. Potvrď — vypořádání je non-custodial přes WARP bridge.

## Swap wZION na Base — záložka Swap

Záložka **Swap** ([/multichain#swap](/multichain#swap)) obchoduje `wZION/USDT` na **Uniswapu V3** (Base Mainnet) přímo z tvé peněženky — ZION nic nedrží.

1. Otevři [/multichain#swap](/multichain#swap) a klikni **Connect Wallet** (MetaMask).
2. Pokud tě to vyzve, přepni peněženku na **Base Mainnet**.
3. Vyber směr (`wZION → USDT` nebo zpět), zadej částku, zkontroluj quote a slippage.
4. Potvrď — transakce se podepíše ve tvé peněžence a vypořádá se on-chain.

Záložka zároveň ukazuje tvé zůstatky wZION/USDT a LiFi widget agregující 30+ DEXů a 20+ bridgů pro delší routy.

## Záložky Výnosy a Bridge

- **Výnosy** ([/multichain#earn](/multichain#earn)) — stakeuj nebo farm wZION pro pravidelné odměny.
- **Bridge** ([/multichain#bridge](/multichain#bridge)) — přesouvej ZION L1 ↔ wZION na Base Mainnetu se sledováním konfirmací a historií posledních převodů.

---

## Likvidita

Rezervy poolů v záložce DEX jsou živá on-chain data. Likviditu do páru `wZION/USDT` přidáváš přímo na **Uniswapu V3** — záložka Swap na pool odkazuje. Žádná samostatná stránka pro správu LP pozic v aplikaci není — tvoje LP pozice žije ve tvé peněžence.

---

## Pilotní test tokeny

Na Base má ZionDex AMM také pilotní páry (`tZION`, `tUSDT`, `tWETH`), které slouží k end-to-end procvičení cross-chain AMM. Jsou to pilotní aktiva — ne kanonická wZION supply.

---

## Bezpečnostní poznámky

- Před potvrzením swapu vždy zkontroluj adresu token contractu.
- Nastavení slippage a deadline tě chrání před front-runningem a zastaralými quoty.
- Swapy v záložce Swap podepisuje **tvoje** peněženka — ZION nad tvými EVM prostředky nemá custodii.
- Cross-chain převody jsou non-custodial; před provedením dvakrát zkontroluj cílovou adresu.

---

## Řešení problémů

| Problém | Co dělat |
|---------|----------|
| Quote selže | Zkus menší částku nebo jiný pár — některé páry mají likviditu jen na Base. |
| Peněženka se nepřipojí | Ujisti se, že je MetaMask odemčený a nastavený na **Base Mainnet**; záložka Swap nabízí přepnutí sítě na jedno kliknutí. |
| Swap reverts s "insufficient balance" | Zkontroluj, že držíš vstupní token a dost ETH na Base pro gas. |
| Pooly se nezobrazují | Seznam čte živé on-chain rezervy — obnov stránku nebo to zkus za chvíli. |
