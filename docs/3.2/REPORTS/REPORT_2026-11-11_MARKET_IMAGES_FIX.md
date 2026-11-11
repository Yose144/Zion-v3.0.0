# Market — rozbité obrázky: nginx temp dirs (2026-11-11)

**Symptom:** na `https://market.zionterranova.com/shop` se část produktových
fotek nezobrazila (placeholdery) a v konzoli bylo `net::ERR_HTTP2_PROTOCOL_ERROR`.
Soubory přitom byly v pořádku: HTTP 200, správný `content-type` i velikost,
Pillow je bez problému dekódoval a `createImageBitmap()` v prohlížeči taky.

**Příčina:** nginx na EDGE2 nemohl zapisovat do svých temp adresářů:

```
[crit] open() "/var/lib/nginx/proxy/1/80/…" failed (13: Permission denied)
       while reading upstream, request: "GET /shop/img/products/…webp?v=engine-v1"
```

`/var/lib/nginx/{proxy,body,fastcgi,scgi,uwsgi}` byly `root:root 700`, ale
worker procesy běží jako `www-data`. Menší odpovědi se vešly do bufferu
(v paměti), větší obrázky potřebovaly temp file → zápis selhal → HTTP/2
spojení spadlo. Proto to bylo **intermitentní** podle velikosti souboru a
hash cesty temp file (některé podadresáře už byly `www-data`, některé ne).

**Oprava (EDGE2):**

```bash
chown -R www-data:www-data /var/lib/nginx/proxy /var/lib/nginx/body \
  /var/lib/nginx/fastcgi /var/lib/nginx/scgi /var/lib/nginx/uwsgi
chmod 700 /var/lib/nginx/proxy /var/lib/nginx/body /var/lib/nginx/fastcgi \
  /var/lib/nginx/scgi /var/lib/nginx/uwsgi
nginx -t   # OK
```

EDGE1 měl všechny temp dirs správně `www-data:www-data 700`, oprava se ho
netýkala.

**Ověření (headless Chromium, 1440×900, po opravě):**

| Stránka | obrázků | broken | chyby |
|---|---|---|---|
| `/shop` | 27 | **0** | 0 |
| `/` | 17 | **0** | 0 |
| `/vanoce/lampion` | 8 | **0** | 0 |

Full-page screenshot `.artifacts/render/market-check/shop-after.png` ukazuje
všech 24 produktů s fotkou (žádný cube placeholder).

**Deploy:** Marketplace byl před tím nasazen z čistého worktree na commitu
`d135199f3` (`ZION_SKIP_NPM_CI=1`), smoke check prošel (local :3100, live,
static i API/DB).

**Doporučení do ops:** hlídat vlastnictví temp dirs (např. v existujícím
watchdogu `stat -c %U /var/lib/nginx/proxy`), protože po ručním zásahu/obnově
se může root ownership vrátit a projeví se to přesně takhle — jen u větších
obrázků a jen někdy.
