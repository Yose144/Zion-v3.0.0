#!/usr/bin/env python3
"""Insert downloads location block into nginx config."""

CONF = '/etc/nginx/sites-enabled/zionterranova.com'

with open(CONF) as f:
    content = f.read()

if '/downloads/' in content:
    print('SKIP: downloads block already present')
    exit(0)

downloads_block = """
    # -- ZION miner downloads (static files) --
    location /downloads/ {
        alias /opt/zion/downloads/;
        autoindex off;
        default_type application/octet-stream;
        add_header Content-Disposition 'attachment' always;
        add_header X-Content-Type-Options nosniff always;
        add_header Cache-Control 'public, max-age=3600' always;
    }

"""

pos = content.find('server_name zionterranova.com www.zionterranova.com;')
if pos > 0:
    loc_pos = content.find('location / {', pos)
    if loc_pos > 0:
        line_start = content.rfind('\n', 0, loc_pos) + 1
        content = content[:line_start] + downloads_block + content[line_start:]
        with open(CONF, 'w') as f:
            f.write(content)
        print('OK: downloads block inserted')
    else:
        print('ERROR: location / not found')
else:
    print('ERROR: server_name not found')
