# DNS snapshot — zionterranova.com

> Reference BIND-style zone fragment from March 2026. After edits, validate propagation (`dig +short zionterranova.com`). RDATA remain literal for tooling compatibility.

```zone
$TTL 3600
; Zone: zionterranova.com. (#591384)
; Updated for new primary server on Tue Mar 10 2026
$ORIGIN zionterranova.com.

@	IN SOA	ns1.webglobe.cz. root.webglobe.cz. (
	2026031001	  ; Serial
	28800     	  ; Refresh
	7200      	  ; Retry
	604800    	  ; Expire
	3600      	) ; Minimum
                   	3600	IN A    	seed.zionterranova.com
                   	3600	IN MX   	10 email.webglobe.cz.
                   	3600	IN MX   	10 email2.webglobe.cz.
                   	3600	IN MX   	10 email3.webglobe.cz.
                   	3600	IN MX   	10 email4.webglobe.cz.
                   	3600	IN NS   	ns1.webglobe.cz.
                   	3600	IN NS   	ns2.webglobe.cz.
                   	3600	IN NS   	ns3.webglobe.com.
                   	3600	IN TXT  	"v=spf1 a mx ip4:seed.zionterranova.com include:_spf.webglobe.cz -all"
                   	3600	IN TXT  	"v=spf2.0/mfrom,pra +a +mx include:_spf2.webglobe.cz -all"
                   	3600	IN CAA  	0 issue "letsencrypt.org"
                   	3600	IN CAA  	0 issuewild "letsencrypt.org"
                   	3600	IN CAA  	0 iodef mailto:security@zionterranova.com
*                  	3600	IN A    	seed.zionterranova.com
api                	3600	IN A    	seed.zionterranova.com
autoconfig         	3600	IN CNAME	autodiscover.webglobe.cz.
autodiscover       	3600	IN CNAME	autodiscover.webglobe.cz.
dbadmin            	3600	IN CNAME	dbadmin.webglobe.cz.
explorer           	3600	IN A    	seed.zionterranova.com
imap               	3600	IN A    	mail.zionterranova.com
mail               	3600	IN A    	mail.zionterranova.com
mining             	3600	IN A    	seed.zionterranova.com
pool               	3600	IN A    	seed.zionterranova.com
pop3               	3600	IN A    	mail.zionterranova.com
smtp               	3600	IN A    	mail.zionterranova.com
testnet            	3600	IN A    	seed.zionterranova.com
www                	3600	IN A    	seed.zionterranova.com
seed1              	3600	IN A    	seed.zionterranova.com
webmail            	3600	IN CNAME	roundcube.webglobe.cz.
_autodiscover._tcp 	3600	IN SRV  	0 0 443 autodiscover.webglobe.cz.
_dmarc             	3600	IN TXT  	"v=DMARC1; p=quarantine; rua=mailto:security@zionterranova.com; ruf=mailto:security@zionterranova.com; pct=100"
```

## Operational notes

- Keep apex, wildcard, `www`, `api`, `explorer`, `mining`, `testnet` aligned with the hosting IP you intend to serve from.
- `pool` / `seed1` records reflect co-located rehearsal services on the primary operator host.
- Wait for TTL (3600s here) before assuming global DNS consistency.
