Flowers — nová drobná jednotka ZION
=================================

Stručně: Zion bude mít 12 desetinných míst; nejmenší jednotka se jmenuje "Flower" (množ. "Flowers"). Flowers slouží obdobně jako Satoshis pro Bitcoin.

- Jméno: Flower (plurál Flowers)
- Zkratka hlavní měny: ZION
- Počet desetinných míst: 12
- Poměr: 1 ZION = 1 000 000 000 000 Flowers (10^12)

Příklady
--------

- 0.000000000001 ZION = 1 Flower
- 0.000000001000 ZION = 1 000 Flowers
- 1 ZION = 1 000 000 000 000 Flowers

Ukládání a interní reprezentace
-------------------------------

- Interně ukládejte vždy jako celočíselný počet Flowers (integer / bigint). Nikdy nepoužívejte plovoucí desetinnou čárku pro přesnost a konzistenci.
- API/DB pole by mělo být typu integer (64bit nebo big integer podle potřeby). Pokud migrujete z menší přesnosti, přepočítejte hodnoty násobením faktorem 10^12 / 10^N_old.

Zobrazení v UI a zaokrouhlování
--------------------------------

- V UI zobrazujte primárně hodnotu v ZION s až 12 desetinnými místy podle potřeb uživatele.
- Pro běžné přehledy (balanc, transakce) používejte inteligentní formát: pokud je částka < 0.000001 ZION, zobrazte ji jako počet Flowers (např. "137 Flowers") nebo jako "0.000000137000 ZION" podle kontextu.
- Zaokrouhlování: pro zobrazování používejte round-half-up na 12 desetinných míst; interně žádné zaokrouhlování nedělejte — ukládejte přesný počet Flowers.

API / RPC změny
---------------

- Nová/aktualizovaná pole by měly očekávat/vracet integer hodnoty v jednotce Flowers, nebo vždy obsahovat doplňkové pole s Flowers (např. `amount_flowers`) vedle `amount_zion` pro zpětnou kompatibilitu.
- Při návrhu nových endpointů dokumentujte jednotku (Flowers) jasně v API spec.

Migrace a kompatibilita
-----------------------

- Pokud starší verze používaly méně desetinných míst, provede se migrace množství násobením odpovídajícího faktoru, aby se převedly na Flowers.
- Klientské knihovny musí poskytnout utility `toFlowers(zionDecimal)` a `fromFlowers(flowersInt)` pro bezpečné konverze.

Další poznámky
--------------

- Ve finančních výpočtech vždy pracujte s Flowers (integer) a aplikujte formátovací konverzi až při zobrazení.
- Označení v UI: používejte `ZION` jako hlavní měnu a `Flowers` jako popisek pro drobné částky. Příklad: "0.000000000123 ZION (123 Flowers)".

Kontakt / návrhy
----------------

Pokud chcete, aby tento zápis obsahoval konkrétní API příklady (JSON), migrace skripty nebo návrhy změn v DB schématu, napište, co preferujete a doplním je sem.
