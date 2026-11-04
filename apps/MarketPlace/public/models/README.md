# 3D modely pro detail produktu

Sem patří modely, které se zobrazují v interaktivním náhledu na detailu produktu.

## Lampion

Soubor (už nahraný, 4,3 MB, 8 dílů, ~236 k trojúhelníků):

```
public/models/lampion-kralovstvi-srdce.glb
```

Detail `/vanoce/lampion` ho **sám** nabídne k načtení —
v kódu se nic nemění (`model3d` v `src/data/christmasProducts.ts` už na tuhle
cestu ukazuje). Komponenta `src/components/xmas/Lantern3D.tsx` dělá před
načtením `HEAD` request; když soubor chybí, zobrazí se „3D náhled se připravuje"
místo chyby.

### Jak má model vypadat

- formát **glTF binární** (`.glb`) — jedna binárka i s texturami,
- doporučeně 50–150 tis. trojúhelníků, textury ≤ 2048 px,
- reálné měřítko je jedno (komponenta model automaticky vycentruje a zvětší
  do záběru), ale **stojí-li lampion na podstavci, nechte ho v modelu**,
- materiály PBR (metalness/roughness); tělo je světlé dřevo, výřezy prosvícené
  teplým světlem — komponenta přidává bodové světlo do středu, takže emissive
  mapa není nutná.

### Výkon

`three` se stahuje **až po kliknutí** na „Načíst 3D náhled", takže model
nezpomaluje první vykreslení stránky. Držte prosím `.glb` pod ~5 MB.
