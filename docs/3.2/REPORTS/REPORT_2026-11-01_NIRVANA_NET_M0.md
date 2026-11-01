# REPORT 2026-11-01 — NIRVANA NET M0 (transport pro multiplayer a chat)

> **Stav:** hotové, **nasazené na EDGE** (`zion-nirvana-net` release `20261101T113159Z`).
> **Live:** `https://nirvana.zionterranova.com/net/health` → `ok`, WS upgrade 101 přes TLS.
> **Kde:** `apps/nirvana-net/`, `apps/nirvana/src/core/net/protocol.ts`,
> `infra/nginx/edge-current/nirvana.zionterranova.com.conf`.
> **Navazuje na:** `~/.opencode/plan/NIRVANA-MULTIPLAYER-AVATARS.md` (fáze M0).

## 1. Proč nová služba

Next v režimu `output: 'standalone'` **neumí** vlastní server s WebSocketem —
dokumentace Nextu to říká explicitně („These cannot be used together"). Herní
smyčka (20 Hz vstup, 15 Hz snapshoty) ani chat se do route handlerů nevejdou.
Proto vedle webu (3010) běží druhý proces `zion-nirvana-net` na `127.0.0.1:3011`,
za nginxem na `/net`.

## 2. Co je hotové

| Vrstva | Detail |
|---|---|
| Protokol | `core/net/protocol.ts`: `PROTO_VERSION = 1`, tick 30 Hz, snapshot 15 Hz, vstup 20 Hz, max 8 hráčů / 4 místnosti / 4 kB rámec, typy zpráv, **validace** příchozích (`parseClientMessage` ořezává čísla i délky) |
| Služba | `hello → welcome`, `join/leave` + místnosti a presence, `ping/pong`, heartbeat 20 s, idle 60 s, rate limit 40 zpráv/s, Origin allowlist, úklid prázdných místností |
| HTTP | `GET /net/health` (JSON: proto, build, uptime, spojení, místnosti), `GET /net/metrics` (Prometheus: spojení, místnosti, hráči, zprávy po směru i typu, odmítnuté rámce, RSS) |
| Identita | **jen host** (`host-xxx`, `role: 'guest'`); jméno a avatar nikdy neposílá klient — ZIS v M1 |
| nginx | `map $http_upgrade $connection_upgrade` + `location /net` (`proxy_read_timeout 3600s`, `limit_conn` 8) |
| systemd | `zion-nirvana-net.service` (User=zion, `ProtectSystem=strict`, `EnvironmentFile=-/etc/zion/nirvana-net.env` s `ZION_DEPLOY_RELEASE`) |
| Deploy | `apps/nirvana-net/deploy/deploy-nirvana-net.sh` — stage → `mv` swap → restart → health, s automatickým rollbackem |

## 3. Vedlejší nález: produkce jela na Node 18

`zion-nirvana.service` měl `ExecStart=/usr/bin/node server.js`, což je
**Node 18.19.1**, ale Next 16.4.3 vyžaduje `>= 20.9.0` (na stroji je
i `/usr/local/bin/node` 22.23.2). Web to dosud zvládal, ale byl to latentní
rozdíl proti dokumentaci Nextu. **Opraveno:** unit přepnut na
`/usr/local/bin/node`, restart, `readlink /proc/<pid>/exe` →
`/usr/local/bin/node`, Next „Ready", všechny stránky 200, herní scény bez chyb
v konzoli. Záloha unitu: `/root/zion-nirvana.service.bak-node18-20261101`.

## 4. Ověření

**Lokálně (`npm run smoke`, 20/20):** health, metriky, `welcome` s host identitou,
`ping → pong`, založení `arena-1`, quick join druhého hráče do stejné místnosti,
`event join`, `input` bez chyby, chat odmítnut (`not_available`), neznámý typ →
`bad_frame`, 60 zpráv v řadě → `rate_limited`, cizí Origin → 403, povolený
projde, po odpojení 0 místností a 0 spojení.

**Živě:**

```
wss://nirvana.zionterranova.com/net  → open, welcome {proto:1, role:"guest", tick:30, snapshot:15}
join → room arena-1 {players:1, maxPlayers:8, state:"waiting"}
/net/health během spojení: connections 1, rooms 1
po odpojení:               connections 0, rooms 0
```

`/`, `/park`, `/mars`, `/venus`, `/net/health` → 200, konzole bez nových chyb.

## 5. Pasti (zapsané i v `apps/nirvana/AGENTS.md`)

1. **rsync `node_modules/ws`** selže, když cíl nemá `node_modules/` → skript
   dělá `mkdir -p <stage>/node_modules` před druhým rsyncem.
2. **`map` v nginx** musí být v `http` kontextu — vhost v `sites-enabled` se tam
   includuje, takže patří do stejného souboru; zálohy patří do
   `/etc/nginx/backups/`, nikdy do `sites-enabled` (glob `*` je načte).
3. **fail2ban na EDGE** banuje rychlé sériové SSH → deploy drží `ControlMaster`,
   ruční zásahy přes `zion-v6`.
4. **Test harness:** neodchycený `opened` promise u odmítnutého handshaku shodí
   Node proces (unhandled rejection) → v smoke testu `.catch(() => {})`.
5. **Zbytkový proces na portu** z předchozího běhu testu dělá falešné chyby →
   smoke test volí náhodný port a hlídá, že služba nespadla.

## 6. Co následuje (M1)

Chat pro ZIS: resoluce cookie `zion_session` → `GET /api/auth/me` na serveru
(cache 60 s), kanály `park` + `arena:<room>`, historie 200 zpráv v RAM,
rate limit 2 zprávy / 2 s, HUD panel a seznam přítomných. Klient si nesmí
jméno posílat sám — server ho dosadí.
