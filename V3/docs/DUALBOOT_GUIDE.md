# Dual-Boot Ubuntu Server 24.04 LTS + Windows 11 — ZION Mainnet Node Setup

**Version:** 1.0  
**Date:** 2026-05-19  
**Target:** Existing Windows 11 PC → add Ubuntu Server 24.04 LTS for ZION V3 mainnet

---

## Prerequisites

| Item | Minimum | Recommended | What You Need |
|------|---------|-------------|---------------|
| Free disk space | 120 GB | 500 GB+ | Unallocated space on NVMe/SATA SSD |
| RAM | 16 GB total | 32 GB total | Enough for both OS simultaneously (only one runs) |
| USB flash drive | 8 GB | 16 GB | For Ubuntu installer |
| Backup | — | External disk | **Back up your Windows data first** |
| Internet | 25 Mbps | 100+ Mbps | P2P sync + pool operation |

**Important:** If your PC has only one disk and Windows occupies all of it, you must **shrink the Windows partition** first. If you have a second disk (NVMe/SATA), install Ubuntu there — much safer.

---

## Step 1 — Disable Fast Startup in Windows 11

Windows Fast Startup locks the NTFS partition, which breaks Linux boot.

1. Open **Control Panel** → **Power Options** → **Choose what the power buttons do**
2. Click **Change settings that are currently unavailable**
3. **Uncheck** "Turn on fast startup (recommended)"
4. Save changes

Also disable **Secure Boot** in BIOS if you have issues with GRUB later:
- Reboot → press `F2`/`Del`/`F12` (depends on motherboard) → BIOS Setup
- Find **Secure Boot** → set to **Disabled**
- Save and exit

---

## Step 2 — Prepare Disk Space

### Option A: Second Disk (RECOMMENDED)

If you have a second NVMe or SATA SSD:
1. Physically install it (M.2 slot or SATA).
2. Boot Windows, open **Disk Management** (`diskmgmt.msc`).
3. Initialize the new disk as **GPT**.
4. Leave it **unallocated** — Ubuntu installer will handle it.

### Option B: Shrink Windows Partition

If you have only one disk:
1. Open **Disk Management** (`diskmgmt.msc`).
2. Right-click your C: drive → **Shrink Volume**.
3. Enter the amount to shrink in MB:
   - 120 GB = 122,880 MB (bare minimum)
   - 500 GB = 512,000 MB (recommended)
4. Wait for completion. You will see **Unallocated** space.

**Warning:** Do not touch the small EFI System Partition (~100–500 MB) or Recovery partitions.

---

## Step 3 — Create Ubuntu Server Installer USB

1. Download **Ubuntu Server 24.04.2 LTS** from https://ubuntu.com/download/server
   - File: `ubuntu-24.04.2-live-server-amd64.iso` (~2.5 GB)
2. Download **Rufus** from https://rufus.ie (Windows app).
3. Insert USB flash drive (all data will be erased).
4. Open Rufus:
   - Device: your USB drive
   - Boot selection: the downloaded `.iso`
   - Partition scheme: **GPT**
   - Target system: **UEFI (non-CSM)**
   - Click **START**
5. When prompted, choose **Write in ISO Image mode**.
6. Wait for completion.

---

## Step 4 — Install Ubuntu Server

1. **Reboot PC** with USB inserted.
2. Enter **boot menu** during POST (usually `F12`, `F10`, or `Esc`).
3. Select **USB UEFI** entry to boot from the flash drive.
4. Ubuntu installer loads. Choose language (English recommended for CLI consistency).

### Installer Steps

1. **Keyboard layout:** Czech (`Czech`) or US (`English (US)`) — your preference.

2. **Choose the type of installation:**
   - Select **Ubuntu Server** (not minimized).

3. **Network configuration:**
   - Your Ethernet/Wi-Fi adapter should auto-configure via DHCP.
   - Write down the IP address shown — you will need it for SSH.

4. **Proxy:** Leave blank (unless you use a corporate proxy).

5. **Ubuntu archive mirror:** Keep default.

6. **Filesystem setup:**
   - Choose **Custom storage layout**.
   - **If second disk:** Select the unallocated disk → **Create Logical Volume** or simple partition.
     - `/` (root): 100 GB ext4
     - `/data/zion` (blockchain): remainder of disk, mount point `/data/zion`
   - **If shrinking Windows:** Select the unallocated space → create:
     - `/` (root): 100 GB ext4
     - `/data/zion`: remainder
   - **Do not** format existing Windows partitions (NTFS).

7. **Profile setup:**
   - Your name: `zion-operator`
   - Server name: `zion-node-01`
   - Username: `zion`
   - Password: **strong password** (write it down!)
   - Confirm password

8. **Upgrade to Ubuntu Pro:** Skip (press Done).

9. **SSH setup:**
   - **Install OpenSSH server:** Yes (checked).
   - **Import SSH identity:** Skip for now.

10. **Featured Server Snaps:**
    - **None.** Docker we install manually. Press Done.

11. Installation runs (~10–20 min). When complete:
    - **Remove USB flash drive**
    - Press **Reboot Now**

---

## Step 5 — GRUB Bootloader (Dual-Boot Menu)

After reboot, you should see the **GRUB menu** with options:
```
Ubuntu
Windows Boot Manager
UEFI Firmware Settings
```

If you **do not see GRUB** and Windows boots directly:
1. Boot back into Ubuntu USB (live mode, not install).
2. Open terminal and run:
   ```bash
   sudo add-apt-repository ppa:yannubuntu/boot-repair
   sudo apt update
   sudo apt install boot-repair
   sudo boot-repair
   ```
3. Choose **Recommended Repair**. It reinstalls GRUB and detects Windows.
4. Reboot.

If GRUB is hidden (Ubuntu boots directly):
- Edit `/etc/default/grub`:
  ```bash
  sudo nano /etc/default/grub
  ```
- Change `GRUB_TIMEOUT_STYLE=hidden` → `GRUB_TIMEOUT_STYLE=menu`
- Change `GRUB_TIMEOUT=0` → `GRUB_TIMEOUT=10`
- Run `sudo update-grub`

---

## Step 6 — Post-Install Ubuntu Configuration

Boot into Ubuntu. Log in as your user (`zion`).

### 6.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y vim curl wget htop net-tools ufw fail2ban
```

### 6.2 Install Docker + Docker Compose

```bash
# Remove old versions if any
sudo apt remove -y docker docker-engine docker.io containerd runc

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

### 6.3 Create ZION Data Directory

```bash
sudo mkdir -p /data/zion
sudo chown -R $USER:$USER /data/zion
```

If you created a separate `/data/zion` partition during install, it should already be mounted. Verify:
```bash
df -h /data/zion
```

### 6.4 Configure Firewall (ufw)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (restrict to your LAN IP if possible)
sudo ufw allow 22/tcp comment 'SSH'

# ZION P2P — MUST be public
sudo ufw allow 8333/tcp comment 'ZION P2P'

# ZION Pool Stratum — MUST be public
sudo ufw allow 8444/tcp comment 'ZION Pool'

# ZION RPC — RESTRICT to localhost / LAN only!
sudo ufw allow from 127.0.0.1 to any port 8443 comment 'ZION RPC localhost only'

# Grafana — restrict to your admin IP (replace X.X.X.X)
sudo ufw allow from YOUR_ADMIN_IP to any port 3000 comment 'Grafana admin only'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

**Replace `YOUR_ADMIN_IP`** with your public or LAN IP. You can find it via:
```bash
curl ifconfig.me
```

### 6.5 Install Fail2Ban (Brute-Force Protection)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

Default config protects SSH. For ZION-specific protection, add:

```bash
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[zion-pool]
enabled = true
port = 8444
filter = zion-pool
logpath = /var/log/zion-pool.log
maxretry = 10
bantime = 1800
EOF
```

Create the filter:
```bash
sudo tee /etc/fail2ban/filter.d/zion-pool.conf << 'EOF'
[Definition]
failregex = ^.*invalid_login.*from <HOST>.*$
            ^.*rejected_share.*from <HOST>.*$
ignoreregex =
EOF

sudo systemctl restart fail2ban
```

---

## Step 7 — Router Configuration (Port Forwarding)

You need to forward ports from your public IP to your Ubuntu PC's LAN IP.

1. Find your Ubuntu PC's **LAN IP**:
   ```bash
   ip addr show | grep "inet " | head -n1
   ```
   Example: `192.168.1.42`

2. Access your router (usually `192.168.1.1` or `192.168.0.1` in browser).
3. Find **Port Forwarding** / **Virtual Servers** / **NAT** section.
4. Add rules:

| Service | External Port | Internal IP | Internal Port | Protocol |
|---------|---------------|-------------|---------------|----------|
| ZION P2P | 8333 | 192.168.1.42 | 8333 | TCP |
| ZION Pool | 8444 | 192.168.1.42 | 8444 | TCP |

**Do NOT forward:**
- 8443 (RPC) — internal use only
- 3000 (Grafana) — use VPN or restrict IP
- 22 (SSH) — restrict to your admin IP if you forward it at all

### Static LAN IP (Recommended)

Set a static IP on Ubuntu so port forwarding does not break:

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

Edit to match (adjust interface name and IP to your LAN):
```yaml
network:
  version: 2
  ethernets:
    enp3s0:  # your interface name; check with `ip link show`
      dhcp4: no
      addresses:
        - 192.168.1.42/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 1.1.1.1
          - 8.8.8.8
```

Apply:
```bash
sudo netplan apply
```

---

## Step 8 — Dynamic DNS (If No Static Public IP)

Most home ISPs assign dynamic public IPs. Use Cloudflare or No-IP.

### Cloudflare (Free)

1. Sign up at https://cloudflare.com
2. Add your domain (or get a free subdomain at Freenom / Porkbun).
3. Create an A record: `node.yourdomain.com` → your current public IP.
4. Get your **Zone ID** and **API Token** (Edit zone DNS permissions).
5. Install cloudflared or ddclient:

```bash
sudo apt install -y ddclient
sudo nano /etc/ddclient.conf
```

```ini
protocol=cloudflare, \
zone=yourdomain.com, \
password=YOUR_API_TOKEN \
node.yourdomain.com
```

```bash
sudo systemctl enable ddclient
sudo systemctl restart ddclient
```

Your follower nodes will use:
```bash
ZION_SEED_PEERS=node.yourdomain.com:8333
```

---

## Step 9 — Clone Repo & Configure ZION

```bash
cd ~
git clone https://github.com/Yose144/2.9.6.git zion

cd zion/V3/docker

# Copy the example and edit
cp .env.mainnet.example .env.mainnet
nano .env.mainnet
```

Fill in **your real values**:
- `ZION_MINER_ADDRESS` — your wallet
- `ZION_HUMANITARIAN_WALLET` — your humanitarian address
- `ZION_ISSOBELLA_WALLET` — your issobella address
- `ZION_POOL_FEE_WALLET` — your pool fee address
- `ZION_POOL_WALLET` — pool operational wallet
- `ZION_POOL_PAYOUT_SK_HEX` — **generate fresh!** See below.
- `ZION_SEED_PEERS` — leave blank (Greenfield = no seeds)

### Generate Fresh Pool Payout Key

```bash
cd ~/zion
cargo run --manifest-path V3/Cargo.toml -p zion-core --bin gen-pool-payout-wallet
```

Write down the output. **Never share the SK.**

---

## Step 10 — Launch ZION Stack

```bash
cd ~/zion/V3/docker

# Start mainnet services
docker compose -f docker-compose.yml --profile mainnet up -d

# Check status
docker compose ps
docker compose logs -f node
```

Health checks should pass within ~60 seconds.

### Add Monitoring

```bash
docker compose -f docker-compose.yml --profile mainnet --profile monitoring up -d
```

Access Grafana at: `http://192.168.1.42:3000` (from your LAN only, via ufw).

---

## Step 11 — Verify Everything Works

### From Ubuntu (local):
```bash
# Node health
curl -s http://localhost:8443/health | jq .

# Pool health
curl -s http://localhost:8444/health | jq .

# Peer connections
curl -s http://localhost:8443/v1/peers | jq '. | length'
```

### From another device / internet:
```bash
# Test P2P port is open
telnet YOUR_PUBLIC_IP 8333
# or
nc -vz YOUR_PUBLIC_IP 8333

# Test pool port
telnet YOUR_PUBLIC_IP 8444
```

Use an online port checker: https://www.yougetsignal.com/tools/open-ports/

---

## Step 12 — Boot Back to Windows 11

When you need Windows:
1. Reboot PC.
2. At the **GRUB menu**, select **Windows Boot Manager**.
3. Windows 11 loads normally.

Your ZION node stops when Ubuntu is not running. For 24/7 operation, leave the PC booted into Ubuntu. If you need both simultaneously, consider:
- A **cheap used SFF PC** (~$150) as a dedicated Ubuntu node
- **Hyper-V** on Windows 11 Pro (run Ubuntu VM — see SERVERPLAN.md trade-offs)

---

## Troubleshooting

### Ubuntu does not boot, goes straight to Windows
- Boot from USB → **Try Ubuntu** → open terminal → `sudo boot-repair`
- Or: Enter BIOS → Boot Order → move Ubuntu/GRUB above Windows Boot Manager.

### Windows does not appear in GRUB
- Boot into Ubuntu → `sudo update-grub`
- If still missing: `sudo os-prober` then `sudo update-grub`

### No internet in Ubuntu
- Check cable/Wi-Fi: `ip link show`
- DHCP issue: `sudo dhclient -v enp3s0` (replace interface)

### Docker containers fail to start
- Check disk space: `df -h /data/zion`
- Check logs: `docker compose logs node`
- Check env file: `cat .env.mainnet | grep -v "^#" | grep -v "^$"`

### Port forwarding not working
- Verify Ubuntu has static LAN IP
- Check router firewall rules
- Some ISPs block ports — contact them or use non-standard ports (update `.env.mainnet`)

---

## Quick Reference — Commands After Setup

| Task | Command |
|------|---------|
| Boot Ubuntu | Default at GRUB |
| Boot Windows | Select at GRUB |
| Start stack | `docker compose --profile mainnet up -d` |
| View logs | `docker compose logs -f node` |
| Stop stack | `docker compose down` |
| Update code | `git pull origin main && docker compose up -d --build` |
| Check disk | `df -h /data/zion` |
| Firewall status | `sudo ufw status verbose` |
| SSH into Ubuntu | `ssh zion@192.168.1.42` |

---

*Guide generated by Devin — 2026-05-19*
