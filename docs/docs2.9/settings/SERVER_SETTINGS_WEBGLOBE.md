# Webglobe Server Settings (newearth.cz)

This document consolidates server access, management tools, and DNS settings for the `newearth.cz` hosting on Webglobe.

## Secure File Transfer (SFTP / SCP / SSHFS)
- Hostname: `ftp.newearth.cz` (or IP `62.109.151.114` if domain not yet active)
- Port: `222`
- Username: main FTP account
- Password: FTP account password

`.env` placeholders (already added):
```
SFTP_HOST=ftp.newearth.cz
SFTP_PORT=222
SFTP_USER=CHANGE_ME_FTP_USER
SFTP_PASS=CHANGE_ME_FTP_PASS
```

## Web Tools
- phpMyAdmin: https://dbadmin.webglobe.cz
- Adminer: https://adminer.webglobe.cz
- WebFTP: https://ftp.webglobe.cz

## FTP (unsecured) – not recommended
- Hostname: `ftp.newearth.cz` (or `62.109.151.114`)
- Username: main FTP account
- Password: FTP account password

## DNS Settings
- A record (IPv4): `62.109.151.114`
- AAAA record (IPv6): `2001:1ab0:7e1e:151:62:109:151:114`
- Nameservers:
  - NS1: `ns1.webglobe.cz`
  - NS2: `ns2.webglobe.cz`
  - NS3: `ns3.webglobe.com`

## Notes
- Prefer SFTP on port 222 for deployments and file management.
- Keep FTP credentials out of version control; use `.env` only on deployment host.
- Coordinate DNS changes with Webglobe support if domain is mid-transfer.
