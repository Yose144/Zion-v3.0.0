# OASIS Avatar Art Collection · v0.1 — pracovní grafický balíček

Zdroj seznamu: https://app.zionterranova.com/l4-oasis/avatars (ověřeno 1. listopadu 2026).

**Rozsah**: 200 avatarů / 23 kruhů. To je přesný počet jmen opsaných z veřejně dostupného rosteru; barvy concept-artů jsou **výtvarné návrhy**, nikoli pro všechny postavy ověřené kanonické paprsky.

## Co je skutečně uvnitř

- `hero/`: jeden vytvořený **OASIS gateway hero** v originálu, širší podobě a webovém 16:9 exportu, WebP.
- `concept_portraits/`: **200 odlišných procedurálně ilustrovaných konceptových portrétových karet** WebP (640 × 640); použitelné jako dočasné obrázky na webu, nikoli jako definitivní AAA charaktery.
- `concept_svg/`: stejných 200 konceptů ve vektorovém zdrojovém formátu SVG (1024 × 1024).
- `final_portraits/`: **4 detailní AI portrétní návrhy**, Maitreya, Rama, Sita a Hanuman (1024 × 1024), vyříznuté ze společně generované kompozice; zatím nejsou schválené jako věrné kanonické podoby.
- `prompts/`: 200 jednotlivých zadání pro budoucí realistické rendery, bez log a bez textu.
- `manifest.json` a `avatar_roster.csv`: stabilní identifikátory OASIS-001 až OASIS-200, názvy, okruhy, návrh výtvarného stylu, relativní cesty a stav schválení.
- `oasis-web-manifest.json`: tenká databáze pro frontend.
- `preview/oasis-200-contact-sheet.webp`: vizuální audit všech konceptových návrhů.
- `gallery.html`: **interaktivní offline galerie** všech 200 konceptů s vyhledáváním, výběrem kruhu a promptem; stačí otevřít soubor v prohlížeči.

**Pozor**: TENTO ARCHIV NENÍ hotová sada 200 realistických AI portrétů. Je to kompletní katalog, 200 dočasných ilustrací, čtyři detailnější portréty a jeden velký společný hero. Finální jednotlivé portréty se musí po schválení identity vyměnit za cílový artwork.

## Jak nasadit do Next.js

Zkopíruj do `public/oasis-assets/` adresáře `concept_portraits`, `final_portraits` a `hero`.

```jsx
import roster from './oasis-web-manifest.json';
const avatar = roster.find(a => a.id === 'OASIS-005');
const imageSrc = avatar.finalPortrait || avatar.art;
return <img src={imageSrc} alt={avatar.name} width={320} height={320} />;
```

`oasis-web-manifest.json` patří do adresáře, ze kterého importuješ JSON soubor (ne do `public`, pokud jej chceš staticky importovat).

## Schvalovací workflow

1. Zkontrolovat identitu a podobu vůči původnímu OASIS kánonu, zejména Maitreya, Sita, Sarah Issobella, LUMI a Hiran.
2. Pro každého avatara vytvořit náhled 1:1 a po schválení definitivní 1024–2048 px WebP; měnit pouze cestu `finalPortrait`.
3. Zkontrolovat citlivé tradiční motivy s komunitami a odborníky, kde stránka obsahuje poznámku `consult`.
4. Pro Matrix postavy ověřit práva, pokud má jít o komerční herní použití; koncepty nevyužívají podobu herců.
5. U kolektivních a abstraktních avatarů nepoužívat automaticky lidskou tvář.
6. Neočekávat, že WebP/JPG je 3D model — pro Unreal Engine se samostatně připravuje character sheet, turntable, rigging, mesh, materiály a animace.

## Poznámka k referencím

Uživatel dříve zdůraznil konkrétní podobu Maitreyi a dalších postav; tato sada reference neobsahuje a proto neslibuje dokonale shodnou identitu. Doplň je do další iterace před schválením model sheets.

© 2026 — koncepční vizualizace pro ZION TerraNova OASIS. S kulturními a licenčními právy je nutné pracovat individuálně.
