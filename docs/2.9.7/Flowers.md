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

Poplatek (fee) — spalování a rituál oběti
---------------------------------------

- Spalování (fee burn): Síť může spalovat část transakčních poplatků jako `fee_burn` (v jednotce Flowers) za účelem snížení nabídky a stabilizace hodnoty. Spalování by mělo být prováděno deterministicky a transparentně.
- Rituální oběť do oceánu: Vedle standardního spalování navrhujeme volitelný mechanismus nazvaný "ocean tribute" — symbolická část poplatků nebo malé procento poplatku, které se místo okamžitého spalování alokuje do speciálního, auditovatelného fondu určeného na obnovu mořských ekosystémů a projekty záchrany oceánu. Tento mechanismus není magickým řešením, ale programově řízenou formou, jak vrátit část hodnoty zpět planetě a podpořit environmentální iniciativy.
- Implementační návrh:
	- Přidejte volitelné pole `fee_burn_flowers` a `ocean_tribute_flowers` do transakčních výpisů (interně integer Flowers).
	- Přidejte příznak `ocean_tribute` v transakci nebo v síťových pravidlech, aby bylo možné aktivovat či deaktivovat tuto volbu.
	- Fond pro "ocean tribute" spravovat pomocí multisig/nebo DAO mechanismu, s pravidelnými veřejnými reporty a nezávislými audity použití prostředků.
- Migrace a governance: Před spuštěním "ocean tribute" programu je nezbytné zajistit existenci konkrétních projektů obnovy mořského života, smluv s neziskovkami nebo grantových mechanismů. Návrh musí být schválen governance procesem a auditovatelný.
- Bezpečnost a transparentnost: Veškeré peněžní toky musí být plně auditovatelné on-chain; správci fondu musí podléhat pravidelným auditům, reportům a komunitní kontrole.


Kontakt / návrhy
----------------

Pokud chcete, aby tento zápis obsahoval konkrétní API příklady (JSON), migrace skripty nebo návrhy změn v DB schématu, napište, co preferujete a doplním je sem.
