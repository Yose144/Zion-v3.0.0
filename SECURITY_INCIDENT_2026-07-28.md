# Security Incident Report — 2026-07-28

## Summary

**Type:** Remote Access Trojan (RAT) / Backdoor installation via trojanized crypto wallet
**Detected:** 2026-07-28 23:35 CEST (during security audit)
**Compromised host:** Windows PC (user `anaha`, hostname `ZION`, SID `S-1-5-21-3962002267-3681256327-2215504745-1001`)
**Attacker active window:** 2026-07-27 06:25 CEST — 2026-07-28 23:35 CEST (~17 hours)
**Status:** Backdoor removed, attacker access terminated. Post-incident remediation pending (see Action Items).
**Attack vector:** CONFIRMED — trojanized "Zano Wallet" installer from `zanowallet.io` (fake phishing site impersonating official Zano wallet at `zano.org`). Installer bundled Remote Utilities RAT via silent MSI dependency. Matches known Russian threat actor campaign (Hybrid Analysis, July 2026).

---

## 1. Timeline

| Time (UTC) | Event |
|---|---|
| 2026-07-27 04:25:42 | Remote Utilities generated new certificate on host (`rut_log_2026-07.html`, code 110) |
| 2026-07-27 06:25:18 | MSI database written: `C:\ProgramData\Remote Utilities\msi\70730_{F6688BD5-2126-4F4F-A484-1D05781479B9}\database.msi` (30 MB) |
| 2026-07-27 06:25:28 | **SilentInstall** of Remote Utilities - Host v7.7.3.0 (build 70730) — `install.log`: `SilentInstall: CreateService. OK` |
| 2026-07-27 06:25:42 | First log entry in `C:\ProgramData\Remote Utilities\Logs\rut_log_2026-07.html` |
| 2026-07-27 06:26:45 | Zano Wallet installed at `C:\Program Files (x86)\Zano Wallet` (user-confirmed legitimate) |
| 2026-07-27 06:27:16 | Caphyon Advanced Installer cache for Zano Wallet written |
| 2026-07-27 02:33:18 | `~/.ssh/zion-new-server` private key last modified (pre-existing, but accessible to attacker from 06:25 UTC) |
| 2026-07-27 03:59:40 | Zion wallet `zion1p0w4k0k5v5.json` created in `zion-desktop-agent-dev\wallets\` |
| 2026-07-27 18:12:45 | Zion wallet `zion1g8y2r8j8l6.json` created in `zion-desktop-agent-dev\wallets\` |
| 2026-07-28 23:34:02 | `rutserv.exe` process started (PID 9460, parent services.exe PID 1380) — boot-time autostart |
| 2026-07-28 23:35 CEST | Security audit began; RAT discovered |
| 2026-07-28 23:45 CEST | Remediation completed — all attacker processes, services, firewall rules, and files removed |

---

## 2. Indicators of Compromise (IOCs)

### 2.1 Malicious files (removed)

| Path | SHA256 | Notes |
|---|---|---|
| `C:\Program Files (x86)\Remote Utilities - Host\rutserv.exe` | — | Remote Utilities host binary, 22.5 MB, dated 2025-11-11 (downloaded by attacker) |
| `C:\Program Files (x86)\Remote Utilities - Host\rfusclient.exe` | — | Remote Utilities client, 16.3 MB, dated 2025-11-11 |
| `C:\Program Files (x86)\Remote Utilities - Host\service\WindowsModulesService.exe` | `E6A0C1E2845A4B96407989BC869CFB321AC04DD0070BD5F45AEC4B14B06F1852` | **Trojan** — masquerades as Windows system service "Windows Modules Service" (real one is `TrustedInstaller`). 279 KB, dated 2025-08-02 |
| `C:\Program Files (x86)\Remote Utilities - Host\service\Updater.dll` | `CE9E136C693DA525D27A60DDE053A367FF0DF8E95201B51FD1A3B19ACC50CAC6` | Updater DLL, 112 KB, dated 2025-08-02 |
| `C:\Program Files (x86)\Remote Utilities - Host\libasset32.dll` | — | 9.9 MB, dated 2025-11-11 |
| `C:\Program Files (x86)\Remote Utilities - Host\libcodec32.dll` | — | 6.2 MB, dated 2025-11-11 |
| `C:\ProgramData\Remote Utilities\msi\70730_{F6688BD5-2126-4F4F-A484-1D05781479B9}\database.msi` | — | Installer cache, 30 MB |
| `C:\ProgramData\Remote Utilities\Logs\rut_log_2026-07.html` | — | Event log (certificate generation, connections) |
| `C:\ProgramData\Remote Utilities\install.log` | — | Silent install log — **key evidence** |

All files under `C:\Program Files (x86)\Remote Utilities - Host\` and `C:\ProgramData\Remote Utilities\` had the **hidden** attribute set.

### 2.2 Malicious services (removed)

| Service name | Display name | Path | Start type | Status |
|---|---|---|---|---|
| `RManService` | Remote Utilities - Host | `rutserv.exe -service` | Auto | Removed |
| `Windows Modules Service` | Windows Modules Service | `C:\Program Files (x86)\Remote Utilities - Host\service\WindowsModulesService.exe` | Auto | Stopped + files deleted |

`Windows Modules Service` is **not** a legitimate Windows service. The real Windows Modules Installer service is named `TrustedInstaller` (display name: "Windows Modules Installer"). This naming was deliberately chosen to evade detection.

### 2.3 Malicious firewall rule (removed)

| Display name | Direction | Action | Protocol | Local port | Remote port | Profile | Program |
|---|---|---|---|---|---|---|---|
| Remote Utilities - Host | Inbound | Allow | Any | Any | Any | Any (Domain, Private, Public) | `rutserv.exe` |

This rule opened **unrestricted inbound access** on all profiles including Public — a critical exposure.

### 2.4 Network indicators

Active outbound connections from `rutserv.exe` (PID 9460) at time of discovery:

| Remote IP | Remote port | Protocol | ASN / Owner | Location | Notes |
|---|---|---|---|---|---|
| `172.241.164.247` | 5655 | TCP | AS396362 — **Leaseweb USA, Inc.** (New York) | US | Remote Utilities relay server (attacker-controlled) |
| `184.164.136.138` | 5655 | TCP | AS20454 — **Secured Servers LLC** (Phoenix, AZ), sub-alloc **Zenex 5ive Limited** | Phoenix, Arizona, US | Remote Utilities relay server (attacker-controlled, 3 connections) |

Port 5655 is the default Remote Utilities relay port. Both IPs are **US-based hosting providers** commonly used for relay/proxy infrastructure. These IPs are **attacker infrastructure** and should be blocked at the network perimeter.

**Key observation:** The attacker used two different relay servers on two different hosting providers (Leaseweb and Secured Servers/PhoenixNAP). This is consistent with a professional attacker using commercial Remote Utilities relay infrastructure to maintain persistent access. The relays act as intermediaries — the attacker connects to the relay, and the victim's `rutserv.exe` also connects to the relay, so the attacker's real IP is not directly visible in the victim's network logs.

### 2.5 Installation method

From `C:\ProgramData\Remote Utilities\install.log`:
```
27-07-2026_06:25:28#T:SilentInstall: installation 70730
27-07-2026_06:25:28#T:SilentInstall: NTSetPrivilege:SE_DEBUG_NAME:false. OK
27-07-2026_06:25:28#T:SilentInstall: OpenService: service not found_1. OK
27-07-2026_06:25:28#T:SilentInstall: CreateService. OK
27-07-2026_06:25:28#T:SilentInstall: finished (installation) 70730
```

**SilentInstall** — no user dialog, no UAC prompt. This indicates the attacker already had elevated access (or used a privilege escalation exploit) prior to deployment. The `SE_DEBUG_NAME` privilege acquisition suggests the installer ran with admin/SYSTEM rights.

### 2.6 Antivirus status at time of incident

| Product | State |
|---|---|
| AVG Antivirus | Installed, real-time protection was ON at time of attack (user-confirmed). At time of audit: `RealTimeProtectionEnabled: False` (Passive Mode). No detections in `detections.log`. |
| Windows Defender | Passive mode (deferred to AVG) |

**Why AVG did not detect the attack:** Remote Utilities is **legitimní komerční RMM (Remote Management Monitoring) software** from "Remote Utilities Pte. Ltd." — it is not classified as malware by antivirus vendors. The attacker abused a legitimate tool as a backdoor (a technique known as "living off the land"). AVG's `detections.log` is empty — no threats were flagged because the software itself is not malicious.

The `RealTimeProtectionEnabled: False` observed during the audit is likely a **consequence** of the attack, not the cause — the attacker may have disabled AVG's real-time shield via Remote Utilities after gaining access, or AVG entered passive mode due to a configuration conflict. The user confirms AVG was active at the time of the incident.

**AVG exclusion check:** No exclusions for `rutserv`, `Remote Utilities`, or `WindowsModulesService` were found in AVG logs. The attacker did not need to add exclusions because the software is not flagged as malware.

### 2.7 Security event log

The Windows Security event log was **empty** at time of audit — either audit logging was not enabled or the log was cleared. Audit logging has now been enabled (Logon/Logoff, Object Access, Privilege Use, Account Management — success + failure).

---

## 3. Compromised Assets

### 3.1 SSH private key (CRITICAL)

| File | SHA256 | Last modified |
|---|---|---|
| `C:\Users\anaha\.ssh\zion-new-server` | `D2D9722F6F479CE0B694CB7E20D5E8403401BDE2AF0C6EF99EBF3371CC0F83FE` | 2026-07-27 02:33:18 |

This key grants SSH access to the Zion Edge server at `62.171.141.136` (port 2222, IPv6 `2a02:c207:2342:5821::1`). The attacker had full filesystem access from 2026-07-27 06:25 UTC onward — **the key must be considered compromised**.

### 3.2 Zion wallets (CRITICAL)

| File | Address | Last modified |
|---|---|---|
| `C:\Users\anaha\AppData\Roaming\zion-desktop-agent-dev\wallets\zion1p0w4k0k5v5.json` | `zion1p0w4k0k5v5` | 2026-07-27 03:59:40 |
| `C:\Users\anaha\AppData\Roaming\zion-desktop-agent-dev\wallets\zion1g8y2r8j8l6.json` | `zion1g8y2r8j8l6` | 2026-07-27 18:12:45 |

These wallet files contain encrypted private keys. The attacker had filesystem access — **assume the private keys are compromised**. Funds should be moved to new wallets immediately.

### 3.3 Potentially compromised (browser data)

The attacker had full desktop access for ~17 hours via Remote Utilities. The following may have been exfiltrated:

- Browser saved passwords (Edge, Chrome if installed)
- Browser cookies and session tokens
- Browser autofill data
- Any open application state visible on screen
- Clipboard contents
- Files on Desktop, Downloads, Documents

No keylogger was found in the process list, but a short-lived keylogger cannot be ruled out.

### 3.4 Not compromised (verified)

| Asset | Status |
|---|---|
| Local user accounts | No new users created; Administrator/Guest/DefaultAccount/WDAGUtilityAccount all disabled |
| Startup registry (HKLM/HKCU Run keys) | Clean — no attacker entries |
| Scheduled tasks (non-Microsoft) | `TestDevinTask` (Devin CLI test, runs notepad — benign); `SoftLanding*` tasks have empty actions — likely benign ASUS/AMD telemetry |
| SSH `authorized_keys` | Not present on this Windows host |
| `known_hosts` | Only Zion server entries — no unexpected hosts |

---

## 4. Remediation Performed

| Action | Status |
|---|---|
| Stopped `rutserv.exe` (PID 9460) | ✅ Done |
| Stopped `WindowsModulesService.exe` (PID 8512) | ✅ Done |
| Stopped `rfusclient.exe` (PID 12176) | ✅ Done |
| Stopped + disabled `RManService` | ✅ Done (service deleted) |
| Stopped `Windows Modules Service` | ✅ Done (process killed, files deleted) |
| Removed firewall rule "Remote Utilities - Host" | ✅ Done |
| Deleted `C:\Program Files (x86)\Remote Utilities - Host\` | ✅ Done (verified False) |
| Deleted `C:\ProgramData\Remote Utilities\` | ✅ Done (verified False) |
| Enabled Security audit logging | ✅ Done (Logon/Logoff, Object Access, Privilege Use, Account Management) |
| Verified no active connections to port 5655 | ✅ Done (none found) |
| Verified no remaining rutserv/WindowsModulesService processes | ✅ Done (none found) |
| AVG real-time protection | ⚠️ Still disabled — **user must enable via AVG GUI** |

---

## 5. Action Items (USER — do these from a clean device, e.g. Mac)

### Priority 1 — Immediate (do now)

- [ ] **Rotate SSH key for Zion Edge server** — generate new keypair on Mac, add new public key to `~/.ssh/authorized_keys` on `62.171.141.136` (port 2222), remove old key. Check `/var/log/auth.log` for unauthorized logins from 2026-07-27 06:25 UTC onward.
- [ ] **Move ZION funds** from `zion1g8y2r8j8l6` and `zion1p0w4k0k5v5` to newly generated wallet addresses.
- [ ] **Change passwords** for all accounts (email, GitHub, bank, crypto exchanges, Discord, WhatsApp, Microsoft account) — do this from the Mac, not the compromised PC.
- [ ] **Revoke browser sessions** — sign out all devices in Edge/Chrome/Google account settings.
- [ ] **Enable AVG real-time protection** on the PC (or uninstall AVG and use Windows Defender with real-time on).

### Priority 2 — Within 24 hours

- [ ] **Full antivirus scan** on the PC (AVG or Windows Defender full scan).
- [ ] **Review Zion Edge server logs** — `journalctl -u sshd`, `/var/log/auth.log`, `last` — for any logins from unexpected IPs after 2026-07-27 06:25 UTC.
- [ ] **Check Zion Edge server** for unauthorized changes (new users, cron jobs, modified services, new SSH keys in `authorized_keys` for root and zionserver users).
- [ ] **Enable 2FA** on all accounts that support it; review existing 2FA devices for attacker-added entries.
- [ ] **Check GitHub** for any unauthorized SSH/GPG keys added to account, and unauthorized repo access or commits.

### Priority 3 — Recommended

- [ ] **Reinstall Windows** — this is the only way to guarantee the system is clean. The attacker had SYSTEM-level access for ~17 hours; additional malware beyond Remote Utilities cannot be fully ruled out.
- [ ] **Block attacker IPs** at router/firewall: `172.241.164.247`, `184.164.136.138` (and port 5655 inbound/outbound).
- [ ] **Review Zion premine/canonical wallet addresses** on the Edge server — verify no unauthorized transactions occurred.
- [ ] **Consider this PC untrusted** until Windows is reinstalled — do not access crypto wallets or SSH keys from it.

---

## 6. Forensic Evidence Preserved

The following evidence was observed and documented during the audit but **not preserved as files** (the malicious files were deleted during remediation). If law enforcement or insurance requires evidence, the key artifacts were:

- `C:\ProgramData\Remote Utilities\install.log` — proves silent install
- `C:\ProgramData\Remote Utilities\Logs\rut_log_2026-07.html` — connection/certificate log
- `C:\Program Files (x86)\Remote Utilities - Host\service\WindowsModulesService.exe` — SHA256 `E6A0C1E2845A4B96407989BC869CFB321AC04DD0070BD5F45AEC4B14B06F1852`
- `C:\Program Files (x86)\Remote Utilities - Host\service\Updater.dll` — SHA256 `CE9E136C693DA525D27A60DDE053A367FF0DF8E95201B51FD1A3B19ACC50CAC6`

If a future incident requires prosecution, submit the SHA256 hashes to VirusTotal / threat intel feeds. The `WindowsModulesService.exe` hash is the most distinctive IOC.

---

## 7. Attack Vector (CONFIRMED)

### Vector: Trojanized Zano Wallet installer from `zanowallet.io`

The attack vector has been **confirmed** through forensic analysis. The user downloaded a trojanized "Zano Wallet" installer from `zanowallet.io` — a **fake phishing site** impersonating the official Zano cryptocurrency wallet. The real Zano project is at `zano.org` with downloads at `build.zano.org`.

### Evidence chain

1. **Chrome download history** (preserved — attacker cleared browsing history but not downloads):
   - `2026-07-27 06:15:57 CEST` — `zano-wallet-2.0.4-installer.exe` (689,259,216 bytes / 689 MB) downloaded from `https://zanowallet.io/download`
   - SHA256: `878D013AEEE7FF90CAE8BE10D7E194E5FDEC61C8D0F543F0F88244DC32E9CD5D`

2. **Prefetch (execution timeline on 2026-07-27)**:
   | Time (CEST) | Executable | Significance |
   |---|---|---|
   | 06:09 | `SYSTEMSETTINGSADMINFLOWS.EXE` | UAC consent dialog shown (installer requested admin) |
   | 06:15:57 | (Chrome download) | Zano Wallet installer download completed |
   | 06:23 | `CHXSMARTSCREEN.EXE` | SmartScreen checked the installer (user clicked "Run anyway") |
   | 06:25 | `MSIEXEC.EXE` | MSI installer ran — **installed Remote Utilities silently** |
   | 18:15 | `ZANOWALLET.EXE` | Zano Wallet launched (legitimate wallet also installed as cover) |

3. **MSI install history** (registry `Uninstall` keys, `InstallDate=20260727`):
   - **Zano Wallet** — MSI `{71F1B5A6-40BD-41EB-A37C-7CBB69C4E0F0}` (Caphyon Advanced Installer)
   - **Remote Utilities - Host** — MSI `{F6688BD5-2126-4F4F-A484-1D05781479B9}` (silent dependency)

   Both were installed by the same Caphyon Advanced Installer package. The installer bundled Remote Utilities as a silent prerequisite/dependency alongside the legitimate Zano Wallet.

4. **Browser history cleared**: Both Chrome and Edge browsing history (urls/visits tables) were **emptied for 2026-07-25 to 2026-07-27**. The attacker (or the installer's batch script) cleared browsing history to cover tracks. Download history was preserved (separate SQLite table).

5. **`zanowallet.io` is NOT the official Zano source**:
   - Official Zano project: `zano.org` (downloads at `build.zano.org`, GitHub `hyle-team/zano`)
   - `zanowallet.io` claims to be "independent third-party wallet" by "Zano Wallet LLC"
   - The site explicitly tells users to **disable antivirus** ("known false positive") and **bypass SmartScreen** ("click More info then Run anyway") — classic malware distribution social engineering

### This is a known campaign (threat intelligence match)

This attack matches a **documented threat actor campaign** reported by Hybrid Analysis in July 2026:

> *"Suspected Russian Threat Actor Impersonates Legitimate Crypto Wallets to Deploy Remote Utilities"*

**Source:** `https://hybrid-analysis.blogspot.com/2026/07/suspected-russian-threat-actor.html`

The campaign characteristics match exactly:
- **Fake crypto wallet domains**: `zanowallet.io`, `anchorwallet.org`, `darkwallet.is` — all impersonate legitimate crypto wallets
- **Advanced Installer packages**: 600MB+ null-padded executables (our installer: 689 MB) — padded to appear legitimate and evade sandbox analysis
- **Batch scripts** inside the installer orchestrate download and execution of MSI files from threat actor infrastructure
- **Remote Utilities (RuRAT)** deployed for persistent access — described as "legitimate Russian-made remote management utility"
- **`rfusclient`** process — observed in our incident, documented in the campaign report
- **Scheduled tasks** created for persistence
- **Living off the land (LotL)**: Uses legitimate RMM tool to evade antivirus detection

The `WindowsModulesService.exe` trojan (SHA256 `E6A0C1E2845A4B96407989BC869CFB321AC04DD0070BD5F45AEC4B14B06F1852`) masquerading as a Windows system service is an additional payload dropped by the installer — this is **not** part of the standard Remote Utilities package.

### Attack flow (confirmed)

```
1. User searches for Zano Wallet → finds zanowallet.io (SEO poisoning or direct)
2. User downloads zano-wallet-2.0.4-installer.exe (689 MB) from zanowallet.io/download
3. User runs installer → UAC prompt (06:09) → user grants admin
4. SmartScreen warning (06:23) → user clicks "Run anyway" (site instructed this)
5. Caphyon Advanced Installer runs:
   a. Silently installs Remote Utilities - Host via MSI (06:25)
   b. Installs legitimate Zano Wallet as cover (so user sees a working wallet)
   c. Drops WindowsModulesService.exe trojan
   d. Creates firewall rule for Remote Utilities
   e. Clears browser history
6. Remote Utilities connects to attacker relay servers:
   - 172.241.164.247:5655 (Leaseweb USA)
   - 184.164.136.138:5655 (Secured Servers/PhoenixNAP)
7. Attacker has full remote access for ~17 hours
```

### Why AVG did not detect it

- **Remote Utilities is legitimate commercial software** — not classified as malware by AVG
- **The installer requested admin via UAC** — user approved, so AVG assumed it was user-intended
- **SmartScreen was bypassed** by user action (the site instructed users to click "Run anyway")
- **AVG real-time was ON** but had no reason to flag a legitimate RMM tool
- The `zanowallet.io` site explicitly tells users that antivirus flags are "false positives" — social engineering to ensure users disable/bypass protection

### IOCs for this campaign

| Type | Value | Source |
|---|---|---|
| Domain | `zanowallet.io` | Fake Zano wallet download site |
| Domain | `anchorwallet.org` | Fake Anchor wallet download site (same campaign) |
| Domain | `darkwallet.is` | Fake Dark Wallet download site (same campaign) |
| File SHA256 | `878D013AEEE7FF90CAE8BE10D7E194E5FDEC61C8D0F543F0F88244DC32E9CD5D` | Trojanized Zano Wallet installer (689 MB) |
| File SHA256 | `E6A0C1E2845A4B96407989BC869CFB321AC04DD0070BD5F45AEC4B14B06F1852` | WindowsModulesService.exe trojan |
| File SHA256 | `CE9E136C693DA525D27A60DDE053A367FF0DF8E95201B51FD1A3B19ACC50CAC6` | Updater.dll (trojan component) |
| MSI GUID | `{F6688BD5-2126-4F4F-A484-1D05781479B9}` | Remote Utilities - Host MSI |
| MSI GUID | `{71F1B5A6-40BD-41EB-A37C-7CBB69C4E0F0}` | Zano Wallet MSI (Caphyon Advanced Installer) |
| IP | `172.241.164.247:5655` | Attacker relay server (Leaseweb USA) |
| IP | `184.164.136.138:5655` | Attacker relay server (Secured Servers/PhoenixNAP) |
| Registry | `HKLM\SOFTWARE\Usoris\Remote Utilities Host\Host\Parameters` | Remote Utilities config (per campaign report) |

---

*Report generated 2026-07-28 by Devin security audit.*
