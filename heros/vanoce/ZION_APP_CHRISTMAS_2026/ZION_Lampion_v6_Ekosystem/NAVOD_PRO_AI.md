# ZION — výměna vizuálů lampionu za v6

## Cíl

Použij tento balíček k nahrazení starého produktového lampionu v ZION Marketu,
aplikaci ZION a hlavním webu. Přesný seznam ověřených veřejných souborů je
v `replacement_manifest.json` a čitelně v `MAPA_NAHRAD.md`.
Živé weby tímto balíčkem dosud upraveny nebyly.

## Co je závazné

Výrobní SVG/DXF a přesný 3D model ve složce `reference_v6` určují rozměry a motivy.
Sestavený lampion: šestiúhelník, 140 mm přes vrcholy, 121,24356 mm přes plochy,
126 mm vysoký, nominálně 3mm překližka, otvor nahoře Ø 90 mm.
Šest stěn s bohatými květinovými výřezy a 20mm spodními pásy:

| Motiv | Dolní symbol / text |
|---|---|
| Srdce v lotosu | ÓM |
| Květ života | jin-jang |
| Lotos | peace |
| Strom života | ZION / TERRA NOVA |
| Srdcová mandala | Království / srdce |
| Hiranjagarbha na lotosu | slunce |

Vše je průchozí řez, včetně nápisů se šablonovými můstky. Výrobek nemá kovové
ucho, skleněné stěny ani stříšku. Marketingové scény jsou AI ilustrace:
ornamenty a světelné projekce jsou výtvarnou interpretací, nikoli řeznými daty
nebo fotografií dokončeného výrobku. Pro přesné konstrukční zobrazení použij GLB
a PNG referenčního modelu. Nevytvářej výrobní výkresy zpětně z marketingových obrázků.

## Postup v repozitářích

1. Najdi skutečné projekty obsluhující `market.zionterranova.com`,
   `app.zionterranova.com` a `zionterranova.com`. Z veřejné URL nelze spolehlivě
   odvodit název repozitáře ani jeho absolutní cestu. Nic si nevymýšlej.
2. Přečti projektové AGENTS.md a stav gitu. Pracuj v samostatné větvi.
3. Vyhledej všechny cesty z manifestu, basename i duplicity podle obrázku.
   Hledej v komponentách, CSS pozadích, datech produktů, JSON/MDX obsahu,
   lokalizacích, mobilních `<picture>` variantách, OG metadatech a service workeru.
   `rg -n -i 'lampion|christmas-kingdom|hero-kolekce-2027|market-open|03_lampion|01_balicek|02_konstrukce|03_vecerni_svetlo' .`
4. Adresář `replacements/DOMAIN/` obsahuje hotové nové WebP v původních
   rozměrech a se stejnými veřejnými cestami. Náhrada v místě zachová existující
   reference; `_v4` v historickém názvu souboru neznamená, že uvnitř zůstal starý design.
   Pokud projekt používá importy s hashováním, nech build vytvořit nové hashe.
5. Nejdřív proveď dry-run přiloženého skriptu. Skript vyžaduje veřejný adresář
   projektu a shodu původního SHA-256. Neshoda může znamenat novější úpravu:
   prohlédni ji a vyřeš ručně, neobcházej kontrolu.

```bash
python3 apply_replacements.py \
  --root market.zionterranova.com=/SKUTECNA/CESTA/market/public \
  --root app.zionterranova.com=/SKUTECNA/CESTA/app/public \
  --root zionterranova.com=/SKUTECNA/CESTA/main/public
```

Po kontrole přidej `--apply`. Originály se zálohují do `backups/` vedle skriptu.
Skript nemění zdrojové texty, neprovádí git commit, build ani deployment.
Nenalezené cíle nevytváří naslepo. Pro monorepo lze několika doménám zadat
tentýž skutečný `public` adresář, ale nejdřív zkontroluj kolize cest.

## Související opravy textů

Pouze v odstavcích a alt textech týkajících se tohoto lampionu:

| Původně | Nově |
|---|---|
| Ručně gravírovaný lampion | Laserem vyřezávaný a ručně sestavený lampion |
| Ruční gravírování | Laserový řez a ruční sestavení |
| gravírování vzoru Srdce Království | průchozí květinové výřezy a symboly šesti stěn |
| NOVINKA · GRAVÍROVANÝ VÝROBEK | NOVINKA · DŘEVĚNÝ LAMPION |

Stejnou významovou opravu udělej v angličtině a dalších skutečně existujících
lokalizacích, ale neměň ostatní gravírovací služby e-shopu. Doporučený alt:
„Lampion Království srdce v6 — šestihranná překližková lucerna s průchozími
mandalami a nápisy“. Stav „Připravujeme“, ceny, bonusy, nabídku knih, stav
výroby ani skladovou dostupnost neměň. V době auditu se lampion neobjevoval
mezi 23 položkami dynamického `/shop`; nevytvářej ani neaktivuj produkt bez zadání.

## Cache a kontrola nasazení

- Zkontroluj změny na homepage Marketu, `/vanoce`, detailu lampionu a galerii,
  knižních příběhových ukázkách, homepage App, seznamu novinek,
  `/news/christmas-2026` a hlavním landing page.
- Zvlášť ověř CSS obrázek `/hero-kolekce-2027.webp`; není běžný `<img>`.
- Ověř desktop i mobil a načítání obrázků pod přehybem. Dvě různá rozlišení
  stejné scény musí ukazovat stejnou novou verzi.
- Proveď projektový build a existující relevantní kontroly. Nezměň poměry stran
  nebo layout. Ověř čitelnost textů a že se v galerii nemíchá starý a nový výrobek.
- Při nasazení invaliduj příslušné CDN a Next Image cache. Ověř i service worker,
  cache v prohlížeči a sdílecí náhledy, pokud skutečně odkazují na dotčený asset.
  Pokud je nutné verzování URL, použij jednotné `?v=lampion-v6` nebo nové názvy
  a aktualizuj VŠECHNY reference včetně srcset/CSS/dat. Neměň obecné OG bannery,
  které starý produkt neobsahují.
- Ve výsledku vykazuj samostatně: změněno lokálně, otestováno, nasazeno.
  Samotné připravení tohoto ZIPu neznamená nasazení webů.

## Rozsah a doověření

`audit/` obsahuje záznam přečtených veřejných stránek, dostupnost domén a soupis
stažených obrázků. Sitemap a veřejné HTML neprokazují úplnost soukromých stránek,
nepřipojených assetů, databáze, klientských textur nebo dalších repozitářů.
Proto po otevření zdrojového kódu proveď ještě celorepozitářové hledání podle
manifestu, názvů lampionu a vizuálních duplicit.

`newearth.cz` během kontroly vracel HTTP 503. Tento web je nutné doověřit, až bude
dostupný; do něj balíček neobsahuje vymyšlené cílové cesty. Na veřejných úvodních
stránkách Free World, OASIS, Nirvana a Poolu nebyl identifikován starý maloobchodní
lampion. Běžné kovové lucerny držené postavami, svícny, portálové závěsné lampy
a vesmírná „lucerna“ Nabukana jsou jiné předměty. Nenahrazuj je plošně podle
slova lucerna. Novinkový hero je záměrně sjednocen s produktovým v6 i tam, kde
původně dívka držela jinou lampu; nově stojí na stole, protože výrobek nemá ucho.

Výroba a tepelná bezpečnost skutečné svíčky nebyly tímto vizuálním balíčkem ověřeny.
Do textů nepřidávej nové sliby o svíčce, certifikaci, dostupnosti nebo termínu dodání.
