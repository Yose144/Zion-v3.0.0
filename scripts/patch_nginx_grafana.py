#!/usr/bin/env python3
"""Patch nginx config to add Grafana reverse proxy location."""
import sys

CONF = '/etc/nginx/sites-available/zionterranova.com'

GRAFANA_BLOCK = """
    # ── Grafana monitoring dashboard ──
    location /grafana/ {
        proxy_pass http://127.0.0.1:3001/grafana/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
"""

with open(CONF) as f:
    lines = f.readlines()

if any('/grafana/' in l for l in lines):
    print('Grafana proxy already present, skipping')
    sys.exit(0)

# Strategy: find the main HTTPS server block (server_name zionterranova.com www.*)
# then find 'location / {' inside it, and insert our block AFTER that location closes
# We look for the pattern: proxy_read_timeout 60s; then }  then insert before next }

in_main_block = False
location_depth = 0
inserted = False
out = []

for i, line in enumerate(lines):
    out.append(line)

    # Detect we're in the main HTTPS server block
    if 'server_name zionterranova.com www.zionterranova.com;' in line:
        in_main_block = True
        continue

    if in_main_block and not inserted:
        stripped = line.strip()
        # Track location blocks
        if stripped.startswith('location') and '{' in stripped:
            location_depth += 1
        if location_depth > 0 and stripped == '}':
            location_depth -= 1
            if location_depth == 0:
                # We just closed the location / block, insert grafana after it
                out.append(GRAFANA_BLOCK + '\n')
                inserted = True
                in_main_block = False

if inserted:
    with open(CONF, 'w') as f:
        f.writelines(out)
    print('OK: Grafana proxy block inserted')
else:
    print('ERROR: Could not find insertion point')
    sys.exit(1)
