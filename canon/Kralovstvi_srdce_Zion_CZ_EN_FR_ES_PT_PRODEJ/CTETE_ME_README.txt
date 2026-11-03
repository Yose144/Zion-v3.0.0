Království srdce / Kingdom of the Heart — Zion

Pět jazykových verzí / Five language editions
CZ — čeština / Czech
EN — angličtina / English
FR — francouzština / French
ES — španělština pro Španělsko / Spanish (Spain)
PT — portugalština pro Portugalsko / Portuguese (Portugal)

Každá složka obsahuje ilustrované PDF, EPUB a upravitelný rukopis Markdown (.md).
Each folder contains an illustrated PDF, EPUB and editable Markdown manuscript (.md).

Vydání zachovávají označení pracovního rukopisu z 3. listopadu 2026.
Editions retain their working-manuscript designation of 3 November 2026.

────────────────────────────────────────────────────────────────────────────
EDITION/ — ostatní edice knihy ve všech jazycích
Other editions of the book in all languages

Tohle je vlajková ilustrovaná edice (složky CZ/ EN/ ES/ FR/ PT/ výše).
Ve složce EDITION/ jsou další ediční linie — každá s pěti jazykovými podsložkami,
připravená na překlad a sazbu:

    00-nova-plavba   Nová plavba · Ilustrovaná (odkaz na tuto vlajkovou edici)
    klasicka         Původní midraš, deset zastavení
    cloude           Cedrový kýl · literární rozšíření
    gemini           Svorník korpusu, čtyřiadvacet kapitol
    gpt              Tesař, který zůstává u práce (kapitoly 10–24)
    groq             Loď, která se ptá
    quen             Účetnice — loď, která nemá uzavřený účet
    deepseek         Kniha Kýlu — vyprávěno dřevem

Stav všech edic a jazyků:      EDITION/00-STAV.md
Jak struktura funguje:         EDITION/00-INDEX.md
Sázečka Markdown → PDF/EPUB:   EDITION/_scripts/build_edition.py

Sazba jedné edice v jednom jazyce:

    cd EDITION
    uv run _scripts/build_edition.py --only gemini --lang EN

České rukopisy jsou pracovní verze bez jazykové redakce, ISBN a tiráže.
Czech manuscripts are working drafts without copy-editing, ISBN or imprint page.
