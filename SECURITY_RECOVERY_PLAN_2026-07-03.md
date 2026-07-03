# ZION V3 — Complete Security Recovery Plan

**Created:** 2026-07-03 12:00 UTC
**Trigger:** Full compromise of W11 development PC via TeamViewer remote access
**Severity:** CRITICAL — all credentials, keys, and passwords considered compromised
**Status:** RECOVERY PLAN — awaiting execution from Ubuntu

---

## 1. Incident Summary

### What Happened

| Time (UTC) | Event |
|------------|-------|
| June 16-23, 2026 | Attacker (TeamViewer ID `708168736`) connected to W11 PC 4x via TeamViewer remote control |
| June 16-23, 2026 | Attacker copied SSH private keys, passwords, and ZION credentials from W11 |
| July 2, ~22:00 | F1 P2P exploit: forged account TX from `109.81.30.165` (attacker IP) |
| July 2, 22:26-23:13 | Attacker SSH'd into Edge server as **root** 20x using compromised `zion-deployment-hetzner` key |
| July 3, 11:38 | Discovery: TeamViewer connection log shows unknown ID `708168736` |
| July 3, 11:45 | Emergency response: TeamViewer killed, attacker IP blocked, SSH key rotated |

### What Was Compromised

| Asset | Location | Status |
|-------|----------|--------|
| **SSH key to Edge** (`zion_hetzner_key`) | `C:\Users\yosef\.ssh\` on W11 | 🔴 COMPROMISED — attacker used it to SSH into Edge |
| **SSH key to Edge** (`ssh-key-zion-edge`) | `C:\Users\yosef\.ssh\` on W11 | ⚠️ POTENTIALLY COMPROMISED — same folder |
| **Pool payout SK** | `edge-environment.sh` on Edge | 🔴 COMPROMISED — attacker had root access, could read |
| **Escrow key** | `edge-environment.sh` on Edge | 🔴 COMPROMISED — attacker had root access, could read |
| **All W11 passwords** | Browser, email, GitHub, etc. | 🔴 COMPROMISED — attacker had full remote control |
| **ZION wallet keys** | W11 filesystem | 🔴 COMPROMISED — attacker had full remote control |
| **DAO guardian mnemonics** | `C:\Users\yosef\Desktop\ZION_DAO_GUARDIAN_KEYS.txt` | 🔴 COMPROMISED |
| **Genesis premine keys** | W11 filesystem (if any) | 🔴 COMPROMISED |
| **EVM deploy keys** | hardhat .env on W11 | 🔴 COMPROMISED |
| **GitHub credentials** | W11 browser/Git credential manager | 🔴 COMPROMISED |
| **Tailscale credentials** | W11 Tailscale client | ⚠️ Device may be enrolled |

### What Was NOT Compromised (Verified)

| Asset | Why |
|-------|-----|
| Edge `authorized_keys` | Not modified by attacker (verified: last modified June 3) |
| Edge SSH key (`zion-edge-20260521`) | Different fingerprint than what attacker used |
| ZION chain state | Height 23257, supply normal, no suspicious TXs |
| F5 balance check | Still active (height 22394) |

---

## 2. Immediate Actions Already Taken

- [x] TeamViewer killed and disabled on W11
- [x] Attacker IP `109.81.30.165` blocked on Edge (UFW + iptables)
- [x] Compromised `zion-deployment-hetzner` SSH key removed from Edge `authorized_keys`
- [x] New SSH keypair generated on Edge: `zion-edge-rotation-20260703`
- [x] New public key added to Edge `authorized_keys`

---

## 3. Recovery Plan — Phase by Phase

### Phase 0: Ubuntu Boot + Secure Environment (Day 1)

**Goal:** Boot into Ubuntu, establish secure communication channel to Edge

#### 0.1 Boot Ubuntu
- [ ] Boot from Ubuntu live USB or dual-boot partition
- [ ] Verify no Windows partitions are mounted (avoid cross-contamination)
- [ ] Connect to internet via Ethernet (not public WiFi)

#### 0.2 Install essential tools
```bash
sudo apt update && sudo apt install -y openssh-client git curl wget python3 jq ufw fail2ban
```

#### 0.3 Retrieve new SSH key from Edge
```bash
# From Ubuntu, use Tailscale to connect to Edge
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# SCP the new private key from Edge
scp root@100.76.16.108:/root/.ssh/zion-edge-new-20260703 ~/.ssh/zion-edge-new
scp root@100.76.16.108:/root/.ssh/zion-edge-new-20260703.pub ~/.ssh/zion-edge-new.pub
chmod 600 ~/.ssh/zion-edge-new

# Test connection
ssh -i ~/.ssh/zion-edge-new root@100.76.16.108
```

#### 0.4 Configure SSH
```bash
# Add to ~/.ssh/config
cat >> ~/.ssh/config << 'EOF'
Host edge
    HostName 100.76.16.108
    User root
    IdentityFile ~/.ssh/zion-edge-new
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

#### 0.5 Clone ZION repo
```bash
git clone https://github.com/Yose144/Zion-v3.0.0.git
cd Zion-v3.0.0
```

#### 0.6 GitHub credential rotation
- [ ] Change GitHub password (from Ubuntu, not W11)
- [ ] Enable 2FA on GitHub (if not already)
- [ ] Revoke all existing SSH keys and PAT tokens on GitHub
- [ ] Generate new SSH key for GitHub: `ssh-keygen -t ed25519 -f ~/.ssh/github -C "ubuntu-20260703"`
- [ ] Add new SSH key to GitHub account
- [ ] Update git remote: `git remote set-url origin git@github.com:Yose144/Zion-v3.0.0.git`

---

### Phase 1: Edge Server Forensics (Day 1)

**Goal:** Determine exactly what the attacker did during 47 minutes of root access

#### 1.1 Full SSH auth log analysis
```bash
ssh edge
# Check ALL SSH logins from attacker IP
grep "109.81.30.165" /var/log/auth.log
# Check for any other suspicious IPs
grep "Accepted" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn
```

#### 1.2 Check for backdoors
```bash
# Check for new users
cat /etc/passwd | grep -E "bash|sh$" | grep -v "root\|sshd\|daemon"

# Check for new SSH keys (all users)
find / -name "authorized_keys" -type f 2>/dev/null | xargs cat 2>/dev/null

# Check for new cron jobs
crontab -l
ls -la /etc/cron.d/
ls -la /var/spool/cron/

# Check for modified system binaries
dpkg --verify 2>/dev/null | grep -v "??"

# Check for suspicious processes
ps aux | grep -v "^\(root\|systemd\|dbus\|sshd\|cron\|rsyslog\|daemon\|nobody\|_chrony\|polkitd\|pollina\|caddy\|message\|472\|syslog\)"

# Check for new systemd services
systemctl list-unit-files --state=enabled | grep -v "ssh\|cron\|networking\|systemd\|docker\|tailscaled\|ufw\|prometheus\|grafana\|caddy\|nginx\|zion\|apparmor\|snapd\|unattended\|e2scrub\|fstrim\|apt\|man-db\|plocate\|chrony\|rsyslog\|dbus\|polkit\|fwupd\|logrotate\|motd\|apt-daily"

# Check for modified sudoers
visudo -c
ls -la /etc/sudoers.d/

# Check for kernel modules
lsmod | grep -v "Module\|iptable\|nf_\|x_table\|xfrm\|udp\|tcp\|inet\|unix\|ext4\|jbd2\|mbcache\|crc16\|sd_mod\|ahci\|libahci\|libata\|scsi_mod\|virtio\|drm\|i2c\|acpi\|battery\|fan\|thermal\|processor\|button\|container\|pci\|serial\|8250\|ip_tables\|x_tables"
```

#### 1.3 Check what attacker read/modified
```bash
# Files modified during attacker window (July 2 22:25-23:15 UTC)
find / -newermt "2026-07-02 22:25" ! -newermt "2026-07-02 23:20" -type f 2>/dev/null | grep -v "/proc/\|/sys/\|/run/\|/var/log/\|/var/cache/\|/tmp/\|.git/\|/root/zion-backups/"

# Check if attacker downloaded anything
journalctl --since "2026-07-02 22:25" --until "2026-07-02 23:15" --no-pager | grep -i "wget\|curl\|scp\|nc\|ncat\|bash\|sh\|python\|perl\|ruby"

# Check bash history (may be cleared)
cat /root/.bash_history
cat /home/*/.bash_history 2>/dev/null

# Check for reverse shells
ss -tunap | grep -E "ESTAB" | grep -v "127.0.0.1\|::1\|tailscale\|zion\|nginx\|caddy\|prometheus\|grafana"
```

#### 1.4 Verify ZION funds
```bash
# Check all account balances
curl -s http://127.0.0.1:8443/rpc -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getAccountBalance","params":["zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604"],"id":1}'

# Pool wallet
curl -s http://127.0.0.1:8443/rpc -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getAccountBalance","params":["zion1e06423c0k3y448c575p7g69338w5r068h38j8e0"],"id":1}'

# Escrow wallet (new)
curl -s http://127.0.0.1:8443/rpc -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getAccountBalance","params":["zion1y0j4..."],"id":1}'

# Check recent transactions (last 100 blocks)
curl -s http://127.0.0.1:8443/rpc -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getBlocksSince","params":{"from_height":23100,"limit":200},"id":1}' | python3 -m json.tool
```

---

### Phase 2: Edge Server Migration (Day 1-2)

**Goal:** Move Edge to a new server with fresh IP, fresh OS, fresh keys

> **Why migrate?** The attacker had 47 minutes of root access. Even with forensics, we cannot guarantee no backdoor was installed. A fresh server is the only safe option.

#### 2.1 Provision new server
- [ ] Order new Hetzner/Cloud VPS (different IP range than current `77.42.71.94`)
- [ ] Choose Ubuntu 24.04 LTS
- [ ] Add SSH key (new `zion-edge-rotation-20260703` key)
- [ ] Do NOT reuse old IP

#### 2.2 Harden new server BEFORE any ZION deploy
```bash
# Update system
apt update && apt upgrade -y

# Create non-root user
adduser zion
usermod -aG sudo zion
mkdir -p /home/zion/.ssh
cp /root/.ssh/authorized_keys /home/zion/.ssh/
chown -R zion:zion /home/zion/.ssh
chmod 700 /home/zion/.ssh
chmod 600 /home/zion/.ssh/authorized_keys

# Harden SSH
cat > /etc/ssh/sshd_config.d/hardening.conf << 'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
AllowUsers zion
EOF
systemctl restart sshd

# UFW — minimal ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8333/tcp   # P2P node1
ufw allow 8334/tcp   # P2P node2
ufw allow 8444/tcp   # Pool
ufw enable

# Install fail2ban
apt install -y fail2ban
systemctl enable fail2ban

# Disable SSH password auth
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

#### 2.3 Install Tailscale on new server
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
# Note the new Tailscale IP
```

#### 2.4 Transfer ZION data from old Edge
```bash
# On OLD Edge: create final backup
ssh edge
cd /root/zion-2.9.6-main
tar czf /tmp/zion-full-backup-$(date +%Y%m%d).tar.gz \
  data/ \
  V3/data/ \
  edge-deploy/config/ \
  --exclude='*.log'

# Transfer to new server via Tailscale
scp /tmp/zion-full-backup-*.tar.gz zion@<NEW_TAILSCALE_IP>:/tmp/
```

#### 2.5 Deploy ZION on new server
- [ ] Build ZION node from source (using code from GitHub)
- [ ] Restore chain state from backup
- [ ] Start node, verify chain height matches old server
- [ ] Start pool, bridge, atomic-swap, DAO, WARP services
- [ ] Verify all 13 services running

#### 2.6 Decommission old Edge
```bash
# On OLD Edge: stop all services
systemctl stop zion-edge-*

# Wipe sensitive data
shred -vfz -n 3 /root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh
shred -vfz -n 3 /root/.ssh/github_deploy

# Cancel Hetzner server (or repurpose)
```

---

### Phase 3: Complete Key Rotation (Day 2-3)

**Goal:** Rotate ALL cryptographic keys — every single one is considered compromised

> **CRITICAL:** This phase requires air-gapped machine for key generation.
> Per `GENESIS_REGENERATION_RUNBOOK.md`

#### 3.1 Air-gapped key generation

**On air-gapped machine (no internet, no WiFi, no Bluetooth):**

```bash
# Install Rust toolchain (pre-downloaded on USB)
# Install ZION repo (pre-cloned on USB)

# Generate 14 new premine keypairs
cargo run --release --bin gen-tithe-wallets -- --count 14 --output /mnt/usb/PREMINE_WALLETS_NEW.json

# Generate canonical wallet keypairs
cargo run --release --bin gen-canonical-wallets -- --output /mnt/usb/CANONICAL_WALLETS_NEW.json

# Generate pool payout keypair
cargo run --release --bin gen-pool-key -- --output /mnt/usb/POOL_KEY_NEW.json

# Generate bridge validator keypairs (5)
cargo run --release --bin gen-bridge-validators -- --count 5 --output /mnt/usb/BRIDGE_VALIDATORS_NEW.json

# Generate EVM deploy keypairs
node gen-evm-keys.js --count 5 --output /mnt/usb/EVM_KEYS_NEW.json

# Generate new SSH keypair for Edge
ssh-keygen -t ed25519 -f /mnt/usb/EDGE_SSH_NEW -N "" -C "zion-edge-rotation-20260703"

# Generate new escrow keypair
cargo run --release --bin gen-escrow-key -- --output /mnt/usb/ESCROW_KEY_NEW.json
```

**Save ALL mnemonics/private keys to:**
- USB drive `F:\ZION_V3_MAINNET_WALLETS_NEW.txt` (encrypted)
- Paper backup (metal plate for seed phrases)
- NEVER on any internet-connected machine

#### 3.2 Update genesis.rs with new addresses
- [ ] Follow `GENESIS_REGENERATION_RUNBOOK.md` step-by-step
- [ ] Update `PREMINE_OUTPUTS` with new addresses
- [ ] Update `MAINNET_CANONICAL_*_WALLET` constants
- [ ] Update `BRIDGE_VAULT_SEED` to new value
- [ ] Recompile and verify genesis hash changed

#### 3.3 Update edge-environment.sh
- [ ] Replace `ZION_POOL_PAYOUT_SK_HEX` with new key
- [ ] Replace `ZION_SWAP_ESCROW_KEY` with new key
- [ ] Replace `ZION_SWAP_ESCROW_ADDRESS` with new address
- [ ] Set file permissions: `chmod 600 edge-environment.sh`
- [ ] **DO NOT COMMIT** — add to `.gitignore`

#### 3.4 Rotate EVM deploy keys
- [ ] Generate new EVM private keys (air-gapped)
- [ ] Transfer contract ownership to multisig (if not already)
- [ ] Update hardhat `.env` on new Edge (chmod 600, NOT in repo)
- [ ] Verify DeFi contracts still functional

#### 3.5 Rotate bridge validator keys
- [ ] Generate 5 new EVM validator keys (air-gapped)
- [ ] Update bridge config on new Edge
- [ ] Re-deploy bridge contracts with new validator set
- [ ] Verify bridge relay functional

#### 3.6 Rotate DAO guardian keys
- [ ] Generate 5 new guardian mnemonics (air-gapped)
- [ ] Update DAO config
- [ ] Re-deploy governance contracts if needed
- [ ] Save mnemonics to `F:\ZION_DAO_GUARDIAN_KEYS_NEW.txt`

---

### Phase 4: Tailscale ACL + Network Hardening (Day 3)

**Goal:** Lock down network access — attacker must not be able to reach Edge

#### 4.1 Remove compromised W11 from Tailscale
- [ ] Go to Tailscale admin console
- [ ] Remove `jose--macbook-pro` (W11 machine) from tailnet
- [ ] Remove any other compromised devices

#### 4.2 Apply tag-based ACL
- [ ] Tag devices:
  - New Edge server → `tag:edge-server`
  - Ubuntu machine → `tag:workstation`
  - Mining server → `tag:mining-server`
  - Legacy devices → `tag:legacy` (deny all)

- [ ] Apply ACL from `SecurityFirst.md` §F2.3:
```json
{
  "tagOwners": {
    "tag:edge-server": ["yosef.hubalek@gmail.com"],
    "tag:workstation": ["yosef.hubalek@gmail.com"],
    "tag:mining-server": ["yosef.hubalek@gmail.com"]
  },
  "acls": [
    {"action": "accept", "src": ["tag:workstation"], "dst": ["tag:edge-server:22", "tag:edge-server:8443", "tag:edge-server:8888"]},
    {"action": "accept", "src": ["tag:mining-server"], "dst": ["tag:edge-server:8333", "tag:edge-server:8334", "tag:edge-server:8444"]},
    {"action": "deny", "src": ["tag:legacy"], "dst": ["*:*"]}
  ]
}
```

#### 4.3 Block attacker IP range
```bash
# On new Edge
ufw deny from 109.81.30.0/24
ufw deny from 109.0.0.0/8  # Broad block — attacker may use other IPs in this range
```

---

### Phase 5: W11 Remediation (Day 3-4)

**Goal:** Either clean W11 or decommission it

#### Option A: Full Wipe (RECOMMENDED)
- [ ] Back up any non-sensitive files to external drive
- [ ] Wipe W11 completely (DBAN or Windows reset with "Remove everything")
- [ ] Reinstall Windows 11 from scratch
- [ ] Do NOT install TeamViewer
- [ ] Do NOT restore old SSH keys or credentials
- [ ] Generate new SSH keys on fresh install

#### Option B: Deep Clean (if wipe not possible)
- [ ] Uninstall TeamViewer completely
- [ ] Run full malware scan (Windows Defender + Malwarebytes + Kaspersky Rescue Disk)
- [ ] Change ALL passwords (email, GitHub, bank, crypto exchanges, etc.)
- [ ] Enable 2FA everywhere
- [ ] Delete all SSH keys in `~/.ssh/`
- [ ] Delete all saved credentials in browser
- [ ] Delete all ZION-related files with credentials
- [ ] Revoke all GitHub SSH keys and PATs
- [ ] Revoke all Tailscale device authorizations for W11

---

### Phase 6: Git History Scrub (Day 4)

**Goal:** Remove any leaked secrets from git history

#### 6.1 Identify files to scrub
- [ ] `PREMINE_WALLETS_BACKUP.json` (if it exists in history)
- [ ] Any file containing private keys, mnemonics, or secrets
- [ ] `edge-environment.sh` versions that contained real SK values

#### 6.2 Scrub with git-filter-repo
```bash
# BACKUP FIRST
git clone --mirror https://github.com/Yose144/Zion-v3.0.0.git Zion-v3.0.0-mirror
cp -r Zion-v3.0.0-mirror Zion-v3.0.0-mirror.bak

# Install git-filter-repo
pip install git-filter-repo

# Scrub sensitive files
cd Zion-v3.0.0-mirror
git filter-repo --invert-paths --path PREMINE_WALLETS_BACKUP.json
git filter-repo --invert-paths --path edge-deploy/config/edge-environment.sh
# Add any other files as needed

# Force push (coordinate with all collaborators)
git push origin --force --all
git push origin --force --tags
```

#### 6.3 Verify scrub
- [ ] Clone fresh repo
- [ ] Search for any private key patterns: `grep -r "AAAA" --include="*.json"`
- [ ] Search for hex keys: `grep -r "[0-9a-f]{64}" --include="*.sh"`
- [ ] Verify no secrets remain in history

---

### Phase 7: Verification + Monitoring (Day 4-5)

**Goal:** Verify everything works and set up continuous monitoring

#### 7.1 Verify ZION node
- [ ] Chain height matches expected value
- [ ] All 13 services running on new Edge
- [ ] Pool accepting shares
- [ ] Bridge relaying transactions
- [ ] Atomic swap functional
- [ ] DAO governance accessible
- [ ] WARP adapters online

#### 7.2 Verify security
- [ ] SSH key auth only (no password)
- [ ] UFW active with minimal ports
- [ ] fail2ban active
- [ ] Tailscale ACL applied
- [ ] No suspicious processes
- [ ] No suspicious network connections
- [ ] Attacker IP blocked

#### 7.3 Set up monitoring
- [ ] Cron job: forged TX scanner (every 5 min)
- [ ] Cron job: balance monitor (every 5 min)
- [ ] Cron job: peer monitor (every 2 min)
- [ ] Cron job: SSH auth log scanner (every 10 min)
- [ ] Alert on: new SSH key added, new user created, new cron job, unexpected outbound connection

#### 7.4 Final security audit
- [ ] Run `nmap` from external machine against new Edge IP
- [ ] Verify only expected ports are open
- [ ] Run `lynis audit system` on new Edge
- [ ] Document final security state in `SecurityFirst.md`

---

## 4. Timeline

| Phase | Duration | Dependency |
|-------|----------|------------|
| Phase 0: Ubuntu boot | 1-2 hours | None |
| Phase 1: Edge forensics | 2-3 hours | Phase 0 |
| Phase 2: Edge migration | 4-8 hours | Phase 1 |
| Phase 3: Key rotation | 4-8 hours | Air-gapped machine |
| Phase 4: Tailscale ACL | 1 hour | Phase 0, 2 |
| Phase 5: W11 remediation | 2-4 hours | Can run in parallel |
| Phase 6: Git scrub | 1-2 hours | Phase 3 (new keys in place) |
| Phase 7: Verification | 2-3 hours | All phases |

**Total estimated time:** 2-3 days

---

## 5. Critical Rules During Recovery

1. **NEVER use W11 for any ZION operation** until it is wiped or deep-cleaned
2. **NEVER connect air-gapped machine to internet** during key generation
3. **NEVER commit secrets to git** — all keys in `edge-environment.sh` (gitignored) or env vars
4. **NEVER reuse any password** from before the compromise
5. **NEVER reuse any SSH key** from before the compromise
6. **NEVER trust the old Edge server** — migrate to fresh server
7. **ALWAYS verify** after each step — don't assume
8. **ALWAYS backup** before destructive operations
9. **ALWAYS use 2FA** on all accounts
10. **ALWAYS document** what was done, when, and by whom

---

## 6. Files to Reference

- `docs/GENESIS_REGENERATION_RUNBOOK.md` — Genesis key rotation procedure
- `SecurityFirst.md` — Security hardening checklist (F1-F5 findings)
- `F5_SECURITY_INCIDENT_REPORT_2026-07-02.md` — F5 incident report
- `SECURITY_TODO_2026-07-03.md` — Pre-existing security TODO list
- `CRITICAL_3.0.4_SECURITY_FINDINGS.md` — Critical security findings

---

## 7. Post-Recovery: Lessons Learned

1. **TeamViewer is a primary attack vector** — never run it on a machine with crypto keys
2. **SSH keys must be isolated** — development machine should not have SSH keys to production
3. **All secrets must be in env vars** — never in files on internet-connected machines
4. **Air-gapped key generation is mandatory** — for all mainnet keys
5. **Tailscale ACL must be applied** — before any production deploy
6. **Monitoring must include SSH auth logs** — not just ZION-specific metrics
7. **Regular security audits** — at least monthly, not just after incidents

---

*This plan is the complete recovery procedure for the 2026-07-03 security incident. Execute in order, verify each step, and document all actions.*
