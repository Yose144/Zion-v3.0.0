# Nasazení do ZION 3.3

## Soubory
Do public/ cílové appky: favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png. PNG favicon 16/32/48 lze použít jako další metadata.icons. coingecko-200.png je 200 × 200 RGBA pro listing; nejde o soubor ICO.

Aktuální oficiální preference ověřené v tomto vlákně: CoinGecko preferuje 200 × 200 px v PNG/JPG/WebP a průhledné pozadí.
Zdroj: https://support.coingecko.com/articles/7992544912-how-do-i-update-my-token-logo-on-coingecko

Přiložený site.webmanifest je minimální příklad: existující manifest nenahrazuj naslepo. Zachovej start_url, scope, id, shortcuts a ostatní produktové údaje stávající aplikace; aktualizuj pouze odpovídající ikony. Ikony nejsou maskable.

## Kontroly v repu
- apps/{onboard,portal,kingdom,market}/public/: sjednotit cesty a metadata.icons.
- Market obsahoval navíc src/app/favicon.ico; cíleně vyřešit konflikt s public/favicon.ico.
- Hlavičky onboard/portal používají /logo/emblem-128.png. Jejich změna je samostatný krok od favicony.
- packages/ui/src/brand.tsx obsahoval starší plochý glyf; nevydávat ho za tento nový master.
- Novou verzovanou složku, hash a zdroj zapsat do design manifestu. Starý dvojznakový master zachovat; nepřepisovat jeho manifest/SHA.
- Spustit vyžadované kontroly aktuálního AGENTS.md, při změně Marketu také verify:market. V tomto balíčku aplikace nebyly měněny ani buildovány.
- Po nasazení ověřit favicon v prohlížeči na světlé/tmavé liště, PWA/iOS a skutečné soubory na URL. Při změně používat verzování URL/cache a mít předchozí soubory pro rollback.

## Reprodukce exportů
Python 3 + Pillow: `python build.py`. Skript čte původní master, vytváří PNG/ICO a kontrolní list, ověří čtvercové rozměry i vrstvy ICO a sestaví ZIP. Master nemění. V 16 px není možné očekávat rozlišení jednotlivých listů: nevynucuj automatickou výtvarnou redukci.
