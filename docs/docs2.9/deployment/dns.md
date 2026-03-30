$TTL 3600
; Zone: zionterranova.com. (#591384)
; File written on Wed Oct 29 12:23:45 2025
$ORIGIN zionterranova.com.

@	IN SOA	ns1.webglobe.cz. root.webglobe.cz. (
	2025102905	  ; Serial (Updated with security records)
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
*                  	3600	IN A    	91.98.122.165
autoconfig         	3600	IN CNAME	autodiscover.webglobe.cz.
autodiscover       	3600	IN CNAME	autodiscover.webglobe.cz.
dbadmin            	3600	IN CNAME	dbadmin.webglobe.cz.
imap               	3600	IN A    	62.109.151.33
mail               	3600	IN A    	62.109.151.33
pop3               	3600	IN A    	62.109.151.33
smtp               	3600	IN A    	62.109.151.33
webmail            	3600	IN CNAME	roundcube.webglobe.cz.
www                	3600	IN A    	91.98.122.165
_autodiscover._tcp 	3600	IN SRV  	0 0 443 autodiscover.webglobe.cz.
_dmarc             	3600	IN TXT  	"v=DMARC1; p=quarantine; rua=mailto:security@zionterranova.com; ruf=mailto:security@zionterranova.com; pct=100"

; ============================================
; CAA RECORDS (SSL Certificate Authority)
; ============================================
@                  	3600	IN CAA  	0 issue "letsencrypt.org"
@                  	3600	IN CAA  	0 issuewild "letsencrypt.org"
@                  	3600	IN CAA  	0 iodef "mailto:security@zionterranova.com"

; ============================================
; EXPLICITNÍ SUBDOMÉNY (Recommended)
; ============================================
api                	3600	IN A    	91.98.122.165
mining             	3600	IN A    	91.98.122.165
explorer           	3600	IN A    	91.98.122.165
testnet            	3600	IN A    	91.98.122.165

