# DNS update – přesun webu na Helsinki (77.42.31.72)

**Cíl:** Přesměrovat webové subdomény ZION na Helsinki a ponechat mail beze změn.

## ✅ Záznamy, které změnit na 77.42.31.72
```
@           IN A  77.42.31.72
www         IN A  77.42.31.72
*           IN A  77.42.31.72
api         IN A  77.42.31.72
explorer    IN A  77.42.31.72
mining      IN A  77.42.31.72
testnet     IN A  77.42.31.72
```

## ❗ Záznamy, které NECHÁVAT (mail a DNS)
Nechte beze změny:
- **MX** (email.webglobe.cz…)
- **NS** (ns1/ns2/ns3)
- **TXT** (SPF, DMARC)
- **CAA**
- **mail, smtp, imap, pop3** (62.109.151.33)

## Poznámky
- Po přepnutí DNS bude možné vydat SSL certifikát na Helsinki.
- Pokud existuje **AAAA** záznam, zvažte jeho odstranění nebo přesměrování na IPv6 Helsinki.


$TTL 3600
; Zone: zionterranova.com. (#591384)
; File written on Fri Jan 16 12:25:44 2026
$ORIGIN zionterranova.com.

@	IN SOA	ns1.webglobe.cz. root.webglobe.cz. (
	2025102906	  ; Serial
	28800     	  ; Refresh
	7200      	  ; Retry
	604800    	  ; Expire
	3600      	) ; Minimum
                   	3600	IN A    	91.98.122.165
                   	3600	IN MX   	10 email.webglobe.cz.
                   	3600	IN MX   	10 email2.webglobe.cz.
                   	3600	IN MX   	10 email3.webglobe.cz.
                   	3600	IN MX   	10 email4.webglobe.cz.
                   	3600	IN NS   	ns1.webglobe.cz.
                   	3600	IN NS   	ns2.webglobe.cz.
                   	3600	IN NS   	ns3.webglobe.com.
                   	3600	IN TXT  	"v=spf1 a mx ip4:91.98.122.165 include:_spf.webglobe.cz -all"
                   	3600	IN TXT  	"v=spf2.0/mfrom,pra +a +mx include:_spf2.webglobe.cz -all"
                   	3600	IN CAA  	0 issue "letsencrypt.org"
                   	3600	IN CAA  	0 issuewild "letsencrypt.org"
                   	3600	IN CAA  	0 iodef mailto:security@zionterranova.com
*                  	3600	IN A    	91.98.122.165
api                	3600	IN A    	91.98.122.165
autoconfig         	3600	IN CNAME	autodiscover.webglobe.cz.
autodiscover       	3600	IN CNAME	autodiscover.webglobe.cz.
dbadmin            	3600	IN CNAME	dbadmin.webglobe.cz.
explorer           	3600	IN A    	91.98.122.165
imap               	3600	IN A    	62.109.151.33
mail               	3600	IN A    	62.109.151.33
mining             	3600	IN A    	91.98.122.165
pop3               	3600	IN A    	62.109.151.33
smtp               	3600	IN A    	62.109.151.33
testnet            	3600	IN A    	91.98.122.165
webmail            	3600	IN CNAME	roundcube.webglobe.cz.
www                	3600	IN A    	91.98.122.165
_autodiscover._tcp 	3600	IN SRV  	0 0 443 autodiscover.webglobe.cz.
_dmarc             	3600	IN TXT  	"v=DMARC1; p=quarantine; rua=mailto:security@zionterranova.com; ruf=mailto:security@zionterranova.com; pct=100"

$TTL 3600
; Zone: zionterranova.com. (#591384)
; File written on Fri Jan 16 12:25:44 2026
$ORIGIN zionterranova.com.

@	IN SOA	ns1.webglobe.cz. root.webglobe.cz. (
    2025102906	  ; Serial
    28800     	  ; Refresh
    7200      	  ; Retry
    604800    	  ; Expire
    3600      	) ; Minimum
                       3600	IN A    	77.42.31.72
                       3600	IN MX   	10 email.webglobe.cz.
                       3600	IN MX   	10 email2.webglobe.cz.
                       3600	IN MX   	10 email3.webglobe.cz.
                       3600	IN MX   	10 email4.webglobe.cz.
                       3600	IN NS   	ns1.webglobe.cz.
                       3600	IN NS   	ns2.webglobe.cz.
                       3600	IN NS   	ns3.webglobe.com.
                       3600	IN TXT  	"v=spf1 a mx ip4:91.98.122.165 include:_spf.webglobe.cz -all"
                       3600	IN TXT  	"v=spf2.0/mfrom,pra +a +mx include:_spf2.webglobe.cz -all"
                       3600	IN CAA  	0 issue "letsencrypt.org"
                       3600	IN CAA  	0 issuewild "letsencrypt.org"
                       3600	IN CAA  	0 iodef mailto:security@zionterranova.com
*                  	3600	IN A    	77.42.31.72
api                	3600	IN A    	77.42.31.72
autoconfig         	3600	IN CNAME	autodiscover.webglobe.cz.
autodiscover       	3600	IN CNAME	autodiscover.webglobe.cz.
dbadmin            	3600	IN CNAME	dbadmin.webglobe.cz.
explorer           	3600	IN A    	77.42.31.72
imap               	3600	IN A    	62.109.151.33
mail               	3600	IN A    	62.109.151.33
mining             	3600	IN A    	77.42.31.72
pop3               	3600	IN A    	62.109.151.33
smtp               	3600	IN A    	62.109.151.33
testnet            	3600	IN A    	77.42.31.72
webmail            	3600	IN CNAME	roundcube.webglobe.cz.
www                	3600	IN A    	77.42.31.72
_autodiscover._tcp 	3600	IN SRV  	0 0 443 autodiscover.webglobe.cz.
_dmarc             	3600	IN TXT  	"v=DMARC1; p=quarantine; rua=mailto:security@zionterranova.com; ruf=mailto:security@zionterranova.com; pct=100"