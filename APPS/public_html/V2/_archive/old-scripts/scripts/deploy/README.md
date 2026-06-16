# V2 Deployment (Webglobe SFTP)

This script deploys the `public_html/V2` folder to the Webglobe hosting using SFTP/SCP on port 222. It optionally deploys the Presale API as well.

## Setup

1) Copy the example env and fill your credentials:
```
cp scripts/deploy/.env.deploy.example scripts/deploy/.env.deploy
nano scripts/deploy/.env.deploy
```

2) Adjust variables:
- `SFTP_HOST=ftp.newearth.cz`
- `SFTP_PORT=222`
- `SFTP_USER=YOUR_FTP_USERNAME`
- `REMOTE_V2_PATH=public_html/V2`
- `REMOTE_API_PATH=` (optional; set only if your hosting exposes `api/presale` under a specific path)
- `BACKUP_BEFORE_DEPLOY=true`

## Run

On macOS (zsh):
```
bash scripts/deploy/deploy_v2.sh
```
You will be prompted for the SFTP/SSH password for `SFTP_USER`.

## What it does
- Backs up the remote `V2` directory (renames it to `V2-backup-YYYYmmdd-HHMMSS`) if `BACKUP_BEFORE_DEPLOY=true`
- Ensures target folder exists
- Uploads all files from local `public_html/V2/` to the remote `REMOTE_V2_PATH`
- Optionally uploads `api/presale/` if `REMOTE_API_PATH` is set

## Notes
- Keep `scripts/deploy/.env.deploy` out of version control (contains credentials)
- If your hosting uses a different web root, update `REMOTE_V2_PATH`
- For API deployment on shared hosting, consider placing `api/presale/` outside the web root or protecting it appropriately