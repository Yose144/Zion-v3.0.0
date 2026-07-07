#!/usr/bin/env python3
"""
Emergency maintenance mode deploy script.

Replaces the live Next.js website with a static nginx container serving
public/maintenance.html on port 3000. To restore the website, run the
normal deploy script which overwrites docker-compose.yml with the Next.js
image and restarts the container.

Usage:
    ZION_EDGE_HOST=mainnetedge ZION_SSH_KEY=~/.ssh/id_ed25519 python3 deploy_maintenance.py

Prerequisites:
    - SSH key configured in ZION_SSH_KEY or default ~/.ssh/id_ed25519
    - Remote host configured in ZION_EDGE_HOST or default mainnetedge
    - maintenance.html uploaded to /opt/zion/web/maintenance.html on Edge
    - maintenance-nginx.conf uploaded to /opt/zion/web/nginx.conf on Edge
"""
import os, subprocess, time

SK = os.environ.get("ZION_SSH_KEY", os.path.expanduser("~/.ssh/id_ed25519"))
SO = f"-i {SK} -o StrictHostKeyChecking=accept-new"
R = f"{os.environ.get('ZION_EDGE_USER', 'deploy')}@{os.environ.get('ZION_EDGE_HOST', 'mainnetedge')}"
REMOTE_WEB = os.environ.get("ZION_REMOTE_WEB", "/opt/zion/web")

compose = """services:
  zion-website:
    image: nginx:alpine
    container_name: zion-website
    restart: unless-stopped
    network_mode: host
    volumes:
      - /root/zion-web/maintenance.html:/usr/share/nginx/html/maintenance.html:ro
      - /root/zion-web/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 5s
      retries: 3
"""

def run(cmd):
    print(f">>> {cmd[:120]}...")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.stdout: print(r.stdout[-500:])
    if r.stderr and 'Warning:' not in r.stderr: print("ERR:", r.stderr[-200:])
    return r

# 1. Upload maintenance page + nginx config
run(f'rsync -avz -e "ssh {SO}" "public/maintenance.html" "{R}:{REMOTE_WEB}/maintenance.html"')
run(f'rsync -avz -e "ssh {SO}" "deploy/maintenance-nginx.conf" "{R}:{REMOTE_WEB}/nginx.conf"')

# 2. Write docker-compose.yml
run(f"""ssh -T {SO} {R} 'cat > {REMOTE_WEB}/docker-compose.yml << "MAINEOF"
{compose}MAINEOF'""")

# 3. Stop current container and start maintenance
run(f'ssh -T {SO} {R} "docker rm -f zion-website 2>&1; cd {REMOTE_WEB} && docker compose up -d 2>&1"')

print("Waiting 10s...")
time.sleep(10)
run(f'ssh -T {SO} {R} "docker ps --filter name=zion-website --format {{{{.Status}}}}"')
run(f'''ssh -T {SO} {R} "curl -s -o /dev/null -w \\"%{{http_code}}\\" http://localhost:3000/"''')
print("\n=== MAINTENANCE PAGE LIVE ===")
