# Peněženka ZION

ZION používá vlastní adresní formát založený na struktuře `zion1...`.

## Vytvoření peněženky

Nejrychlejší cesta je CLI:

```bash
zion wallet create --name muj-wallet
```

Případně přes ZION Desktop Agent v GUI.

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
