# ZION — Kontrolní seznam předání a technický stav

**DŮVĚRNÉ / NEVEŘEJNÉ**
**Poslední revize:** 2026-09-06
**Účel:** úplná kontrola předání správy projektu ZION na Eriku Imlaufovou — darovací listina + plná moc, pojistka pro rodinu a projekt.

> **Bezpečnostní pravidlo:** Do tohoto souboru nikdy nepatří skutečné mnemoniky, privátní klíče, hesla, recovery kódy ani API tokeny. Uvádí se jen typ aktiva, jeho inventární označení a bezpečné místo uložení.

## Stavové značky

- **[HOTOVO — REPO]** — doloženo zdrojovým kódem, konfigurací nebo reportem v repu.
- **[HOTOVO — HISTORICKY]** — uvedeno jako dokončené v provozním reportu, ale před podpisem je vhodné znovu ověřit živý stav.
- **[OVĚŘIT LIVE]** — repo tvrzení nestačí; nutná kontrola Edge, účtu, blockchainu nebo provideru.
- **[PENDING]** — práce nebo důkaz ještě není dokončený.
- **[BLOKÁTOR]** — neuzavírat převod ani nepodepisovat přesné tvrzení, dokud nebude bod vyřešen.

---

## 1. Dokumenty a podpis

- [HOTOVO — REPO] `ZION_DAROVACI_LISTINA_A_PLNA_MOC.md` — hlavní jednotná listina (darování, plná moc a nástupnictví).
- [HOTOVO — REPO] `ZION_SUCCESSION_DECLARATION.pdf` — čisté 2stránkové PDF k přímému podpisu.
- [HOTOVO — REPO] `ZION_SUCCESSION_AND_IP_TRANSFER_PLAN.md` — interní technický inventář a rozpis.
- [HOTOVO — REPO] Tento checklist.
- [HOTOVO — REPO] `docs/private/` je v `.gitignore`; soubory se nedostanou do gitu ani na veřejný server.
- [PENDING] Doplnit data narození a adresy Yosefa, Eriky a Petry.
- [PENDING] Podepsat PDF Yosefem Hubálkem (zakladatel/dárce/zmocnitel), Erikou Imlaufovou (hlavní správkyně) a Petrou Tkácovou (náhradní správkyně).
- [PENDING] Podepsaný originál uložit fyzicky v bezpečí; digitální kopii uchovat šifrovaně.

**Klíčové role:**  
- **Hlavní správkyně (Trustee):** Erika Imlaufová  
- **Náhradní správkyně (Fallback):** Petra Tkácová (při nečinnosti či nemožnosti Eriky)  
- **Beneficienti:** Sarah Hubalková a Tadeas Hubalek (nezletilé děti)

---

## 2. Právní a vlastnické minimum

- [PENDING] Vyžádat aktuální výpis z obchodního rejstříku a ověřit, kdo je společníkem `OMNITY.ONE s.r.o.` (IČO 09120050).
- [HOTOVO — OVĚŘENO UŽIVATELEM] Yosef Hubálek je jediný jednatel. **Jednatel není totéž co jediný společník**; vlastnictví podílu se musí doložit výpisem.
- [HOTOVO — ROZHODNUTÍ] Obchodní podíl není v darovací smlouvě; závěť jej zahrnuje pouze tehdy, bude-li jej Yosef v den smrti vlastnit.
- [PENDING] Pokud by se podíl převáděl za života, ověřit požadavky § 209 odst. 2 ZOK a společenské smlouvy; zpravidla jde o písemnou smlouvu s úředně ověřenými podpisy, nikoli automaticky notářský zápis.
- [HOTOVO — ROZHODNUTÍ] Erika nabývá jen převoditelná soukromá aktiva vymezená darovací smlouvou; účelové fondy a majetek společnosti jsou vyloučeny.
- [PENDING] U nezletilých posoudit zastoupení, správu majetku a případné schválení opatrovnickým soudem. Při konfliktu zájmů Erika nemusí moci zastupovat sebe i děti současně.
- [PENDING] Ověřit daňové a účetní dopady daru, kryptomajetku a obchodního podílu.
- [PENDING] Ověřit skutečný registr ochranných známek. Repo dokumenty uvádějí `ZION®`, `Zion TerraNova®` a `AI Native®` jako známky společnosti; text v repu sám o sobě vlastnictví neprokazuje.
- [PENDING] Provést copyright/CLA audit všech skutečných přispěvatelů. `Yose144` v metadatech ani git commit autora samy o sobě nedokazují vlastnictví všech částí projektu.
- [PENDING] Oddělit vlastní dílo od kódu třetích stran: OpenZeppelin, RandomX, Forge-std, Beam, Bitcoin/Zcash části a další závislosti zůstávají pod původními licencemi.
- [HOTOVO — ROZHODNUTÍ] Veřejné `LICENSE`, `Cargo.toml`, `package.json` a právní stránky se zatím **nemění**. Změnit je až po právním úkonu a copyright auditu.

---

## 3. Rozsah majetku k inventuři

Každou položku označit jako **vlastněná Yosefem**, **vlastněná společností**, **licencovaná třetí stranou**, nebo **pouze přístup / provozní oprávnění**.

- [PENDING] Zdrojový kód V31, archivní V3, `APP&WEB`, `ZION_OS`, CLI, SDK, smart kontrakty a build/release skripty.
- [PENDING] Dokumentace, whitepapery, marketing, překlady, grafika, logo, názvy a vizuální identita.
- [PENDING] Ochranné známky a případné přihlášky známek.
- [PENDING] Obchodní podíl a majetek `OMNITY.ONE s.r.o.`.
- [PENDING] Domény, DNS, Cloudflare, certifikáty a registrátorské účty.
- [PENDING] GitHub osobní účet, organizace, repozitáře, Actions secrets, deploy keys, release signing keys a recovery metoda.
- [PENDING] Edge/Contabo účet, server, zálohy, systemd, nginx a monitoring.
- [PENDING] Emailové schránky, Google Workspace/OAuth, ZIS, sociální sítě, Discord/Telegram/YouTube/X.
- [PENDING] Účty poskytovatelů: AWS, Mailchimp, Sumsub, SimpleMining/SMOS, hosting, Grafana/Prometheus a případné burzy.
- [PENDING] On-chain adresy, UTXO, DAO guardian/admin oprávnění, bridge validator set a escrow.

---

## 4. Klíče a přístupy — bez zapisování tajemství

### 4.1 Kanonická sada klíčů

Zdrojový stav uvádí tuto sadu:

- 14 premine klíčů
- 5 canonical wallet klíčů
- 3 admin klíče
- 7 DAO guardian klíčů
- 5 EVM validator klíčů
- 1 escrow klíč
- **Celkem matematicky: 35 keypairs**

- [BLOKÁTOR] `V31/STATUS.md` na jednom místě uvádí **38 klíčů**, zatímco součet kategorií a kořenový `AGENTS.md` uvádějí **35**. Před podpisem vytvořit podepsaný inventář a opravit tento rozpor v interních podkladech.
- [OVĚŘIT LIVE] Dokumentace uvádí různé názvy adresářů (`ZION_KEYS_GENESIS_V2_2026-08-06` vs. starší `ZION_KEYS_NEW_GENESIS_2026-08-06`). Ověřit skutečné aktuální umístění; do checklistu nepsat obsah klíčů.

|| Oblast | Co ověřit | Bezpečné místo / inventární ID | Stav předání |
||--------|-----------|-------------------------------|--------------|
|| Premine / genesis (14) | všech 14 slotů, adresy, účel, zámky | __________________ | [ ] |
|| L5 Free World Projects (Slot 4 + 5) | adresy `zion1h7r3...` + `zion1x535...`, celkem 3,3B ZION, admin-locked | __________________ | [ ] |
|| Canonical wallets (5) | role a adresy | __________________ | [ ] |
|| Admin (3) | 3-of-3 veřejný set a náhradní postup | __________________ | [ ] |
|| DAO guardians (7) | 5-of-7 treasury set, rotation procedure | __________________ | [ ] |
|| EVM validators (5) | bridge set, threshold, escrow | __________________ | [ ] |
|| Escrow | konkrétní role a recovery | __________________ | [ ] |
|| Edge SSH | klíč, fingerprint, recovery, bez hesla v dokumentu | __________________ | [ ] |
|| GitHub | account/org owner, 2FA, recovery codes | __________________ | [ ] |
|| Domain/DNS | registrátor, 2FA, transfer lock | __________________ | [ ] |
|| ZIS/OAuth | super-admin, signing keys, DB credentials | __________________ | [ ] |
|| Backup encryption | klíč pro obnovu, test dešifrování | __________________ | [ ] |

- [PENDING] Předat Erice bezpečným osobním způsobem, ne e-mailem ani v chatu.
- [PENDING] Sepsat předávací protokol: datum, inventární ID, počet položek, kontrolní otisk veřejných klíčů, podpisy obou stran.
- [PENDING] Po převodu změnit recovery kontakty, 2FA a přístupová oprávnění; samotná kopie klíče není rotace klíče.
- [PENDING] U kritických multisigů předem ověřit, že Erika má skutečně použitelného signera a že existuje náhradní signer pro případ ztráty přístupu.
- [ ] Nikdy netisknout ani nefotit mnemonic do tohoto souboru nebo do veřejného repa.

---

## 5. Premine, zámky a L5 Free World Projects

### 5.1 Kanonická částka a rozpor v dokumentaci

- [HOTOVO — REPO] `V31/L1/core/src/emission.rs` a `V31/L1/core/src/genesis.rs` uvádějí: **genesis premine 16 780 000 000 ZION**.
- [HOTOVO — REPO] Celková supply je **144 000 000 000 ZION**; mining emission podle kódu je **127 220 000 000 ZION**.
- [BLOKÁTOR] `docs/LEGAL/PREMINE_DISCLOSURE.md` stále uvádí **16 280 000 000 ZION** a mining supply **127 720 000 000 ZION**. Před právním nebo veřejným použitím částky dokumentaci rekonciliovat.
- [BLOKÁTOR] `docs/LEGAL/INFRASTRUCTURE_FUNDING.md` také používá starší částku 16,28 mld.; nesmí být použit jako aktuální finanční rozpis.
- [BLOKÁTOR] Veřejné právní dokumenty mají nekonzistentní status (v3.0.4/v3.0.5 vs. aktuální V31/3.2.0-beta) a některé relativní odkazy vypadají rozbité. Před zveřejněním opravit nebo výslovně označit jako archiv.
- [OVĚŘIT LIVE] Při předání vytvořit snapshot aktuálních genesis adres, UTXO a zůstatků; zdrojový kód sám nepotvrzuje aktuální neutracený stav chainu.

### 5.2 Rozpad kanonického V31 premine (aktualizováno 2026-09-06)

|| Kategorie | Počet slotů | Částka ZION | Zámek podle kódu |
||-----------|-------------:|------------:|------------------|
|| OASIS + Golden Egg | 3 | 4 950 000 000 | admin-locked |
|| **L5 Free World Projects** | **2** | **3 300 000 000** | **admin-locked (přepsáno z OASIS Slot 4 + 5)** |
|| DAO Treasury | 3 | 4 000 000 000 | admin-locked + time-lock do výšky 144 000 |
|| Infrastruktura / Genesis Projects | 3 | 2 590 000 000 | admin-locked |
|| Humanitární / Children Future Fund | 1 | 1 440 000 000 | admin-locked |
|| Bridge Seed | 1 | 400 000 000 | admin-locked |
|| Bridge Vault UTXO | 1 | 100 000 000 | admin-locked |
|| **Celkem** | **14** | **16 780 000 000** | |

- [HOTOVO — REPO] `V31/L1/core/src/v3_compat.rs` uvádí u všech 14 premine outputů `admin_locked = true`. Sloty 4 i 5 nyní `category: "l5_free_world"`.
- [HOTOVO — REPO] `V31/L4/oasis/src/rewards.rs` aktualizováno: OASIS pool je nyní 3 sloty = 4.95B (Sloty 4 + 5 repurposed na L5).
- [HOTOVO — REPO] Premine transfer lock podle kódu vyžaduje 3-of-3 admin multisig a DAO vote; u DAO Treasury existuje navíc výškový time-lock 144 000.
- [BLOKÁTOR] Nesměšovat premine transfer lock (3-of-3 admin + DAO) s provozním treasury thresholdem 5-of-7 nebo s bridge unlock thresholdem. Jde o různé pravomoci.
- [HOTOVO — ZÁMĚR] UTXO se nyní nemají přesouvat. Rodinný plán řeší správu klíčů a oprávnění, nikoli okamžitý on-chain převod.
- [BLOKÁTOR] „Třetina pro každého" není v aktuálním chainu automaticky implementována. Zakládací listina musí říct, zda se týká všech premine fondů, pouze soukromě spravovaných podílů, nebo vůbec ne veřejně účelových fondů (DAO, humanitární, infrastruktura, bridge, L5).
- [PENDING] Po právním schválení definovat, zda jsou děti beneficienti, budoucí vlastníci, nebo pouze chránění příjemci; do plnoletosti nesmí dojít k neřízenému vydání klíčů.
- [PENDING] Každou změnu admin/guardian setu nejprve otestovat na testnetu nebo v offline simulaci a až poté provádět on-chain změnu.

### 5.3 L5 Free World Projects — rozdělení Slot 4 + 5 (3.3B ZION)

- [HOTOVO — REPO] Rozdělení 3.3B ZION mezi 5 L5 projektů + 800M rezerva (viz §3.2 v `ZION_SUCCESSION_AND_IP_TRANSFER_PLAN.md`).
- [HOTOVO — REPO] Správci (zástupci) pro každý L5 projekt určeni.
- [PENDING] Ověřit, že L5 Free World scanner (`zion-v31-free-world.service`) je aktivní a sleduje humanitarian tithe.
- [HOTOVO — REPO] L5 scanner je read-only tracker — nemá disbursement pravomoc.

**L5 projekty a správci:**

| L5 projekt | Správce (zástupce) | Částka (ZION) |
|------------|---------------------|--------------:|
| Projekt Genesis Garden | Petra Tkácová | 500 000 000 |
| Project Dharma Temple | Erika Imlaufová | 500 000 000 |
| Projekt Te Piko Ora | Vahine Fierro | 500 000 000 |
| Project Bohemia | Andrea Kalousová | 500 000 000 |
| Project Bodhi Lanka | Annicka Purkertová | 500 000 000 |
| L5 rezervní fond | Erika Imlaufová (Trustee) | 800 000 000 |
| **Celkem** | | **3 300 000 000** |

---

## 6. Kontrolní stav optimalizací a oprav

Stav níže je převzatý z `V31/STATUS.md`, `StatusV3.md`, `docs/3.2/ROADMAP.md`, `AGENTS.md` a zdrojového kódu. Historické „active" není náhradou za nový live check.

|| Oblast | Stav | Evidence / detail | Co ověřit před předáním |
||--------|------|-------------------|-------------------------|
|| V31 build a testy | [HOTOVO — REPO / WARNINGS] | `cargo test --manifest-path V31/Cargo.toml --workspace` prošel; `cargo clippy` 0, ale hlásí warnings | Uložit commit + výstupy; před releasem vyřešit clippy warnings |
|| V31 genesis reset 2026-08-06 | [HOTOVO — REPO] | V31 hash `96109423...`, V3 compat hash `4cf7560f...` | Live `getStatus`, genesis block, adresy a key inventory |
|| Počet genesis keypairs | [BLOKÁTOR] | Kategorie dávají 35, jeden status uvádí 38 | Reconcile a podepsat inventář |
|| Premine lock + coinbase maturity | [HOTOVO — HISTORICKY] | Validace v `Node::submit_block`, mempool/template testy | Ověřit `ZION_SOFT_FORK_ACTIVATION` na všech nodech |
|| LWMA difficulty | [HOTOVO — HISTORICKY] | `MIN_SOLVE_TIME=6`, `MAX_SOLVE_TIME=360`, clamp ±50 % | Live block time, difficulty a jednotná binárka |
|| CPU-only enumerace GPU | [HOTOVO — REPO] | `ZION_GPU_BACKEND=cpu` obchází OpenCL/CUDA/Metal | Spustit miner na Edge a zkontrolovat journal |
|| Edge CPU miner | [OVĚŘIT LIVE] | Service `--no-gpu --no-cpu`, `ZION_GPU_BACKEND=cpu`, 4 threads | Ověřit active, hashrate a accept rate |
|| Trinity ZION/ZANO/VRSC | [HOTOVO — HISTORICKY] | Per-coin result channels, stale-job fix, 22–24 MH/s | Live share accept/reject a konfiguraci rigů |
|| CUDA DAG cache | [HOTOVO — REPO] | Cache v `~/.zion/dag-cache` | Ověřit vlastnictví a velikost |
|| Native TX/address index | [HOTOVO — REPO] | `tx_index`, `output_index`, `address_tx_index`, backfill | Live integrity SQLite |
|| UTXO v2 wallet/CLI/pool | [HOTOVO — HISTORICKY] | V2 hash, `submitUtxoTransaction`, wallet SDK, CLI | Wallet send test s neprodukční částkou |
|| Wallet SDK TypeScript | [HOTOVO — REPO] | `APP&WEB/zion-wallet-sdk` `npm run build` prošel | Uložit záměrný commit/snapshot |
|| Website build/lint/typecheck | [HOTOVO — REPO / WARNINGS] | `npm run build` prošel, 114 routes; lint 0 errors, 6 warnings | Odstranit/zdokumentovat warnings |
|| ZIS | [HOTOVO — HISTORICKY] | `zion-zis.service`, `auth.zionterranova.com` | `/health`, env, DB, OAuth recovery |
|| DEX `/dex` UI | [HOTOVO — HISTORICKY] | TDZ/debounce fix, mock E2E 8/8, quote real E2E | Funded execute/withdraw E2E |
|| ZIS multichain wallet | [OVĚŘIT LIVE] | Deposit/ledger/withdraw flow, per-chain decimals | Authenticated on-chain deposit → swap → withdraw |
|| Autonomní profit router | [HOTOVO — REPO / PENDING LIVE] | Hardware autodetect, 15% hysterese | Reálný GPU workflow |
|| Reconciliation monitor | [HOTOVO — REPO] | On-chain balance vs. interní ledger/AMM reserves | Ověřit alarmy a admin endpointy |
|| HTLC L1 | [HOTOVO — HISTORICKY] | Live lock → claim, adapters pro lock/claim/refund | Live refund path a cross-chain evidence |
|| Cross-chain intent execution | [PENDING] | Reálný WARP bridge deploy stále čeká | Neprezentovat jako plně produkční |
|| Non-EVM WARP | [HOTOVO — REPO] | `disabled_reason` v config/registry/API | Ověřit, že UI skrývá disabled chainy |
|| Solver network | [HOTOVO — REPO] | Config registry, per-solver auth, intent/bid/execute | Produkční endpointy a monitoring |
|| Bridge Base round-trip | [HOTOVO — HISTORICKY] | 100 ZION lock → mint → burn → unlock | Zkontrolovat validator set a vault UTXO |
|| PPLNS/payout sweep | [HOTOVO — REPO] | Difficulty weighting, persist/restore, maturity | Retry-limit alerting a fee-drain gapy |
|| L5/L6 | [HOTOVO — HISTORICKY] | Passive read-only fund trackers: L5 8095, L6 8097 | Ověřit, že žádný tracker nemá disbursement pravomoc |
|| Backup script | [HOTOVO — REPO] | SQLite `.backup`, DB/state/config/systemd/nginx, retention 14/4 | Skutečná poslední záloha |
|| Off-site sync | [OVĚŘIT LIVE] | Edge `/opt/zion/backups` → lokální `~/2.9.6-main/backups/edge` | Cílovou cestu, SSH, timer a obnovu |
|| Backup/DR drill | [PENDING] | Roadmap F5 vyžaduje obnovu z off-site zálohy | Provést obnovu do izolovaného prostoru |
|| 24h transaction fuzz | [PENDING] | 10min preview prošel; plný 24h důkaz není uzavřený | Restartovat/dokončit test |
|| 30-day continuous run | [PENDING] | G8/F6 běží od 2026-08-23, cíl 2026-09-22 | Neoznačovat stable před dokončením |
|| External security audit | [PENDING] | G9 je plánovaný, formální externí audit není uzavřený | Objednat audit L1/L2/bridge |
|| Release readiness | [PENDING] | Tagy/CI/release assety stále pending | Ověřit podepsaný tag, SHA256SUMS |
|| OASIS web | [HOTOVO — OČEKÁVANÝ STAV] | Statický nginx export v `/var/www/oasis/` | Předat nginx config a build artefakty |
|| RPC/pool bind | [BLOKÁTOR] | Node RPC `127.0.0.1:9445`, pool API `127.0.0.1:8080` | Live `ss`, nginx config, firewall |

### 6.1 Známé otevřené roadmap body

- [PENDING] G8/F6 — 30denní nepřetržitý provoz (do 2026-09-22).
- [PENDING] F2 — úplný 24hodinový transaction fuzz důkaz.
- [PENDING] F5 — obnova z off-site zálohy.
- [PENDING] G9/F1 — externí bezpečnostní audit.
- [PENDING] I1 — formální veřejný OpenAPI dokument ZIS.
- [PENDING] J1–J7 — plná cross-app integrace webu, marketplace, OASIS, dashboardu.
- [PENDING] E3 — live real-data profit-router workflow.
- [PENDING] Payout operational gaps — retry-limit alerting a fee-drain endpoint.

---

## 7. Edge, služby a síťová matice

### 7.1 Aktuální referenční topologie

- [OVĚŘIT LIVE] Edge Contabo: `62.171.141.136`; hostname `vmi3425821.contaboserver.net`; IPv6 `2a02:c207:2342:5821::1`.
- [OVĚŘIT LIVE] V31 node1: P2P `8335`, RPC `127.0.0.1:9445`.
- [OVĚŘIT LIVE] V31 node2: P2P `8336`, RPC `127.0.0.1:9446`.
- [OVĚŘIT LIVE] V31 node3: P2P `8337`, RPC `127.0.0.1:9447`.
- [OVĚŘIT LIVE] Pool: stratum `8444`, HTTP API `127.0.0.1:8080`.
- [OVĚŘIT LIVE] Multichain/WARP `8453`, DEX `8454`.
- [OVĚŘIT LIVE] DAO `8456`, OASIS `8094`, Free World `8095`, ZIS `8096`, Issobella `8097`.
- [OVĚŘIT LIVE] Dashboard `8766`, website `3000`, marketplace `3100`.
- [OVĚŘIT LIVE] RPC veřejně pouze přes schválený nginx proxy/allowlist; nikdy neotevírat node RPC přímo do internetu.
- [OVĚŘIT LIVE] P2P, SSH, nginx, fail2ban, UFW/nftables a operátorské IPv4/IPv6 allowlisty po předání.

### 7.2 Služby k převzetí

- [ ] `zion-v31-node`
- [ ] `zion-v31-node2`
- [ ] `zion-v31-node3`
- [ ] `zion-v31-pool`
- [ ] `zion-v31-miner`
- [ ] `zion-v31-multichain`
- [ ] `zion-v31-dao`
- [ ] `zion-v31-oasis`
- [ ] `zion-v31-free-world`
- [ ] `zion-v31-issobella`
- [ ] `zion-zis`
- [ ] `zion-edge-python-dashboard`
- [ ] `zion-website`
- [ ] `zion-marketplace`
- [ ] `zion-edge-agent`
- [ ] `zion-v31-watchdog.service` + `zion-v31-watchdog.timer`
- [ ] `zion-edge-backup.service` + `zion-edge-backup.timer`
- [ ] `zion-edge-maintenance.service` + `zion-edge-maintenance.timer`
- [ ] nginx, fail2ban, journald/rsyslog/logrotate, off-site sync timer
- [EXPECTED] `zion-oasis-web` není systemd služba; předat statický nginx `/var/www/oasis/`.
- [EXPECTED] Staré `zion-edge-*` a V3 služby zůstávají disabled/masked pouze pokud je to potvrzené inventářem.

---

## 8. Domény, účty a recovery

|| Aktivum | Provider / účet | Stav |
||---------|------------------|------|
|| `zionterranova.com` | __________________ | [ ] |
|| `app.zionterranova.com` | __________________ | [ ] |
|| `oasis.zionterranova.com` | __________________ | [ ] |
|| `market.zionterranova.com` | __________________ | [ ] |
|| `auth.zionterranova.com` | __________________ | [ ] |
|| `rpc.zionterranova.com` | __________________ | [ ] |
|| `dashboard.zionterranova.com` | __________________ | [ ] |
|| `newearth.cz` | __________________ | [ ] |
|| DNS/Cloudflare | __________________ | [ ] |
|| GitHub account/org/repos | __________________ | [ ] |
|| Google Workspace/OAuth | __________________ | [ ] |
|| Emailové schránky | __________________ | [ ] |
|| X/Telegram/YouTube/Discord/Instagram | __________________ | [ ] |
|| Contabo/hosting/AWS | __________________ | [ ] |
|| SimpleMining/SMOS | __________________ | [ ] |
|| Mailchimp/Sumsub/monitoring | __________________ | [ ] |
|| 1Password / trezor | __________________ | [ ] |

- [PENDING] Převést recovery email a 2FA na bezpečnou rodinnou strukturu.
- [PENDING] Vytvořit oddělený účet Eriky; nepředávat hlavní osobní účet Yosefa jako jediný způsob přístupu.
- [PENDING] Po akceptaci předání revokovat staré deploy keys, sessions, tokens a recovery codes.
- [PENDING] Ověřit, že všechny účty jsou vedené na správný subjekt: Yosef, Erika, nebo `OMNITY.ONE s.r.o.`.

---

## 9. Bezpečný postup předání

1. [ ] Zmrazit inventář: commit/hash repa, genesis hash, seznam adres, služby, domény, účty a poslední záloha.
2. [ ] Zkontrolovat, že v inventáři není žádný secret.
3. [ ] Vytisknout a podepsat darovací listinu + plnou moc; svědci pouze potvrzují podpis.
4. [ ] Předat Erice sealed/šifrovaný balíček s klíči podle samostatného inventáře.
5. [ ] Erika samostatně ověří přístup na testovací účet, Edge, GitHub a doménu bez použití produkčního secretu v chatu.
6. [ ] Provést kontrolovaný recovery test ze zálohy v izolovaném prostředí.
7. [ ] Teprve po právním potvrzení změnit signery, recovery kontakty, vlastníky účtů a případně on-chain governance.
8. [ ] Po každé změně uložit datum, TX ID / audit log / provider confirmation mimo veřejné repo.
9. [ ] Aktualizovat veřejné právní dokumenty až po dokončení právního převodu a copyright auditu.

---

## 10. Podpisové potvrzení

|| Položka | Údaj |
||---------|------|
|| Yosef Hubálek — podpis předávajícího / dárce | __________________________ |
|| Erika Imlaufová — potvrzení přijetí správy (Trustee) | __________________________ |
|| Petra Tkácová — potvrzení přijetí náhradnictví | __________________________ |
|| Datum podpisu | __________________________ |
|| Místo uložení originálu (fyzický trezor) | __________________________ |

---

## 11. Přílohy a soubory v docs/private/

- `ZION_DAROVACI_LISTINA_A_PLNA_MOC.md` — hlavní markdown text listiny
- `ZION_SUCCESSION_DECLARATION.pdf` — čisté 2stránkové PDF k podpisu
- `ZION_SUCCESSION_AND_IP_TRANSFER_PLAN.md` — interní technický inventář
- `generate_succession_pdf.py` — generátor PDF

**Uložení:** celý adresář `docs/private/` je záměrně ignorovaný gitem. Po dokončení práce jej zkopírovat do šifrovaného trezoru a do rodinné úschovy; veřejný repozitář není záloha tohoto dokumentu.
