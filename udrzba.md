Rollback

Apex zpět do údržby:
ssh zion-edge2
cp /etc/nginx/backups/zionterranova.com.conf.bak-enabled-20261116T043604Z \
   /etc/nginx/sites-enabled/zionterranova.com.conf
nginx -t && systemctl reload nginx


Vypnutí 3.3 preview:
rm /etc/nginx/sites-enabled/3.3.zionterranova.com.conf
nginx -t && systemctl reload nginx