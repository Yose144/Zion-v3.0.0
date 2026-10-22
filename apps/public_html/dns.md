$TTL 3600
; Zone: newearth.cz. (#535371)
; File written on Mon Aug 03 13:47:06 2026
$ORIGIN newearth.cz.

@	IN SOA	ns1.webglobe.cz. root.webglobe.cz. (
	2026080301	  ; Serial
	28800     	  ; Refresh
	7200      	  ; Retry
	604800    	  ; Expire
	3600      	) ; Minimum
                   	3600	IN A    	62.171.141.136
                   	3600	IN MX   	10 email.webglobe.cz.
                   	3600	IN MX   	10 email2.webglobe.cz.
                   	3600	IN MX   	10 email3.webglobe.cz.
                   	3600	IN MX   	10 email4.webglobe.cz.
                   	3600	IN NS   	ns1.webglobe.cz.
                   	3600	IN NS   	ns2.webglobe.cz.
                   	3600	IN NS   	ns3.webglobe.com.
                   	3600	IN TXT  	"google-site-verification=Cm7aDct-d8kj-Cgh510mEtsmk5b-y2AbQIVJDDxOC_g"
                   	3600	IN TXT  	"v=spf1 a mx include:_spf.webglobe.cz -all"
                   	3600	IN TXT  	"v=spf2.0/mfrom,pra +a +mx include:_spf2.webglobe.cz -all"
*                  	3600	IN A    	62.171.141.136
autoconfig         	3600	IN CNAME	autodiscover.webglobe.cz.
autodiscover       	3600	IN CNAME	autodiscover.webglobe.cz.
dbadmin            	3600	IN CNAME	dbadmin.webglobe.cz.
default._domainkey 	3600	IN TXT  	("v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0WkGJYcb9r2p "
                                                "5HwNIRz2GN5eb1RMr07zs/3b7tvUK/pxrPCkclMGGwkl7J3UmIJUxUwL/IfnlrpuJM2+0UPh5M "
                                                "1Q+VC2+R6k2tA2HXr8dnTndHfTZOYHtz8FAMi9xMHaRDzX+udvHBWPYcrdAyvQlo6aG4ULjxQu "
                                                "s+tuA55X87a76OMdqkCkdb94zMa+ETG60gVgLNskeJtBZSiaiq2w1Do9PnSL068yxa/WS2un6v "
                                                "V2NP1XAxRibFH7DF7gqEnKMB9DZQi9aS/9JH5mOD1dGUYPCJABgeKF6krF9/Fd2kxZlDsHE6Fn "
                                                "yMtOvLhjypzWhHwKuBkPn87YdRS7Fp3uAQIDAQAB");
imap               	3600	IN A    	62.109.150.113
mail               	3600	IN A    	62.109.150.113
pop3               	3600	IN A    	62.109.150.113
smtp               	3600	IN A    	62.109.150.113
webmail            	3600	IN CNAME	roundcube.webglobe.cz.
www                	3600	IN A    	62.171.141.136
_autodiscover._tcp 	3600	IN SRV  	0 0 443 autodiscover.webglobe.cz.
_dmarc             	3600	IN TXT  	"v=DMARC1; p=none;"

