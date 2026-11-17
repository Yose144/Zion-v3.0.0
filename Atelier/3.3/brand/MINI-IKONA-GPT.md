ZADÁNÍ: MINI IKONA (favicon) pro ZION 3.3 — odvozená ze schváleného kanonu

# Co máš udělat

Z přiloženého schváleného znaku (`logo/canon-emblem-512.png`, plný emblém:
krystalická koruna, kmen prorůstající Z, kořeny, zlatý kruh) navrhni
**zjednodušenou mini ikonu**, která je čitelná v 16 px. Není to nová značka —
je to zjednodušení té stávající, stejný tvar, méně detailů.

Proč: plný emblém se v 16 px slije do barevné šmouhy. Potřebujeme variantu,
kde je Z rozeznatelné na první pohled, a to na tmavém i světlém podkladu.

# Co musí zůstat

- **Silueta Z** zůstává dominantní. Koruna nad ním smí být jen náznak (tři až pět
  plochých hrotů), kořeny mohou zmizet nebo být tři krátké tahy.
- **Rasta barevnost** jen jako náznak, ne duha: zelená–zlatá–rezavá.
- Styl: plné plochy, žádný gradient, žádná textura, žádný stín, žádné písmo
  kromě Z, žádná merkaba, žádné rámečky, žádné další symboly.
- Musí fungovat **na inkoustovém i pergamenovém podkladu**.

# Co dodat (3 master soubory, 1024 × 1024, PNG, neprůhledné)

1. `zion-mini-dark__master.png` — inkoustová plocha (#101C2B), znak zlatý
   (#E7AA4B) s náznakem rasta detailu.
2. `zion-mini-light__master.png` — pergamenová plocha (#F0E1BE), znak
   inkoustový (#101C2B), rasta detail jen jako drobný akcent.
3. `zion-mini-mono__master.png` — jednobarevná silueta (inkoust na průhledném
   nebo na pergamenu), pro gravírování a tisk.

Ke každému souboru napiš, jak vypadá v 16 px (kontrola: poznáš Z? ano/ne).
Když si nejsi jistý, udělej raději tlustší tahy a méně detailů — cílem je
čitelnost, ne krása při 1024 px.

# Co nedělat

- Nekreslit nový znak, nepřidávat iniciály, písmena, hvězdy, oči, křídla.
- Nepřidávat merkabu, svatozář, prstenec kolem dokola (kruh z kanonu nech
  jen tehdy, když zůstane čitelný).
- Nepoužívat tenké linky — v 16 px zmizí.
- Nevkládat text ani „ZION".

# Poznámka k použití

Z těchto masterů se odvodí favicony 16/32/48, PWA ikony 192/512 a Apple 180.
Plný kanon (`logo/canon-emblem-1024.png`) zůstává pro hlavičku, OG a tisk —
mini ikona ho nenahrazuje, jen doplňuje tam, kde je plocha malá.
