# Webglobe Email Settings (Presale Backend)

This document captures the required mail server settings and DNS records for Webglobe-hosted mailboxes used by the ZION presale backend.

## Mailbox Connection

- Username: your full mailbox (e.g., presale@zion.omnity.one)
- Encrypted connection: SSL/TLS required

### Incoming Mail Servers
- IMAP(S): mail.webglobe.cz
  - Port: 993
  - Security: SSL
- POP3(S): mail.webglobe.cz
  - Port: 995
  - Security: SSL

### Outgoing Mail Server
- SMTP(S): mail.webglobe.cz
  - Port: 465 (SSL) or 587 (TLS)
  - Auth: required (use mailbox credentials)

### Webmail
- https://webmail.webglobe.cz

## Application Configuration

`.env` values (already applied):
```
SMTP_HOST=mail.webglobe.cz
SMTP_PORT=587
SMTP_USER=presale@zion.omnity.one
SMTP_PASS=CHANGE_ME_SMTP
SMTP_SECURE=tls

IMAP_HOST=mail.webglobe.cz
IMAP_PORT=993
IMAP_SECURE=ssl
POP3_HOST=mail.webglobe.cz
POP3_PORT=995
POP3_SECURE=ssl
```

`api/presale/config.php` picks up:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`

Note: IMAP/POP3 are documented for mailbox client setup; backend currently uses SMTP for sending only.

## DNS Records (Webglobe)

### MX records
- email.webglobe.cz. priority 10
- email2.webglobe.cz. priority 10
- email3.webglobe.cz. priority 10
- email4.webglobe.cz. priority 10

### SPF records
- `v=spf1 a mx include:_spf.webglobe.cz -all`
- `v=spf2.0/mfrom,pra +a +mx include:_spf2.webglobe.cz -all`

Ensure these are added in your domain DNS zone for `zion.omnity.one`.

## Sending best practices
- Use port 587 with `SMTP_SECURE=tls` (recommended)
- Fallback to port 465 with `SMTP_SECURE=ssl` if TLS/587 not available
- Generate an app-specific password if required by provider policy
- Set `SMTP_FROM_EMAIL` and `SMTP_FROM_NAME` (already set in `config.php`)

## Troubleshooting
- If emails fail: check credentials, port/security pair, firewall, and SPF/DMARC alignment
- Verify SSL certificate acceptance in your environment
- Log files: `storage/logs/` contain activity/error entries from the presale backend
