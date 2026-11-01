# F6 — redirect mapa (připraveno, NEAKTIVNÍ)

> **Datum:** 2026-11-01 · **Stav:** kód připraven, **nic nezapnuto** · **Flip = 👤**
> **Vztah:** fáze F6 v [`Kingdom/PLAN.md`](../../Kingdom/PLAN.md) §1. Podmínka z §3: appka zhasne, až má **všechny** veřejné stránky nahrazené a 30 dní běží redirect bez incidentu.

## Proč to není „prostě 301"

Plán F6 vyjmenovává `pool.` `oasis.` `nirvana.` `freeworld.` `explorer.` → 301 do portálů. Vznikl **předtím**, než nirvana dostala hry (`/park`, `/mars`, `/venus`, multiplayer, chat) a než se ukázalo, kolik stránek má OASIS. Změřeno dnes:

| Hostname | Dnes servíruje | Náhrada v Kingdomu | Verdikt |
|---|---|---|---|
| `pool.` | pool UI (mince, těžaři, výplaty, `/ops/`) | **Kovárna je 1:1** (mince, těžaři, historie, výplaty, detail těžaře, štěstí, bloky) | **ready** — jen `/ops/` a `/public/v1/` musí zůstat |
| `freeworld.` | jediná stránka (granty/projekty klientsky) | **Přístav** (fond, granty, projekty server-side) | **ready** |
| `explorer.` | 301 → `zionterranova.com/explorer/` | eXplorer žije na `app./explorer` | **done** (nic k práci) |
| `oasis.` | **11 stránek** — avatars, quests, golden-egg, ships, territories, guilds, leaderboard, dashboard, miner, onboarding | **žádná** | **blocked** |
| `nirvana.` | hry a scény (`/park`, `/mars`, `/venus`, `/present/*`), chat, multiplayer | **žádná** | **blocked** |
| `apex` | IntroPage — landing + **59 stránek** | Brána na `/`, zbytek v **Archivu v3** path-preserving (`/blog/x` → `/archive/v3/blog/x`) | **ready** — paths ověřené 59/59 |

**Důsledek:** redirect `oasis.` nebo `nirvana.` na Kingdom by dnes rozbil funkci, kterou portál nemá — přesně to §3 zakazuje („žádná funkce nezmizela"). Proto jsou v mapě jako `blocked` **s důvodem** a `enable-redirect.sh` je odmítne (exit 3).

## Apex: path-preserving redirect

Pravidla (jediná dvě):

```nginx
location = / { return 301 https://kingdom.zionterranova.com/; }            # Brána
location /  { return 301 https://kingdom.zionterranova.com/archive/v3$request_uri; }
```

Protože Archiv v3 **zachovává strukturu cest**, nepotřebuje apex tabulku výjimek — `/blog/xyz/` → `/archive/v3/blog/xyz/`.
`scripts/ops/check-apex-mapping.sh` to ověřuje: projde všech 59 HTML v archivu a každé staré URL najde cíl (59/59, včetně adresářových URL typu `/blog/`).

**Vědomé mezery:** `/legacy/` (~385 MB) a `/portfolio/` (~33 MB) v archivu nejsou, takže tyhle staré URL po přepnutí vrátí 404. Nic na ně z archivu neodkazuje (ověřeno: 0 odkazů) — jsou to surové archivy, ne web. Kdyby bylo potřeba, doplní se jedním řádkem do `build-archive-v3.sh`.

**Past nalezená simulací:** vhost má **dva server bloky** (80 a 443). První verze přepisu měnila jen `location /` v prvním z nich — HTTPS by dál servíroval starý web, protože prohlížeč jede přes 443. `enable-redirect.sh` teď přepisuje **všechny** výskyty (ověřeno na kopii živého vhostu: 2 bloky, ostatních 15 `location` zůstalo, závorky 17/17).

## Co je připravené

| Soubor | Co dělá |
|---|---|
| `Kingdom/infra/nginx/redirects/map.tsv` | jediný zdroj pravdy: povrch → vhost → cíl → stav → důvod |
| `Kingdom/infra/deploy/enable-redirect.sh <povrch> [--dry-run]` | záloha vhostu, přepis `location /` (ve **všech** server blocích) na `return 301`, `nginx -t`, reload, kontrola 301 + cíl 200 |
| `Kingdom/infra/deploy/rollback-redirect.sh <povrch> [--list]` | vrátí nejnovější zálohu, `nginx -t`, reload, kontrola |
| `scripts/ops/check-redirects.sh` | mapa + živý stav + cíl (probe) musí vracet 200 + `sites-enabled` bez `.bak` |
| `scripts/ops/check-apex-mapping.sh` | všech 59 stránek archivu má cíl; `/legacy/` a `/portfolio/` se hlásí jako vědomá mezera |

**Vlastnosti, které to má záměrně:**
- přepisuje se **jen** `location /` — `/ops/`, `/ops-api/`, `/public/v1/`, `/api/auth/` zůstávají živé (API konzumenti a operátor nepřijdou o cestu);
- zálohy jdou do `/etc/nginx/backups/redirects/`, **nikdy** do `sites-enabled` (include `*` by je načetl jako druhé vhosty — v tomhle repu už jednou stalo);
- `nginx -t` před reloadem; při chybě se záloha vrátí automaticky;
- `blocked` povrch se nezapne ani omylem (skript čte mapu, ne argument).

## Důkaz, že přepis funguje (bez zásahu do produkce)

Přepisovací logika puštěná na **kopii** vhostu v `/tmp`: změnil se jediný řádek (`try_files` → `return 301`), ostatních 15 `location` bloků zůstalo, závorky vyvážené (18/18).

## Co musí vzniknout, než se `blocked` změní na `ready`

1. **apex** — domov pro 48 stránek IntroPage (blog, seeds, legal). Buď je převzít do Kingdomu jako `/blog` portál, nebo je nechat na `app.` a v redirect mapě je adresně přesměrovat (path-preserving seznam).
2. **oasis** — 11 stránek. Buď portál „OASIS" v Kingdomu (avatary, questy, lodě, území, golden egg, leaderboard), nebo rozhodnutí, že OASIS zůstává samostatný povrch a z F6 se vyjímá.
3. **nirvana** — hry. Buď zůstává samostatná (rozumné: je to herní klient, ne čtecí portál), nebo se do Kingdomu přenese celá herní vrstva — to je jiná velikost práce.

**Doporučení:** `pool.`, `freeworld.` a `apex` mohou jít do 301 hned po schválení (parita i paths doložené). `oasis.`, `nirvana.`, `apex` držet — F6 pak není „zhasnout 5 hostname", ale „zhasnout 2 a u 3 rozhodnout, čím jsou".

## Jak se to pouští

```bash
# 0) kontrola před čímkoli
bash scripts/ops/check-redirects.sh

# 1) co by se stalo (nic nemění)
bash Kingdom/infra/deploy/enable-redirect.sh pool --dry-run

# 2) zapnout (až po 👤 schválení)
bash Kingdom/infra/deploy/enable-redirect.sh pool

# 3) vrátit
bash Kingdom/infra/deploy/rollback-redirect.sh pool
```

**Po zapnutí** běží 30denní okno (§3): redirect bez incidentu, nárůst chyb v logu = rollback. Teprve po něm se smí stará appka vypnout.
