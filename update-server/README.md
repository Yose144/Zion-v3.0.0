# ZION Update Server

License-gated auto-update server for the ZION Desktop Agent.

## Architecture

```
┌─────────────────┐     POST /api/check-update       ┌─────────────────────┐
│  Desktop Agent   │ ────────────────────────────────▶│  Update Server       │
│  (Electron)      │    { licenseKey, platform,       │  (Fastify + SQLite)  │
│                  │      arch, currentVersion }      │                      │
│                  │◀────────────────────────────────│  ┌───────────────┐  │
│                  │  { updateAvailable, latest,      │  │ License DB    │  │
│                  │    releaseNotes, jwt }           │  │ (SQLite)      │  │
│                  │                                  │  └───────────────┘  │
│  electron-updater│  GET /api/releases/latest.yml    │                      │
│  (generic provider)──────────────────────────────▶│  ┌───────────────┐  │
│                  │  X-License-Key: ZION-XXXX-...    │  │ Releases dir  │  │
│                  │◀────────────────────────────────│  │ (installers + │  │
│                  │  YAML manifest or 403            │  │  latest*.yml) │  │
│                  │                                  │  └───────────────┘  │
│                  │  GET /api/releases/:v/:file      │                      │
│                  │  ?token=<jwt>                    │                      │
│                  │ ───────────────────────────────▶│                      │
│                  │◀────────────────────────────────│                      │
│                  │  Binary stream                   │                      │
└─────────────────┘                                  └─────────────────────┘
```

## Quick Start

### 1. Install dependencies

```bash
cd update-server
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set UPDATE_ADMIN_TOKEN and UPDATE_JWT_SECRET
# Generate tokens:
#   openssl rand -hex 32  # for UPDATE_ADMIN_TOKEN
#   openssl rand -hex 64  # for UPDATE_JWT_SECRET
```

### 3. Run the server

```bash
npm start
# Server listens on http://localhost:3001
```

### 4. Generate a license key

```bash
UPDATE_ADMIN_TOKEN=your-token \
node scripts/generate-license.js --email user@example.com --name "John Doe" --max 1
```

Output:
```
License created:
  Key:    ZION-A1B2-C3D4-E5F6-7890
  Email:  user@example.com
  Max:    1 activation(s)
```

### 5. Build + upload a release

```bash
# From the desktop-agent directory:
cd ../APP\&WEB/desktop-agent
npm run build:mac  # or build:win / build:linux

# Upload to server (local filesystem):
UPDATE_RELEASES_DIR=/path/to/update-server/data/releases \
node ../../update-server/scripts/upload-release.js --version 3.0.5 --dir ./dist
```

Or use the all-in-one script:
```bash
cd update-server
UPDATE_RELEASES_DIR=./data/releases ./scripts/publish-release.sh 3.0.5 mac
```

## API Reference

### Desktop endpoints (license-gated)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/check-update` | Body: `licenseKey` | Check for available update |
| `GET` | `/api/releases/:ymlFile` | Header: `X-License-Key` | Get `latest.yml` / `latest-mac.yml` / `latest-linux.yml` |
| `GET` | `/api/releases/:version/:fileName` | JWT (query `?token=`) or `X-License-Key` header | Download installer binary |

### Mobile IAP endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/iap/validate` | Body: `platform`, `productId`, `receiptData`/`purchaseToken`, `transactionId`, `deviceId` | Validate Apple/Google receipt, create entitlement |
| `GET` | `/api/iap/entitlements` | Query: `deviceId` | Get device's active entitlements |
| `POST` | `/api/iap/restore` | Body: `deviceId`, `receipts[]` | Restore purchases across devices |

### Admin endpoints (token-gated)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/admin/generate` | `Authorization: Bearer <token>` | Create license key |
| `GET` | `/admin/licenses` | `Authorization: Bearer <token>` | List all licenses |
| `POST` | `/admin/revoke` | `Authorization: Bearer <token>` | Revoke a license |
| `POST` | `/admin/publish-release` | `Authorization: Bearer <token>` | Register release metadata |
| `GET` | `/admin/iap/receipts` | `Authorization: Bearer <token>` | List all IAP receipts |
| `GET` | `/admin/entitlements` | `Authorization: Bearer <token>` | List all entitlements |
| `POST` | `/admin/entitlements/revoke` | `Authorization: Bearer <token>` | Revoke an entitlement |

### Health check

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server health status |

## License Management

### Generate a license

```bash
# Single activation
node scripts/generate-license.js --email customer@example.com

# Multi-device (3 activations)
node scripts/generate-license.js --email customer@example.com --max 3

# With customer name and notes
node scripts/generate-license.js --email customer@example.com --name "Jane Smith" --notes "Pro tier - annual"
```

### List all licenses

```bash
node scripts/list-licenses.js
```

Output:
```
3 license(s):

  ZION-A1B2-C3D4-E5F6-7890  OK  user1@example.com  (1/1 activations, 1 devices)  2026-07-10T...
  ZION-B2C3-D4E5-F6A7-8901  OK  user2@example.com  (0/3 activations, 0 devices)  2026-07-10T...
  ZION-C3D4-E5F6-A7B8-9012  REVOKED  user3@example.com  (2/1 activations, 2 devices)  2026-07-09T...
```

### Revoke a license

```bash
node scripts/revoke-license.js ZION-A1B2-C3D4-E5F6-7890
```

## Deployment

### Docker (recommended)

```bash
# Set environment variables
export UPDATE_ADMIN_TOKEN=$(openssl rand -hex 32)
export UPDATE_JWT_SECRET=$(openssl rand -hex 64)

# Build and run
docker compose up -d

# Check health
curl http://localhost:3001/health
```

### Reverse proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name updates.zionterranova.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 500M;  # Allow large file uploads

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Direct on server

```bash
# Install Node.js 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
cd /opt
git clone <repo> zion-update-server
cd zion-update-server
npm install --production

# Set environment
cp .env.example .env
nano .env  # set tokens

# Run with systemd
cat > /etc/systemd/system/zion-update.service << 'EOF'
[Unit]
Description=ZION Update Server
After=network.target

[Service]
Type=simple
User=zion
WorkingDirectory=/opt/zion-update-server
EnvironmentFile=/opt/zion-update-server/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable zion-update
sudo systemctl start zion-update
```

## Desktop Agent Configuration

The Desktop Agent is configured to use this update server via `package.json`:

```json
"publish": [{
  "provider": "generic",
  "url": "https://updates.zionterranova.com/api/releases",
  "channel": "latest"
}]
```

**User flow:**
1. User opens Desktop Agent → Settings → Updates
2. Enters license key → clicks "Activate"
3. App validates license with server
4. User clicks "Check for Updates"
5. electron-updater fetches `latest.yml` with `X-License-Key` header
6. If update available, user clicks "Download"
7. After download, user clicks "Install & Restart"

## Code Signing (Future)

When certificates are purchased, set these environment variables before building:

### Windows (OV/EV Code Signing Certificate)
```bash
export CSC_LINK="path/to/cert.pfx"
export CSC_KEY_PASSWORD="cert-password"
npm run build:win
```

### macOS (Apple Developer ID)
```bash
export CSC_NAME="Your Name (Developer ID)"
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run build:mac
```

Without code signing, auto-update download works but installation may be blocked by:
- **Windows**: SmartScreen warning (user can bypass)
- **macOS**: Gatekeeper "unidentified developer" (user can bypass via right-click → Open)

## File Structure

```
update-server/
├── server.js              # Fastify server (main entry)
├── db.js                 # SQLite database layer
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── scripts/
│   ├── migrate.js         # DB initialization
│   ├── generate-license.js # Create license key
│   ├── list-licenses.js   # List all licenses
│   ├── revoke-license.js  # Revoke a license
│   ├── upload-release.js  # Upload build artifacts
│   └── publish-release.sh # Build + publish (all-in-one)
└── data/                  # Runtime data (gitignored)
    ├── licenses.db        # SQLite database
    └── releases/          # Release artifacts
        ├── latest.yml     # Windows manifest
        ├── latest-mac.yml # macOS manifest
        ├── latest-linux.yml # Linux manifest
        └── 3.0.5/         # Version-specific files
            ├── ZION-Miner-Setup-3.0.5.exe
            ├── ZION-Miner-3.0.5.dmg
            └── ...
```
