# DNS — `zionterranova.com` — přesun web tieru Edge → EDGE2

> Registrar/DNS: **WebGlobe** (ns1/ns2.webglobe.cz, ns3.webglobe.com)
> Stav: ✅ **Fáze 1 PROVEDENA 2026-10-22** — 9 flipů propagováno a ověřeno
> (dig @8.8.8.8 → všechny na EDGE2; HTTPS smoke: 200 na všech webech,
> auth /health OK, app /api/health OK, oasis/freeworld/rpc OK).
> Edge ops subdomény (grafana/dashboard/testnet/mining) ověřeny nedotčené.
> Raw zone soubor pro WebGlobe: `zionterranova.com.zone` v rootu repa.
> Cíl: veřejné weby na **EDGE2 `207.180.217.100`**, ops/chain infra zůstává na **EDGE `62.171.141.136`**

---

## Strategie: dvě fáze

**Fáze 1 (teď):** flipnout jen explicitní A záznamy veřejných webů → EDGE2.
Wildcard `*` **zůstává na Edge** — přes něj resolvují `grafana`, `dashboard`,
`testnet`, `mining`, `explorer` a cokoli dalšího; ty služby zůstávají na Edge a
nesmí se rozbít.

**Fáze 2 (později):** až EDGE2 poběží stabilně a stray subdomény dostanou vlastní
vhosty/certy, flipnout i `*` → EDGE2 a Edge z web tieru vyřadit.

Proč ne plošný wildcard flip teď: EDGE2 nemá certy ani vhosty pro
`grafana./dashboard./testnet.` — skončily by na catch-all s cert mismatchem.

---

## Nová zóna (kompletní soubor k vložení)

```zone
$TTL 3600
$ORIGIN zionterranova.com.

@	IN SOA	ns1.webglobe.cz. root.webglobe.cz. (
	2026070702	  ; Serial — bump!
	28800     	  ; Refresh
	7200      	  ; Retry
	604800    	  ; Expire
	3600      	) ; Minimum

; ─── apex + mail/ISP records (beze změny kromě apex A) ──────────────────
                   	3600	IN A    	207.180.217.100      ; ← FLIP: apex = intro page na EDGE2
                   	3600	IN MX   	10 email.webglobe.cz.
                   	3600	IN MX   	10 email2.webglobe.cz.
                   	3600	IN MX   	10 email3.webglobe.cz.
                   	3600	IN MX   	10 email4.webglobe.cz.
                   	3600	IN NS   	ns1.webglobe.cz.
                   	3600	IN NS   	ns2.webglobe.cz.
                   	3600	IN NS   	ns3.webglobe.com.
                   	3600	IN TXT  	"v=spf1 a mx include:_spf.webglobe.cz -all"
                   	3600	IN TXT  	"v=spf2.0/mfrom,pra +a +mx include:_spf2.webglobe.cz -all"
                   	3600	IN CAA  	0 issue "letsencrypt.org"
                   	3600	IN CAA  	0 issuewild "letsencrypt.org"
                   	3600	IN CAA  	0 iodef mailto:security@zionterranova.com

; ─── wildcard: ZŮSTÁVÁ na Edge (fáze 1) ─────────────────────────────────
*                  	3600	IN A    	62.171.141.136       ; grafana/dashboard/testnet/… přes wildcard

; ─── EDGE2 (207.180.217.100) — veřejný web tier ─────────────────────────
app                	3600	IN A    	207.180.217.100      ; ← FLIP: Next.js app
auth               	3600	IN A    	207.180.217.100      ; ← NEW explicit: ZIS
freeworld          	3600	IN A    	207.180.217.100      ; ← NEW explicit
market             	3600	IN A    	207.180.217.100      ; ← NEW explicit
oasis              	3600	IN A    	207.180.217.100      ; ← NEW explicit
pool               	3600	IN A    	207.180.217.100      ; ← NEW explicit: pool UI
rpc                	3600	IN A    	207.180.217.100      ; ← NEW explicit: node RPC
www                	3600	IN A    	207.180.217.100      ; ← FLIP

; ─── EDGE (62.171.141.136) — ops/chain infra, explicitně ukotveno ───────
api                	3600	IN A    	62.171.141.136       ; beze změny (zatím bez vhostu)
dashboard          	3600	IN A    	62.171.141.136       ; ← NEW explicit: ops dashboard (dnes přes wildcard)
explorer           	3600	IN A    	62.171.141.136       ; beze změny (vhost zatím není ani na Edge)
grafana            	3600	IN A    	62.171.141.136       ; ← NEW explicit: monitoring (dnes přes wildcard)
mining             	3600	IN A    	62.171.141.136       ; beze změny
testnet            	3600	IN A    	62.171.141.136       ; beze změny

; ─── mail/WebGlobe (beze změny) ─────────────────────────────────────────
autoconfig         	3600	IN CNAME	autodiscover.webglobe.cz.
autodiscover       	3600	IN CNAME	autodiscover.webglobe.cz.
dbadmin            	3600	IN CNAME	dbadmin.webglobe.cz.
imap               	3600	IN A    	62.109.151.33
mail               	3600	IN A    	62.109.151.33
pop3               	3600	IN A    	62.109.151.33
smtp               	3600	IN A    	62.109.151.33
webmail            	3600	IN CNAME	roundcube.webglobe.cz.
_autodiscover._tcp 	3600	IN SRV  	0 0 443 autodiscover.webglobe.cz.
_dmarc             	3600	IN TXT  	"v=DMARC1; p=quarantine; rua=mailto:security@zionterranova.com; ruf=mailto:security@zionterranova.com; pct=100"
```

---

## Diff oproti aktuální zóně

| Záznam | Byl | Bude | Poznámka |
|---|---|---|---|
| `@` (apex) | 62.171.141.136 | **207.180.217.100** | intro/landing na EDGE2 |
| `www` | 62.171.141.136 | **207.180.217.100** | apex vhost obsluhuje i www |
| `app` | *(wildcard→edge)* | **207.180.217.100** | hlavní Next.js app |
| `auth` | *(wildcard→edge)* | **207.180.217.100** | ZIS na EDGE2 :8096 |
| `freeworld` | *(wildcard→edge)* | **207.180.217.100** | static + API :8095 |
| `market` | *(wildcard→edge)* | **207.180.217.100** | marketplace :3100 |
| `oasis` | *(wildcard→edge)* | **207.180.217.100** | static + API :8094 |
| `pool` | *(wildcard→edge)* | **207.180.217.100** | pool UI + /public/v1/ :8080 |
| `rpc` | *(wildcard→edge)* | **207.180.217.100** | node/quantus RPC |
| `dashboard` | *(wildcard→edge)* | 62.171.141.136 | **nový explicit** — ops zůstává |
| `grafana` | *(wildcard→edge)* | 62.171.141.136 | **nový explicit** — monitoring zůstává |
| `*` | 62.171.141.136 | *(beze změny)* | fáze 2 až po stabilizaci |
| `api`, `explorer`, `mining`, `testnet` | 62.171.141.136 | *(beze změny)* | explicit, zůstává Edge |
| mail/MX/TXT/NS/CAA/SRV | — | *(beze změny)* | WebGlobe mail nedotčen |

> **Pozn.** `api./explorer./mining.` dnes nemají funkční vhost ani na Edge —
> zůstávají ukotvené tam, dokud pro ně nedefinujeme cíl (kandidát: EDGE2
> catch-all → app, nebo dedikované vhosty).

---

## Postup u registrátora

1. **Serial bump** — `2026070701` → `2026070702` (WebGlobe panel to řeší často sám).
2. Přepsat záznamy podle diff tabulky.
3. Zónu uložit; TTL 3600 ⇒ propagace do **~1 h** (reálně minuty pro většinu resolverů).
4. Rollback: vrátit 9 flipnutých A záznamů zpět na `62.171.141.136`.

## Verifikace po změně (runbook)

```bash
# 1) DNS propagace
for d in @ www app auth freeworld market oasis pool rpc; do
  dig +short ${d}.zionterranova.com A | sed 's/^/@ /'
done   # očekáváno: 207.180.217.100 (kromě apex formátu)

# 2) HTTPS smoke přes novou IP
for h in zionterranova.com www.zionterranova.com app.zionterranova.com \
         auth.zionterranova.com freeworld.zionterranova.com \
         market.zionterranova.com oasis.zionterranova.com \
         pool.zionterranova.com rpc.zionterranova.com; do
  curl -s -o /dev/null -w "$h -> %{http_code}\n" https://$h/
done

# 3) edge subdomény stále fungují
curl -s -o /dev/null -w "grafana -> %{http_code}\n" https://grafana.zionterranova.com/

# 4) hlubší kontroly
curl -s https://auth.zionterranova.com/health
curl -s https://app.zionterranova.com/api/health | head -c 200
curl -s https://oasis.zionterranova.com/health
```

## Známé limity fáze 1

- **EDGE2 catch-all** (`infra/nginx/edge2/catchall.conf`) přesměrovává neznámé
  hosty → `app.`; pro SNI mimo apex cert vrací cert mismatch jen u přímých
  zásahů na IP — ve fázi 1 wildcard ukazuje na Edge, takže se to veřejně
  neprojeví.
- **Cert renew na EDGE2** — `/etc/letsencrypt` je zkopírovaný; až DNS ukáže na
  EDGE2, `certbot renew` (http-01) ověří, že všechny domény obnoví lokálně.
  Dovecot/postfix/cert hooks z Edge sem NEpřenášet.
- **Edge nginx zůstává živý** jako fallback po celou fázi 1 — nic na něm
  nevypínat, dokud fáze 2 neschválí decommission.
