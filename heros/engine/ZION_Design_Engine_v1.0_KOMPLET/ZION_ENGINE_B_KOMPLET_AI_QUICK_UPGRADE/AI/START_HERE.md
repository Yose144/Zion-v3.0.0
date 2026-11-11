# Zadání pro implementační AI — ZION Engine B / Manga

Proveď obrazový redesign existujícího Marketu a Appky podle přiložených souborů. Použij B · ZION jako jediný výchozí engine: malované přírodní prostředí, organická textura, selektivní komiksová linka, čitelná silueta a jeden hlavní jantarový světelný akcent. Inkoust #101C2B, les #344A36, pergamen #F0E1BE, jantar #E7AA4B, rez #9D493D. Rasta template Marketu zachovej, zejména červenou, zlatou a zelenou, rámy, historickou hlavu a keporkaka. Nezaměň B za variantu A nebo C.

## Vstupy a pořadí

1. Přečti QUICK_UPGRADE.md, KONTROLA.md, ZION_DESIGN_ENGINE_v1.0.md a reference/ZION_MANGA_STYLE_BIBLE.md.
2. Zjisti skutečný stav repozitáře a jeho AGENTS.md. Zkontroluj rozdíly vůči základnímu commitu uvedenému v KONTROLA.md. Zachovej cizí práci.
3. Prohlédni PREHLED.html. CSV je autoritativní mapování cesty → soubor. Mobilní varianty jsou menší exporty stejných kompozic, nikoli nové portrétní kresby.
4. Aplikuj code.patch pouze pokud git apply --check projde; jinak věcně sluč příslušné změny ze source/apps/. Přenes oba public stromy bez mazání ostatních souborů.
5. Ověř všechna místa, kde obrázek přichází z databáze, API nebo komponent. Helper designImage verzí pouze známé katalogové obrázky. Nepřepisuj zákaznické uploady ani data v DB.
6. Zkontroluj Next Image localPatterns pro query ?v=engine-v1, rozměry, lazy loading pod foldem a čitelnost hero. Texty UI udržuj jako HTML. Nepřekrývej tváře a produkt CTA.
7. Spusť buildy, typovou kontrolu a ověř web v prohlížeči na 390/768/1440 px. Zkontroluj devět slidů, navigaci, produktové karty, košík, 3D prohlížeč, překlady a reduced motion. Výsledky zapiš konkrétně: co skutečně proběhlo, co nebylo možné ověřit.
8. Vytvoř přehled změn a připrav nasazení standardní cestou projektu. Nevydávej lokální výsledek za živě nasazený web.

## Kánon a omezení

Neměň identitu Lumi, Maitreyi, Tesaře ani oficiálních avatarů. U Lumi 2 je závazný skutečný výrobek a 3D model; generované ilustrace jsou stylizované marketingové vyobrazení, nikoli přesné technické rendery. Ověř výřezy a proporce před produkčním použitím. U Maitreyi dodaný engine sám uvádí nutnost kontroly kanonické tváře. Na hlavní grafice Dharma Temple musí být jedna centrální + šest okolních kupolí. Zachovej rozdíl mezi živou technologií, plánem a literární vizí. Neaktivuj nové služby a neprováděj změny cen, objednávek, plateb ani walletů.

## Hotovo znamená

Oba weby používají nové obrázky podle mapování; Rasta Market je zachovaný; cesty vrací 200; UI funguje na mobilu i desktopu; build a typová kontrola prošly nebo je výslovně uveden blokátor; změny jsou izolované a vratné. Nasazení je samostatný zaznamenaný krok.
