# Peněženka ZION

ZION používá vlastní adresní formát založený na struktuře `zion1...`.

## Nejjednodušší cesta — přes ZION Public Miner

Pokud používáš desktopovou aplikaci:

1. Otevři záložku **Wallet**.
2. Klikni na **Create Wallet**.
3. Zaznamenej si seed na bezpečném místě.
4. Tvoje veřejná adresa (`zion1...`) se automaticky použije pro těžbu.

## Vytvoření peněženky z příkazové řádky

```bash
zion wallet create --name muj-wallet
```

## Záloha seedu

- Zapiš si 12/24 slovní seed v bezpečném offline místě.
- Nikdy seed neukládej na cloud ani nefoť.
- Zálohuj adresu a veřejný klíč pro příjem.

## Příjem a odesílání

```bash
# Zůstatek
zion wallet balance --name muj-wallet

# Odeslání
zion wallet send --from muj-wallet --to zion1qTVOJE_ADRESA --amount 1000
```

## Bezpečnostní tipy

1. Používej hardware wallet, pokud je k dispozici.
2. Nezadávej seed do webových formulářů.
3. Před velkou transakcí proveď test na malou částku.
