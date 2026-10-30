# Nirvana — jeden klient

> **29. 10. 2026.** Obraz toho, jak má vypadat `apps/nirvana`. Stav níže je to, co ve stromu už je. Mapa pravdy zůstává [`NIRVANA-V3.3-MAP.md`](NIRVANA-V3.3-MAP.md). Tahle stránka není fáze N0–N7 a nepřejmenovává Mainnet Beta.

Osm webů dnes sedí na osmi adresách: úvod, app, OASIS, pool, trh, free-world, auth, a k tomu desktop s mobilem. Nirvana je jedna místnost, ve které se ta místa potkají. Plátno je svět. Okna v liště jsou portály do dat, která už ty staré aplikace vystavují.

Staré aplikace zůstávají. DNS se nepřepíná tím, že okno začne číst jejich API. L1, emise, genesis a výplaty se z toho klienta needitují. Nasazení na EDGE2 je samostatné rozhodnutí, až místnost unese denní cestu.

## Místnost

Celá obrazovka je WebGPU scéna (když prohlížeč dá adaptér), jinak WebGL2. Katalog OASIS je v ní jako body. Brány jsou prstence na pevných místech. Klik na prstenec otevře stejný DOM panel jako tlačítko v liště pod plátnem.

Do shaderu nepatří tabulky, pokladna ani formulář. Čtení, seznam a přihlášení jsou obyčejné HTML okno vpravo. To je celý tvar: svět na plátně, práce v okně.

Proxy v `apps/nirvana/src/app/api/` sahají na veřejné HTTPS. Shell si neotevírá TCP na uzel. Cookie `zion_session` drží hostitel okna a proxy ji předá na `auth.zionterranova.com`.

## Okna, která už mluví

| Okno | Co v něm je | Odkud to bere |
|---|---|---|
| Svět | 410 bodů. Klik ukáže název, vrstvu, místo, náladu a krátké shrnutí. | `oasis.zionterranova.com` |
| Řetěz | Výška, obtížnost, počet peerů. | `app.zionterranova.com/api/blockchain/stats` |
| Těžba | Mince na poolu, u ZIONu těžaři a hashrate. | `pool.zionterranova.com/public/v1` |
| Trh | Výloha: název, kategorie, cena v Kč, skladem. Prohlížeč nedostane odkazy na soubory. | `market.zionterranova.com/api/shop/products` |
| Knihy | První nadpis z `canon/books/*/00-README.md`. Těla kapitol do prohlížeče nejdou. | soubory v repu |
| Přístav | Zůstatek fondu a názvy otevřených grantů. Jen GET. | `app.zionterranova.com/api/free-world` |
| Účet | Dvanáct slov podepíše výzvu ZIS v prohlížeči. Po úspěchu se pole smaže. Odhlášení smaže session. | `auth.zionterranova.com` |

Lišta vypisuje i to, co okno ještě nemá. **Issobella** čeká na veřejné čtení. **Brána** je statický úvod na apexu. Popisek se nedá otevřít do prázdného panelu.

## Jak to má jednou sedět

Člověk otevře jednu adresu. Stojí ve světě. Z prstence nebo z lišty vejde do okna, které potřebuje: podívat se na řetěz, na těžbu, na výlohu, na knihu, na přístav, nebo se přihlásit.

Účet je klíč od místnosti. Jedna session `zion_session` platí pro okna, která ji umí číst. Přihlášení žije tady, ve stejném tvaru jako na OASIS: adresa `zion1`, výzva, podpis Ed25519. Fráze se nikam neukládá.

Trh v místnosti je výloha. Pokladna, Stripe, faktura a doprava zůstávají na `market.zionterranova.com`, dokud se platba vědomě nepřesune. Do okna Nirvany nepatří tajemství pokladny.

Těžba v okně je pohled na pool. Binárka, která hashuje, zůstává `zion-miner`. Scéna v prohlížeči netěží bloky.

Knihy v okně jsou rejstřík. Čtení kapitoly je další okno, až bude mít smysl ho otevřít. Teď stačí vědět, které knihy v kánonu jsou.

Přístav je čtení fondu a grantů. Hlasování a zápis zůstávají tam, kde je klíč a ZIS ballot.

Řetěz je čtení přes explorer. Uzel dál mluví TCP. Klient se k němu nelepí vlastním RPC.

Svět na plátně je OASIS katalog. Let mezi světy, questy a celá scéna OasisWeb jsou další hloubka téhož plátna, až okno světa unese víc než kartu.

## Co zůstane venku, dokud to samo nepřijde

- **Issobella.** Až bude mít veřejné JSON, dostane okno ve stejném tvaru jako přístav: čtení, bez skrytého klíče.
- **Apexová brána.** Úvodní stránka `zionterranova.com` je dnes statická. Až se DNS bude měnit, tahle místnost může být to, co člověk uvidí jako první. Do té doby je Brána popisek.
- **Desktop a mobil.** Jsou klienti se svojí binárkou a svojí session. Místnost je web. Sjednocení s nimi je až sdílená session a stejné pojmenování oken, ne sloučení balíčků.
- **`zion-compute`.** Spec v [`docs/3.3/ENGINE-SRDCE.md`](docs/3.3/ENGINE-SRDCE.md) je jiná stopa (Hash / Care / Scene). Tenhle klient je Scene v prohlížeči. Hash zůstává v mineru.

## Pořadí, ve kterém to chci dodělat

1. Místnost umí denní čtení: svět, řetěz, těžba, výloha, knihy, přístav, účet. To už stojí v `apps/nirvana`.
2. Okna, která jsou jen popisek, dostanou veřejné čtení, jakmile existuje. Issobella a Brána jsou ty dvě.
3. Hloubka světa: karta nestačí navždy. Další krok je jeden zvolený svět jako místo, pořád na tom samém plátně.
4. Až denní cesta sedí v jedné místnosti, operátor může přepnout jednu adresu. Staré aplikace se zhasínají po jednom povrchu, když okno umí totéž.

Do toho pořadí nepatří změna konsenzu, přepsání výplat, sloučení databází ani vypnutí osmi webů najednou.
