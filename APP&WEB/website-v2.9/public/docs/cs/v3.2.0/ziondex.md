# ZionDEX — Uživatelský průvodce

> **Verze:** v3.2.0 "One Love"  
> **Síť:** Base Mainnet pilot + ZION L1 HTLC fallback  
> **Web:** [/swap](/swap) a [/dex](/dex)

---

## Co je ZionDEX

ZionDEX je nativní ZION decentralizovaná burza. Umožňuje swapovat tokeny, přidávat likviditu do on-chain AMM poolů a sledovat pozice z jednoho rozhraní.

Vydání v3.2.0 spouští swap engine proti **Base Mainnet AMM** (ZionDexRouter / ZionDexFactory). ZION L1 HTLC atomic swapy jsou také dostupné pro cross-chain obchody, které nevyžadují custodial bridge.

---

## Jak začít

1. **Přihlas se přes ZIS** v horní části stránky (email, Google, MetaMask nebo X).
2. **Připoj peněženku** nebo použij generovanou multichain peněženku pro příjem depositů.
3. **Deponuj** token, který chceš obchodovat, do své ZION peněženky.
4. **Swapuj**, **přidávej likviditu** nebo **prohlížej portfolio**.

Pro webové rozhraní nemusíš nic instalovat. Desktop App a CLI nabízejí stejnou funkčnost pro pokročilé uživatele.

---

## Swapování tokenů

1. Jdi na [/swap](/swap) nebo na záložku **DEX**.
2. Vyber chain a token, který chceš prodat.
3. Vyber token, který chceš koupit.
4. Zadej částku.
5. Zkontroluj quote, slippage a deadline.
6. Potvrď swap. Transakce je podepsána multichain peněženkou a odeslána on-chain.

Quote engine zkouší **single-hop, two-hop a three-hop routy** napříč dostupnými likviditními pooly. Pokud neexistuje přímý pool, engine může routovat přes mezitoken jako WETH nebo stablecoin.

---

## Likviditní pooly

### Přidání likvidity

1. Jdi na [/dex/liquidity](/dex/liquidity).
2. Vyber dva tokeny, které chceš deponovat, například `tZION` a `tUSDT` na Base.
3. Zadej částku každého tokenu.
4. Volitelně nastav recipient adresu a deadline.
5. Potvrď. Obdržíš **LP tokeny** reprezentující tvůj podíl v poolu.

### Odebrání likvidity

1. Otevři záložku **Remove** na [/dex/liquidity](/dex/liquidity).
2. Vyber pool a zadej množství LP tokenů, které chceš vybrat.
3. Zkontroluj očekávané částky každého tokenu.
4. Potvrď. LP tokeny se spálí a podkladové tokeny se vrátí.

---

## Portfolio

Stránka [/dex/portfolio](/dex/portfolio) zobrazuje:

- Tvé poslední swapy.
- Aktivní AMM pooly a jejich on-chain pair adresy.
- Stav poolu (active / pending).

Stránka se automaticky aktualizuje, když přidáš nebo odebereš likviditu.

---

## Beta test tokeny

Během veřejné beta používá webové rozhraní test tokeny na Base Mainnet (například `tZION`, `tUSDT`, `tWETH`), aby se mohl AMM flow procvičovat reálnými on-chain voláními bez rizika pro hlavní wZION supply.

Seznam poolů na [/dex/liquidity](/dex/liquidity) ukazuje, které pooly jsou aktivní a které jsou stále v řadě na deploy.

---

## Bezpečnostní poznámky

- Před potvrzením swapu vždy zkontroluj adresu token contractu.
- Nastavení slippage a deadline tě chrání před front-runningem a zastaralými quoty.
- Poskytování likvidity je non-custodial: tvé LP tokeny jsou pod tvou kontrolou.
- Cross-chain HTLC swapy vyžadují, aby obě strany claimovaly v rámci timelock okna.

---

## Řešení problémů

| Problém | Co dělat |
|---------|----------|
| Quote selže | Zkus menší částku nebo jiný pár. Některé páry mají likviditu jen na Base. |
| Swap reverts s "insufficient balance" | Nejprve deponuj potřebný token nebo sniž částku. |
| Přidání likvidity selže | Ujisti se, že máš oba tokeny a dostatek pro minimální dust threshold. |
| Portfolio je prázdné | Přihlas se, aby server mohl vyhledat tvou historii a pool pozice. |
