# Edge Server Re-image Runbook — 2026-07-29

Post-compromise hard re-image of the Edge VPS (`62.171.141.136`, Contabo) after SSH key exfiltration and root access by an attacker.

## Verified backups (local Mac)

All backups are on this Mac at `~/2.9.6-main/backups/edge/` with `MANIFEST-2026-07-29.sha256`.

- `daily/zion-edge-20260729_165425.tar.gz` — latest comprehensive L1-L6 backup (node state, DBs, revenue, env, configs, systemd, nginx, fail2ban, certs).
- `daily/zion-edge-forensics-20260729_1654.tar.gz` — forensics archive with auth/audit/syslog/nginx/fail2ban/ufw logs, SSH config, systemd service files, cron, suspicious binaries (`zion-dao`, `server.bak`, etc.).
- `weekly/zion-edge-weekly-2026_W30.tar.gz` — weekly snapshot.
- `dashboard-snapshots/2026-07-29/` — dashboard API JSON snapshots (`v2/status`, `security-warnings`, `security`, `revenue`, `pool/*`, `services`, etc.).

**Important:** The live chain state is in the backup. Dashboard `/api/security` still reports `CRITICAL — attacker funds moved!` and premine-guard addresses are at `0` balance. Re-imaging restores the server but does **not** by itself fix a chain-level treasury/premine problem. That must be handled in a separate incident response.

## Wipe/re-image steps

1. **Re-image the Contabo VPS** through the customer control panel (fresh Ubuntu 24.04.4 LTS).
   - This gives a new root password and new SSH host keys.
   - Note the new host key fingerprints and update your `~/.ssh/known_hosts`.

2. **First login + base hardening**
   - SSH as root, immediately run `apt update && apt upgrade -y`.
   - Install essentials: `openssh-server fail2ban ufw auditd rsyslog logrotate sqlite3 nginx certbot python3-certbot-nginx docker.io docker-compose-plugin rsync jq git cargo` (or the equivalents used before).
   - Create `zion` system user: `useradd --system --home-dir /opt/zion --create-home zion`.
   - Create `/opt/zion/data /opt/zion/logs /opt/zion/backups /var/log/zion /etc/zion /etc/zion/keys` and chown to `zion:zion`.
   - Harden SSH immediately:
     - Port `2222`.
     - `PermitRootLogin prohibit-password`.
     - `PasswordAuthentication no`.
     - `KbdInteractiveAuthentication no`.
     - `AuthenticationMethods publickey`.
     - `AllowUsers zion root`.
     - `MaxAuthTries 3`, `LoginGraceTime 30`.
     - Restart sshd.
   - Upload the **new** key only (`~/.ssh/zion-edge-post-wipe-2026-07-29`) to `/root/.ssh/authorized_keys`.
   - Enable UFW and auditd, deploy `ZION_OS/infra/config/audit.rules` and `fail2ban` jails.

3. **Copy source code**
   - `rsync` or clone the private repo into `/opt/zion` from this Mac or from GitHub.
   - Make sure you use the commit that contains the SSH-key rotation and hardening updates (`c8aa0401e` or newer).
   - **Do not copy build artifacts or old binaries from the backup.** Rebuild from source in step 6.

4. **Run initial setup**
   - `cd /opt/zion && bash edge-deploy/setup-edge.sh`
   - This creates `/etc/zion/edge-environment.sh` from template — **review and replace all secrets** before starting services.

5. **Restore operational data from the latest daily backup**
   Extract the backup on the new server, then copy back:
   - Node state DBs: `/data/zion/state`, `/data/zion/state-node2`.
   - P2P state: `peers.json`, `pplns-state.json`.
   - L2-L6 DBs: `bridge-mainnet.db`, `dao-mainnet.db`, `atomic-swap.db`, `warp-mainnet.db`, `oasis.db`, `free_world.db`, `issobella.db`, `ziondex-router.db`, `pool-store.db`.
   - Application state: `state.json`, `revenue_journal/`.
   - Configs: `edge-environment.sh`, `edge-node2-environment.sh`, `test-pool-environment.sh`, `xmr-pool-environment.sh`, and `/etc/zion/config/*.toml`.
   - Service files: `/etc/systemd/system/zion-edge-*.service`, `*.timer`, drop-in dirs.
   - nginx sites and `nginx.conf`.
   - fail2ban `jail.d/`.
   - Let’s Encrypt `live/` and `archive/` (see note below about key rotation).

6. **Recompile binaries from source**
   - `cargo build --release` in `V3/` to produce clean `node`, `server`, `zion-dao`, `zion-bridge`, `zion-atomic-swap`, `zion-warp-server`, `zion-miner`, `zion-oasis`.
   - Build the web Docker image from `APP&WEB/website-v2.9` (or wherever the canonical source is now).

7. **Rotate exposed secrets**
   Because the attacker had root, treat the following as **potentially compromised** and rotate them:
   - Wallet mnemonics / private keys in `edge-environment.sh` and any `/etc/zion/keys/`.
   - Dashboard credentials (`DASHBOARD_USERS` in `edge-environment.sh`).
   - Any API keys, RPC tokens, or third-party service tokens in env files.
   - Let’s Encrypt private keys (re-issue certs with `certbot` instead of restoring old `archive` keys).
   - Consider generating a **new** SSH key and replacing `~/.ssh/authorized_keys` even though the current new key was created after the incident.

8. **Restart services and verify**
   - `systemctl daemon-reload && systemctl enable --now zion-edge-node1 zion-edge-node2 zion-edge-pool ...`.
   - Verify with the dashboard at `https://dashboard.zionterranova.com`.
   - Sync the new node with the local backup node (`109.81.27.87`) and monitor `security-warnings`.

9. **Post-reimage follow-up**
   - Update `AGENTS.md`, `StatusV3.md`, `scripts/ssh-config.txt`, and `docs/3.0.6/EDGE_SECURITY_HARDENING_*.md` with the new image date and rotated secrets.
   - Investigate the dashboard `/api/security` CRITICAL state (premine-guard balances at `0`) independently of this re-image.
   - Fix `sync-edge-backups.sh` to use a hostname or the correct IPv6 format for `rsync` over SSH.
