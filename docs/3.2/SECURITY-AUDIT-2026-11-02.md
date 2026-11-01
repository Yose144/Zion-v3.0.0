# SECURITY AUDIT — ZION EDGE1 + EDGE2 (2026-11-02)

> **Rozsah:** oba produkční boxy (EDGE1 `62.171.141.136` = pool/ops, EDGE2 `207.180.217.100` = primary +
> app stack), veřejné HTTP/WS povrchy, systemd/nginx/firewall/SSH konfigurace, správa secretů.
> **Metoda:** živé sondy z internetu (TCP matrix, HTTP status matrix), `ss`/`ufw`/`sshd -T`/`fail2ban-client`,
> čtení kódu (auth cesty), kontrola práv souborů. Nic nebylo měněno bez ověření před/po.
> **Verdikt:** 3 kritické nálezy **opraveny dnes**, 4 střední/vysoké zůstávají k rozhodnutí 👤.

## 1. Attack surface (naměřeno z internetu)

| Box | Otevřeno z internetu | Firewalled (i když proces binduje 0.0.0.0) |
|---|---|---|
| **EDGE2** | 443, **22**, 8333 (bitcoind P2P), 8335 (zion P2P), 30333 (quantus P2P) | 9090 prometheus, 9100 node-exporter, 8453/8454 warpd, 5432 postgres, 8094–8098, 3000, 3100, 8001, 9445, 8080 |
| **EDGE1** | 443, 80, **2222**, 8443 (RPC stream s allowlistem), 8444/8445 (stratum), 8336 (node2 P2P) | 8446, 8080 (pool API), 8766 (dashboard), 9100, 8800+ |

UFW: `Default: deny (incoming)` na obou boxech — procesy, které bindují `0.0.0.0`, jsou **kryté firewallem**.
To je dobrý stav; níže jen to, co je otevřené záměrně nebo co je potřeba zúžit.

## 2. Kritické nálezy — OPRAVENO

### C1 · `/api/agent/*` bylo bez autentizace (info leak + ovládání rigů)

`GET https://zionterranova.com/api/agent/fleet` vracel **200 bez jakéhokoli tokenu** — rig ID, hostname,
GPU, stav minerů, názvy tmux sessions (`srbpool`, `srbqtu`, `ssh_tmux`, `vast-agent`). `GET /api/agent/task`
také bez kontroly. Endpoint sám v odpovědi hlásí „Missing API key — send X-API-Key or Authorization: Bearer",
ale kontrola chyběla (`vastctl.py` komentář předpokládal „behind /vast-ops basic or public tunnel" — na
veřejné cestě `/api/agent/` žádná basic auth není).

**Fix:** `_agent_read_allowed()` v `infra/tools/vast/vastctl.py` pro `fleet` i `task`.
**Ověřeno:** bez tokenu **403**, s podvrženou hlavičkou **403**, lokální CLI (`127.0.0.1:8088`) **200**.

### C2 · Auth bypass přes `X-Ops-Auth` (spoofovatelná hlavička)

`vastctl` bere `X-Ops-Auth: 1` jako důkaz, že prošla basic auth (`/ops-api/`). Jenže nginx ve výchozím
stavu **propouští hlavičky klienta**, takže si kdokoli poslal `X-Ops-Auth: 1` na veřejnou `/api/agent/`
cestu a aplikace ho považovala za operátora → šlo by ovládat pronajaté rigy (`enqueue`, `sheet`, `bulk`).

**Fix:** dvě strany
- veřejná `/api/agent/` v `infra/nginx/edge2/zionterranova.com.conf` → `proxy_set_header X-Ops-Auth "";`
- `/vast-ops/` (za basic auth) → `proxy_set_header X-Ops-Auth 1;` (teprve tam je tvrzení pravdivé)

**Ověřeno:** `fleet` z internetu 403, `fleet + X-Ops-Auth: 1` 403, `fleet + X-Real-IP: 127.0.0.1 + X-Ops-Auth` 403,
`/vast-ops/api/agent/fleet` bez basic auth 401.

> Poznámka k detekci „lokální" vs „přes ingress": `:8088` je na EDGE za SSH tunelem, takže **všechno**
> přichází jako `client_address = 127.0.0.1`, a IP allowlist tím pádem nefunguje. Rozhoduje se podle
> `X-Real-IP`, který nginx **vždy přepíše** (`$remote_addr`) — přímé lokální volání ten header nemá.

### C3 · EDGE2 SSH: root + hesla na veřejném portu 22

`sshd -T` na EDGE2: `permitrootlogin yes`, `passwordauthentication yes`, `maxauthtries 6`, port **22**
(EDGE má 2222, `without-password`, `maxauthtries 3`). Konflikt v drop-inech: `50-cloud-init.conf`
(PasswordAuthentication yes) vyhrával nad `60-cloudimg-settings.conf` (no) — sshd používá **první**
výskyt hodnoty.

**Fix:** `50-cloud-init.conf` přepsán na `no`, nový `99-zion-hardening.conf`
(`PermitRootLogin prohibit-password`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`,
`MaxAuthTries 3`), persistence `ssh_pwauth: false` v `/etc/cloud/cloud.cfg.d/99-zion-ssh.cfg`.
**Ověřeno:** `sshd -T` → `without-password / no / 3`; nové klíčové spojení OK; pokus o heslo →
`Permission denied (publickey)`.

## 3. Vysoké / střední — otevřené (rozhodnutí 👤)

| # | Nález | Dopad | Doporučení |
|---|---|---|---|
| H1 | **Secrety byly do 1. 11. world-readable** (`edge-environment.sh` 0644) a jsou i v zálohách (`backups/daily/*.tar.gz`, 34× `.bak`, `web-backups/…/.env`) | kdokoli s účtem na boxu (nebo kdo získá zálohu) má payout klíč, WARP mnemonic, DB hesla | **rotace klíčů** (👤 „zatím ne") — hodnoty považuj za exponované. Práva už zpevněná (600/640), zálohy `umask 077` |
| H2 | RPC stream allowlist na EDGE `:8443` obsahuje **/16 rozsahy** (`46.135.0.0/16`, `109.81.0.0/16`, `109.164.0.0/16`, `185.63.0.0/16`) | velké části ISP prostoru (CGNAT) dosáhnou na operatorské RPC | zúžit na explicitní IP; /16 byl kompromis kvůli měnící se IP operátora |
| M1 | `dashboard.zionterranova.com/api/health` je **bez auth** (AUTH_EXEMPT_ROUTES) | inventář služeb a jejich stav | nechat (watchdog), nebo vyžadovat token pro detailní pole |
| M2 | Veřejné P2P porty: bitcoind 8333, quantus 30333, zion 8335/8336, 44108 | plocha pro skenování/flood; pro veřejný chain je P2P záměr | zvážit, zda bitcoind/quantus musí být globálně (může stačit peering s EDGE) |
| M3 | EDGE2 SSH na **22** (EDGE na 2222) | 22 je nejskenovanější port; fail2ban to řeší, ale hluk | sjednotit na 2222 (pozor: změní cestu pro deploy skripty) |
| M4 | `npm audit`: `next` critical v 7 z 9 appek | RCE třída při self-hostingu | gate 1b před Stable (K3, plán Next 14→16) |
| L1 | fail2ban: EDGE má 2 jaily (`sshd`, `zion-p2p`), **EDGE2 jen `sshd`** | P2P flood na EDGE2 není banovaný | přidat `zion-p2p` jail i na EDGE2 |
| L2 | `nirvana-net.env`, `oasis-web/.env`, `backup-node.env` jsou 0644 | ověřeno: **žádné secrety** (jen `ZION_DEPLOY_RELEASE`, `NODE_ENV`, node config) | nechat, případně 640 |
| L3 | `GET /api/dao/proposals` veřejně 200 | read-only data, žádná identita | OK (transparentnost) |

## 4. Co je naopak v pořádku (ověřeno)

- **UFW default deny** na obou boxech; služby bindující `0.0.0.0` (prometheus 9090, node-exporter 9100, warpd 8453/8454, postgres 5432) **nejsou z internetu dostupné** — ověřeno TCP matrixem.
- **ZIS session cookie**: `httpOnly: true`, `secure: true`, `sameSite: 'lax'` (`apps/identity/src/lib/auth.ts`).
- **P0-3 izolace** (1. 11.): každá služba vidí jen svoje secrety, sdílený env bez secretů, 0640.
- **TLS**: 14 certů, platnost 55–89 dní, `certbot.timer` 2×/den, HSTS + `X-Content-Type-Options` + `Referrer-Policy` na veřejných vhostech.
- **Backupy**: `umask 077` → archivy i PG dumpy 600; `.bak` env soubory 600.
- **Admin povrchy**: `/vast-ops/` 401, pool `/ops/` 401, dashboard 401, agent heartbeat 403.
- **Fencing** (W2.2): promote poolu vyžaduje token z guardu; read-only sonda primáru přes omezený klíč.

## 5. Reprodukce

```bash
# attack surface z internetu
python3 - <<'PY'
import socket
for h,p in [("207.180.217.100",x) for x in (22,443,8335,8453,9090,9100)] + \
           [("62.171.141.136",x) for x in (2222,8443,8444,8446,8080,8766)]:
    s=socket.socket(); s.settimeout(5)
    try: s.connect((h,p)); print(h,p,"OPEN")
    except Exception: print(h,p,"closed")
    finally: s.close()
PY

# C1/C2 (po fixu musí být 403)
for h in "" "-H X-Ops-Auth:1" "-H X-Real-IP:127.0.0.1 -H X-Ops-Auth:1"; do
  curl -s -o /dev/null -w "%{http_code}  $h\n" $h https://zionterranova.com/api/agent/fleet
done

# C3
ssh zion-edge2 'sshd -T | grep -iE "^(permitrootlogin|passwordauthentication|maxauthtries)"'
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no zion-edge2 true   # musí selhat
```

## 6. Změny v tomto auditu (kód i produkce)

| Soubor | Změna |
|---|---|
| `infra/tools/vast/vastctl.py` | `_agent_read_allowed()` + gating `fleet` a `task` |
| `infra/nginx/edge2/zionterranova.com.conf` | strip `X-Ops-Auth` na `/api/agent/`, nastavení `X-Ops-Auth 1` na `/vast-ops/` |
| EDGE2 `/etc/ssh/sshd_config.d/{50-cloud-init,99-zion-hardening}.conf`, `/etc/cloud/cloud.cfg.d/99-zion-ssh.cfg` | SSH jen na klíče, root `prohibit-password`, `MaxAuthTries 3` |
| EDGE2 `/etc/zion/edge-environment.sh.bak-apikey-1791709884` | 0644 → 600 |

Nasazeno a ověřeno živě 2026-11-02 (nginx reload, `vastctl-serve` restart, ssh reload; nové SSH spojení prošlo, heslo odmítnuto).
