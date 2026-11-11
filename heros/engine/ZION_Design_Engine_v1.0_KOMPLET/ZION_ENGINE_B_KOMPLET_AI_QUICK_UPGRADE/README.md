# Quick upgrade — ZION B / Manga

Balíček aktualizuje obrazovou vrstvu Marketu a Appky: 23 katalogových produktů, 19 umístění produktových detailů a galerií, 21 hero obrazů Appky, mobilní velikosti, hlavní hero Marketu a poster Nirvany. Celkem 107 WebP a dvě původní značkové vrstvy. Některá umístění používají stejný obraz. Otevři PREHLED.html pro náhledy.

## Pro AI

Začni souborem AI/START_HERE.md. Přesné cíle jsou v MAPOVANI.csv. Kód je v code.patch a source/apps/. Kompletní instrukce enginu jsou v AI/ZION_DESIGN_ENGINE_v1.0.md a AI/reference/.

## Rychlé nasazení do existujícího repozitáře

1. Založ pracovní větev a zálohuj nahrazované soubory z public. Zachovej rozpracované změny. Základ patche: cf090fa266394052d71be66d6b31f6bbb42925aa.
2. V kořeni repozitáře ověř patch, potom jej aplikuj:

```bash
git apply --check /absolutni/cesta/k/balicku/code.patch
git apply /absolutni/cesta/k/balicku/code.patch
```

Pokud už existuje pilotní verze nebo se zdroje změnily, sluč změny podle source/apps/. Nepřepisuj celé aktuální zdrojové soubory naslepo. Nepoužívej reset ani force.

3. Zkopíruj **obsah** market/public/ do apps/MarketPlace/public/ a app/public/ do apps/website-v2.9/public/. Zachovej všechny ostatní soubory. Nepoužívej mazání cílových adresářů ani rsync --delete.
4. V úplném repozitáři nainstaluj závislosti a sestav aplikace obvyklým postupem:

```bash
npm ci
npm run build -w zion-wallet-sdk
npm run build:market
npm run build:web
```

5. Prohlédni staging na mobilu i desktopu. Teprve potom použij existující nasazovací postup projektu. U standalone výstupu musí být public také u běžícího serveru. Tento ZIP sám nic nenasazuje.
6. Nové URL jsou verzované ?v=engine-v1. Pokud CDN query ignoruje, promaž příslušné URL z MAPOVANI.csv.

## Kontrola po nasazení

- Market: /, /shop, /cart, /vanoce/zion-pass, /vanoce/kniha-kralovstvi-srdce, /vanoce/lampion.
- App: /, všech devět slidů, /zion-archive, /l3-hiran, /l4-oasis, /l5-free-world, /team a příběhové stránky TerraNova.
- Žádné 404 obrázky. Ověř mobil 390 px, tablet 768 px a desktop 1440 px, klávesnici, překlady, kontrast titulků a omezený pohyb.
- Produktové ilustrace nesmí ořezat lampion. Přesnou konstrukci porovnej se skutečným Lumi 2 a stávajícím 3D modelem. U Maitreyi ověř kanonickou podobu podle originálu; samotná shoda stylu není schválení identity.
- Nákup a přihlášení ověř ve stagingu bez skutečné platby. Produkční objednávky ani wallet operace nejsou součástí vizuální migrace.

## Návrat zpět

Vrať vlastní migrační commit a nahrazované obrázky ze zálohy; obnov předchozí build standardním postupem. Nevracej cizí změny a nemaž public jako celek.

## Zachované části

Rasta Market: červená–zlatá–zelená, tmavý základ, navigace a tlačítka; originální evoluZion 2008 a keporkak. Ceny, sklad, databáze, objednávky, platby, účty, 3D modely, výrobní podklady, oficiální avatary a dodávané knihy se nemění. Vize zůstávají označené jako vize. Tento balíček řeší Market a Appku; není nasazením do všech dalších samostatných služeb ekosystému.
