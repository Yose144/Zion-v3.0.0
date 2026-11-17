# REPORT 2026-11-17 — Contabo security incident: ověření obou VPS + rotace root hesel

**Podnět 👤:** e-mail od Contabo Security & Incident Response — *„unauthorized access to our systems"*,
detekováno **sobota 14. 11. 2026**, přístup zastaven, rotace interních credentialů, forenzní šetření
s externími specialisty. Doporučení: monitorovat podezřelou aktivitu, revidovat credentials,
MFA, obezřetnost na phishing.

**Rozsah šetření:** oba Contabo VPS v infrastruktuře —
**EDGE1** `vmi3425821` (`62.171.141.136`, SSH alias `edge`/`zion-post-wipe`) a
**EDGE2** `vmi3684458` (`207.180.217.100`, primární node; potvrzeno `hostname` přes edge klíč).
Hetzner flota (`zion`, `helsinki`, `germany`, `seedde`, `usa2`, `asia3`, `v3-primary`, `v3-follower`)
je u jiného providera — mimo přímý dopad, ale hesla sdílená mezi providery bereme v úvahu (viz §5).

---

## 1. Metoda

Na každém boxu: `auth.log*` (SSH session accounting), `passwd -S root` + `/etc/shadow` stav,
`sshd -T` (efektivní config), `/etc/passwd` + shell users, všechny `authorized_keys`,
`find /etc -newermt 2026-11-14`, binárky `/usr/{bin,sbin,local}` podle mtime, `ld.so.preload`,
`/tmp` `/var/tmp` `/dev/shm`, cron (`/etc/cron.d`, crontabs), systemd unity,
`ps aux` + `ss -tnp state established` (procesy a odchozí spojení), `stat` klíčových souborů.

## 2. EDGE1 (`vmi3425821`) — výsledek: čistě v pokrytém okně

- **Session accounting:** 442× `New session` = 442× `Accepted publickey` — **žádná session bez
  odpovídajícího SSH loginu** (žádný console/VNC/`su`/`login:` záznam v `pam_unix`).
- **Všechny accepts = publickey**, 4 známé otisky:
  - `UOjWE5K22kyJ0Xgxdt/+cySZlErHFQ/y+M9uM/2zmY4` — root, T-Mobile CZ CGNAT IPs
    (`109.81.x.x`, `46.135.x.x`, `2a00:102b:…`) — hlavní klíč 👤;
  - `9mL4tniZYv7KzDtoUXSanw42EuGvdTGF8YvhSyyHSec` — root, jednou z `109.81.88.255` — druhý klíč 👤;
  - `lxbZsTS0bsEfzbKMqBr+DLYPumUR9mg2eORb5FHOB9E` — root z `207.180.217.100` (EDGE2),
    zhruba hodinový rytmus = známá interní automatizace;
  - `gJWr5X20OVxRYsQKYUJYJi2rDDHCksxozauPfKtuloc` — user `hirantunnel`, stejné CGNAT IPs.
- **Žádné** `Accepted password`, žádné cizí IP, žádné neznámé otisky, žádní noví users se
  shellem (root, ubuntu, zion, postgres + tuneloví users — vše známé).
- `authorized_keys` změněn **15. 11. 15:48** — diff proti záloze ukazuje jen dva známé klíče:
  `zion-pool-fencing-probe` (HA fencing, `from="207.180.217.100"`, restricted command) a
  `issy-trustee-2026-11` (truste práce 12.–15. 11.). **Žádné cizí klíče.**
- `/etc/passwd` `/etc/shadow` `/etc/group` mtime 21. 10.; `/etc/sudoers` 2024 — nedotčené.
- Binárky `/usr/bin` `/usr/sbin` `/bin` `/sbin` `/usr/local/{bin,sbin}`: **0 souborů
  změněných po 14. 11.**; `ld.so.preload` neexistuje; `/dev/shm` prázdné.
- Cron: jen root crontab `zion-pool-mem-probe.sh` + standardní `/etc/cron.d` — čistě.
- Systemd: unity změněné po 14. 11. = jen známé `zion-*` (tunnel-pool, g8-probe-shadow, ops).
- Procesy: miner/node/pool/nirvana-net/dashboard/prometheus/grafana/fail2ban + SSH tunely
  `chaintunnel@207.180.217.100` — vše známá ZION infra. Žádné reverse-liché shelly.
- Odchozí spojení: stratum k minerům (různé IP = pool peers), SSH/monitoring na EDGE2,
  sshd sessions z CGNAT IPs 👤 — nic anomálního.
- `wtmp` rotace (začátek 17. 11. 05:26) = **standardní logrotate** (`/etc/logrotate.d/wtmp`),
  ne anti-forenzní mazání.

## 3. EDGE2 (`vmi3684458`) — výsledek: čistě

- `sshd -T`: `passwordauthentication no`, `permitrootlogin without-password`.
- Agregace `Accepted` přes dostupnou historii (týdenní rotace, coverage 25. 10. → teď):
  - `62.171.141.136` (EDGE1) — automatizace/tunely (klíče `TOIW5Vucm…`, `oGpv5UCA3IYM…`);
  - `109.81.x.x` / `46.135.x.x` / `62.204.228.138` — T-Mobile CGNAT, klíč `UOjWE5K…` 👤
    + `mrt+VuV+3IZX…` (druhý stroj) + `9mL4tniZYv7…`;
  - `chaintunnel` z EDGE1.
- **2× `Accepted password` pro root z `109.81.23.46` — 21. 10.** (před incidentem,
  vlastní IP 👤, historická událost při setupu; `passwordauthentication` je teď `no`).
- `authorized_keys`: `issy-trustee-2026-11` přidán **15. 11. 15:48:24** — sekundu po EDGE1,
  stejná ops session; ostatní klíče známé (`zion-edge-post-wipe`, `zion-desktop`,
  `root@vmi3425821`, `zion@vmi3425821-edge2probe`).
- `/etc/passwd`/`shadow` mtime 21. 10., sudoers 2024 — nedotčené.

## 4. Co se stalo — akce

**Rotace root hesel provedena 17. 11. ~13:31 CET na OBou boxech:**
- Nové heslo generováno **na serveru** (`openssl rand`, 32 alfanumerických znaků),
  `chpasswd`, uložené do **`/root/SECURITY-2026-11-17-root-password.txt`** (`chmod 600`).
  Hesla se do konverzace/logů nevypisovala.
- `passwd -S root` na obou: `P 2026-11-17` — potvrzeno.
- Důvod: `PasswordAuthentication no` kryje jen SSH; **Contabo VNC konzole = lokální
  login přes PAM a sshd ji nefiltruje** — heslo je jediný credential, který mohl útočník
  s Contabo-level přístupem reálně použít. Nové heslo je unikátní, nikde jinde nepoužité.

## 5. Co zůstává otevřené / doporučení

1. **Mezera v logu EDGE1:** `auth.log` začíná **14. 11. 05:23 CET** (starší rotací pryč),
   journald teprve od 16. 11. — přístup **před** tímto okamžikem z logů neověříme.
   Mitigace: žádné persistence artefakty (klíče, procesy, cron, binárky) nenalezeny,
   takže i eventuální dřívější přístup by nezanechal stopu — ale **100% vyloučení
   hypervisor-level přístupu (offline čtení disku/RAM) není z guesta možné**; to je
   v rukou Contabo IR.
2. **Contabo účet sám:** zkontrolovat heslo panelu, API tokeny, MFA, e-mailový účet,
   ke kterému je panel vázán. Pokud je heslo sdílené s jinými servisy — rotovat všude.
3. **Hetzner flota:** jiný provider, ale pokud se tam hesla/opakují — audit
   `authorized_keys` + `passwd -S` na `zion`, `helsinki`, `germany`, `seedde`,
   `usa2`, `asia3`, `v3-primary`, `v3-follower` (zde neděláno — mimo rozsah).
4. **Phishing:** e-mail samotný je trigger — neklikávat na odkazy z „incident update"
   zpráv; doména incident page ověřit na contabo.com.
5. **Sledovat:** denní aktualizace Contabo Incident page; filtr `zion-ssh-tunnel.rules.yml`
   na EDGE1 už existuje — zvážit alert na `Accepted password` / non-CGNAT IP.

## 6. Verdikt

V pokrytém okně (14. 11. 05:23 → 17. 11.) **žádný důkaz neoprávněného přístupu
k EDGE1 ani EDGE2**. Root hesla rotována, persistence audit čistý. Zbytkové riziko =
hypervisor-level přístup ze strany Contabo a přístup před oknem logů — neověřitelné
z guest OS, kryté rotací hesel a klíčovou autentizací.

---
*Šetření provedeno 17. 11. 2026, Devin session. Důkazy: auth.log agregace, stat mtimů,
process/connection listing — viz §§2–3.*
