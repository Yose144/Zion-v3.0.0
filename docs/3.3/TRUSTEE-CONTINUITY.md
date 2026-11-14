# ZION — Provozní a kontinuitní manuál pro správkyni

> **DŮVĚRNÉ / INTERNAL — tento soubor NIKDY nepatří do veřejného repa `public/`
> ani do žádného exportu. Obsahuje popis, kde jsou klíče (nikdy ne hodnoty klíčů).**
>
> **Verze:** 1.0
> **Datum:** 2026-11-14
> **Určeno pro:** Erika Imlaufová (hlavní správkyně), Petra Tkácová (zástupkyně)
> **Sepsal:** Yosef Hubálek
> **Stav sítě při sepsání:** Mainnet Beta v3.2.0, výška chainu **123 773**, uzel 3.2.0, protokol 3.1.0-alpha

---

## Jak tento dokument číst

Tohle není technická dokumentace. Je to **návod k přežití** — co dělat, když Yosef nebude
moct projekt vést, ať už proto, že zemřel, nebo proto, že je dlouhodobě neschopný.

**Tři pravidla pro čtení:**

1. **Nečti to celé najednou.** V krizové situaci otevři „ČÁST 1 — Prvních 72 hodin"
   a jdi krok za krokem. Zbytek si přečti, až budeš mít klid.
2. **Nic, co je v tomto dokumentu napsané, není urgentní.** Síť běží sama. Pokud
   neuděláš nic tři dny, nestane se nic horšího, než že se zastaví výplaty minerům.
   To se dá dohnat. **Špatné rozhodnutí ve spěchu se dohnat nedá.**
3. **Když nerozumíš, zavolej Petrovi (ČÁST 4) nebo právníkovi.** Ne Google, ne
   ChatGPT, ne nějakému „odborníkovi na krypto" z internetu. Kontakty jsou v ČÁST 15.

**Co v tomto dokumentu NIKDY nenajdeš:** žádná mnemonic slova, žádné privátní klíče,
žádná hesla, žádné tokeny. Jen **kde** ty věci jsou a **kdo** k nim má přístup.
To je záměr. Kdyby tenhle dokument unikl, nesmí se z něj dát ukrást ani koruna.

**Kde dokument žije:**

- **Zdroj pravdy:** tento soubor v repu (`docs/3.3/TRUSTEE-CONTINUITY.md`)
- **Zapečetěná tištěná kopie:** u notáře / v trezoru / u právníka (rozhodne Yosef)
- **Kopie pro Petru:** samostatně, ne u tebe (aby jedna ztráta nezničila obě)

Tištěná kopie má na první stránce datum a podpis. Pokud je tištěná kopie starší než
6 měsíců, **je pravděpodobně neplatná** — vyžádej si novou.

---

## ČÁST 0 — Tři věty, které musíš vědět, než začneš

1. **Síť běží sama.** Dokud se načítá `app.zionterranova.com`, nic nehoří. Nemusíš
   nic „spouštět". Nemusíš nic „aktivovat". Nemusíš nic „přepínat".
2. **Ty nespravuješ techniku. Ty rozhoduješ a kontroluješ.** Jsi majitelka a
   strážkyně. Na mačkání tlačítek si najmeme operátora (ČÁST 4.5). To není slabost,
   to je správný způsob, jak takhle velký majetek spravovat.
3. **Nic neposílej, nic nemaž, nic nepřepisuj**, dokud nemáš (a) papír od právníka
   a (b) druhou osobu, která ti to potvrdí. Vždy dvě oči. Vždy.

---

## ČÁST 1 — Prvních 72 hodin

Tohle je jediná část, kterou v krizi potřebuješ. Je rozdělená na tři dny.
**Nepřeskakuj den 0.**

### Den 0 (prvních 24 hodin) — NIC NEDĚLEJ

Tvoje jediné úkoly:

- [ ] **Ověř, že situace je skutečná.** Úmrtní list, lékařská zpráva, potvrzení od
      rodiny. Bez papíru se tento dokument neaktivuje.
- [ ] **Zavolej Petře Tkácové.** Číslo je v ČÁST 15. Řekni jí přesně: „Aktivoval se
      plán ZION. Prosím tě, buď u toho se mnou." Petra má stejná práva jako ty —
      nejsi na to sama.
- [ ] **Zavolej právníkovi.** Číslo v ČÁST 15. Řekni mu, že se aktivuje plán
      nástupnictví, a pošli mu kopii darovací listiny a plné moci
      (`docs/private/ZION_DAROVACI_LISTINA_A_PLNA_MOC.md`).
- [ ] **Nedotýkej se serverů.** Ani se nepřihlašuj. Technika počká.
- [ ] **Najdi zapečetěnou obálku / tištěnou kopii** tohoto dokumentu a USB s klíči
      (viz ČÁST 5.1). Polož je na jedno místo, které zamkneš. Nic nekopíruj.

**Co v tento den NEDĚLÁŠ:** neposíláš peníze, neměníš hesla, nevoláš na technickou
podporu hostingu, nepíšeš na sociální sítě, neodpovídáš novinářům, neinstaluješ nic
na počítač. Všechno počká 24 hodin.

**Proč:** první den po úmrtí je člověk v šoku. V šoku se dělají chyby, které se nedají
vrátit. Ztráta jednoho dne nic neznamená — síť běží dál.

### Den 1 (24–48 hodin) — Přečti si to

- [ ] **Přečti celý tento dokument** od začátku do konce. Klidně dvakrát.
- [ ] **Přečti ČÁST 2 — Co NIKDY nedělat.** Vytiskni si ji a nalep na zeď.
- [ ] **Projdi ČÁST 5 — Přístupy.** Zjistíš, co máš a co nemáš. Dnes budeš mít
      skoro nic — to je normální a je to největší riziko projektu. ČÁST 5.4 říká,
      co s tím.
- [ ] **Projdi ČÁST 13 — Blokátory.** Tabulka říká, co Yosef nestihl za života
      zařídit. Ty položky jsou dnes tvoje první úkoly.
- [ ] **Zapiš si stav.** Vezmi papír a napiš: datum, čas, co víš, co nevíš, komu
      jsi volala. Tento papír bude první stránka tvého deníku. Veď ho dál.

### Den 2 (48–72 hodin) — První kontrola

Teprve teď se podíváš, jestli síť žije. **Jen se podíváš. Nic neměníš.**

Otevři v prohlížeči tyto adresy (funguje na mobilu i na počítači):

| Co otevřít | Co máš vidět | Co to znamená |
|---|---|---|
| `https://app.zionterranova.com` | Načte se web ZION | Web běží ✅ |
| `https://explorer.zionterranova.com` | Seznam bloků, nahoře číslo | Chain běží ✅ |
| `https://pool.zionterranova.com` | Statistiky poolu | Pool běží ✅ |
| `https://app.zionterranova.com/api/health` | Text začínající `{"status":"ok"` | Všechny služby běží ✅ |

**Zapiš si do deníku číslo bloku z exploreru a datum/čas.** Toto číslo je „výška
chainu" (chain height). Když ho za hodinu otevřeš znovu, mělo by být **vyšší**
(o 1–60). Pokud se nezmění ani za 2 hodiny, chain se zastavil — jdi na ČÁST 7.4.

**Pokud se něco z výše uvedeného nenačte:** nepanikař. Jdi na ČÁST 7.3 (server
neodpovídá) a postupuj podle ní. Většina výpadků se spraví sama do 10 minut.

### Co uděláš po 72 hodinách

Do konce prvního týdne:

- [ ] **Rozhodni o operátorovi.** ČÁST 4.5 popisuje, jak ho vybrat a jak ho
      zkontrolovat. Do té doby se ničeho nedotýkej.
- [ ] **Zkontroluj, že běží zálohy.** ČÁST 6.3, měsíční kontrola.
- [ ] **Napiš Petrovi, právníkovi a sobě zápis** o tom, co se stalo a co jsi udělala.
- [ ] **Nic neprodávej, nic nepřeváděj, nic neslibuj.** Prvních 90 dní je
      „ochranná lhůta" — viz ČÁST 9.1.

---

## ČÁST 2 — Co NIKDY nedělat

Tohle je nejdůležitější část celého dokumentu. Vytiskni si ji.

### 2.1 Peníze

- **NIKDY nepošli ZION z žádné peněženky, kterou jsi sama neověřila** podle ČÁST 9.3.
  Špatná adresa = peníze jsou nenávratně pryč. Neexistuje „zpět".
- **NIKDY nezadávej mnemonic (12 nebo 24 slov) do žádného webu, chatu, e-mailu,
  aplikace ani „peněženky", kterou ti někdo doporučil.** Mnemonic se zadává jen do
  oficiální peněženky, kterou ti předal Yosef, a jen na počítači, který není
  připojený k internetu (nebo po konzultaci s operátorem).
- **NIKDY neposílej peníze „na ověření", „na test", „na odemčení" nebo protože ti
  někdo napsal, že je to potřeba.** To je vždy podvod. Vždy.
- **NIKDY nereaguj na e-maily a zprávy, které tvrdí, že jsou od Yosefa, od podpory
  ZION, od banky nebo od „blockchain týmu"** a chtějí klíče, hesla nebo platbu.
  Yosef tímto způsobem nikdy nekomunikuje.
- **NIKDY nepřesouvej premine (16,78 miliardy ZION)** bez tří admin podpisů
  (Rama / Sita / Hanuman) a bez DAO. Viz ČÁST 9.4.

### 2.2 Technika

- **NIKDY nespouštěj `rm -rf`** (ani žádný příkaz začínající `rm`), pokud ti to
  výslovně nepoví operátor **a** Petra **a** máš čerstvou zálohu. Smazání se nedá vrátit.
- **NIKDY nemaž `/opt/zion/backups`** ani nic v něm. Jsou to zálohy chainu a databází.
- **NIKDY neaktualizuj systém** (`apt upgrade`, `apt dist-upgrade`) na serveru, kde
  běží produkce, bez operátora a bez naplánovaného okna.
- **NIKDY nerebootuj server** „jen tak pro jistotu". Reboot bez důvodu je riziko.
- **NIKDY nepromuj pool HA** (přepnutí na záložní server), dokud je primární server
  živý. Hrozí dvojí výplata minerům. Viz ČÁST 7.6.
- **NIKDY neměň DNS záznamy** bez 48hodinového čekání a bez druhého člověka.
  Špatná DNS změna shodí celý web pro všechny.
- **NIKDY nespouštěj `git push --force`** ani nic, co přepisuje historii repa.
- **NIKDY „neuklízej" soubory na serveru**, které neznáš. Většina z nich je potřeba.

### 2.3 Lidé a papíry

- **NIKDY nedávej SSH přístup, heslo ani klíč někomu, kdo nemá podepsanou smlouvu
  a NDA** (viz ČÁST 4.5). Každý operátor má **vlastní** klíč — nikdy se klíče nesdílí.
- **NIKDY nepodepisuj dokument, kterému nerozumíš.** Pošli ho právníkovi. Vždy.
- **NIKDY nejednej sama v prvních 90 dnech** ve věcech, které se týkají peněz,
  vlastnictví, nebo změny sítě. Vždy Petra + právník.
- **NIKDY neříkej nikomu, kolik ZION máš.** Ani rodině, ani novinářům, ani
  „investorům". Čísla jsou veřejná na blockchainu, ale tvoje identita s nimi spojená
  být nemusí.

### 2.4 Veřejná prezentace

- **NIKDY neměň veřejné texty o „lodi Království srdce"** (`/terranova/kralovstvi-srdce`)
  ani status `vision` v `ARCHA-NOEMOVA.md`. Ty texty jsou záměrně psané jako vize,
  ne jako slib. Změna by z nich udělala právní závazek.
- **NIKDY neslibuj veřejně termíny, ceny ani funkce**, které ještě neexistují.
- **NIKDY nepublikuj nic z `docs/private/`** — to jsou právní a rodinné dokumenty.

---

## ČÁST 3 — Mapa světa pro ne-technika

Tohle je „kde co je". Nemusíš to umět obsluhovat. Musíš vědět, co existuje,
aby ses mohla správně rozhodnout a správně se zeptat.

### 3.1 Co je ZION

ZION je **vlastní blockchain** — síť počítačů, které si navzájem potvrzují
transakce. Není to banka, není to firma, není to token na cizím blockchainu.
Je to samostatná síť s vlastní měnou (ZION), vlastními pravidly a vlastními servery.

**Tři vrstvy, které musíš znát:**

| Vrstva | Co to je | Kdo to vidí |
|---|---|---|
| **Chain (L1)** | Samotná síť. Počítače (nody) si předávají bloky. | Nikdo přímo — jen přes explorer |
| **Pool** | Služba, která sdružuje minery a vyplácí jim ZION | `pool.zionterranova.com` |
| **Weby a aplikace** | To, co vidí lidé — e-shop, OASIS, archiv, hry | `app.`, `market.`, `oasis.` atd. |

**Když řekneme „síť běží", znamená to:** chain roste (přibývají bloky) **a** weby
se načítají. Když jedna z těch věcí nejde, je to výpadek, ne konec.

### 3.2 Dva servery

Celý projekt běží na **dvou pronajatých serverech** (VPS) u firmy Contabo.
Nejsou to fyzické počítače v nějaké místnosti — jsou to virtuální servery v datacentru.

| Jméno | IP adresa | Co na něm běží | Lidsky |
|---|---|---|---|
| **EDGE2** | `207.180.217.100` | Hlavní web, e-shop, přihlašování, hlavní node chainu, databáze | „Hlavní server" |
| **EDGE** | `62.171.141.136` | Těžební pool, záložní nody, monitoring, dashboard | „Těžařský server" |

**Proč dva:** kdyby jeden spadl, druhý drží data a je z čeho obnovit. Není to
automatické přepnutí — je to „máme druhou kopii a víme, jak ji zapnout".

**Důležité:** EDGE2 je **jediný zdroj pravdy** pro chain. EDGE má jen záložní
kopie (followery), které se synchronizují z EDGE2. Když se rozbijí, nic se neděje
— dají se kdykoli znovu stáhnout z EDGE2.

### 3.3 Co je kde (rychlý přehled)

**Na EDGE2 (hlavní server):**

| Služba | Co dělá | Adresa pro lidi |
|---|---|---|
| `zion-v31-node` | Hlavní node chainu (RPC 9445, P2P 8335) | `rpc.zionterranova.com` |
| `zion-website` | Hlavní web | `app.zionterranova.com` |
| `zion-marketplace` | E-shop | `market.zionterranova.com` |
| `zion-zis` | Přihlašování / identity | `auth.zionterranova.com` |
| `zion-v31-oasis` | OASIS API (avatary, questy) | `oasis.zionterranova.com` |
| `zion-v31-free-world` | L5 světy (humanitární tithe) | interní |
| `zion-v31-dao` | DAO (hlasování, treasury) | interní :8456 |
| `zion-v31-multichain` | WARP (bridge, swapy) | `dex.zionterranova.com` |
| `postgresql` | Databáze (e-shop, identity) | interní :5432 |
| `nginx` | Rozděluje provoz na správné služby | vše veřejné |

**Na EDGE (těžařský server):**

| Služba | Co dělá | Adresa pro lidi |
|---|---|---|
| `zion-v31-pool` | Těžební pool (stratum 8444/8445, API 8080) | `pool.zionterranova.com` |
| `zion-v31-node` (2×) | Záložní nody (9446, 9447) | interní |
| `prometheus` | Sběr metrik | interní :9090 |
| `alertmanager` | Rozesílání alarmů | interní :9093 |
| `grafana` | Grafy | `grafana.zionterranova.com` |
| `dashboard` | Provozní přehled | `dashboard.zionterranova.com` |
| `zion-fallback-miner` | Záchranný miner (drží chain živý) | interní |

### 3.4 Domény

Domény jsou koupené u **Webglobe** (český registrátor). DNS záznamy ukazují,
která doména patří kterému serveru.

**Seznam domén:** `zionterranova.com` (hlavní), `app.`, `market.`, `oasis.`,
`auth.`, `pool.`, `rpc.`, `explorer.`, `nirvana.`, `kingdom.`, `dashboard.`,
`grafana.`, `dex.`, `freeworld.`, `api.`, `seed.`, `stratum.`, `www.`

**Kdo má přístup k DNS dnes:** jen Yosef. **To je blokátor** — viz ČÁST 13.

### 3.5 Peněženky (bez hodnot klíčů)

V projektu jsou **tři peněženky**, které musíš znát jménem a adresou. Klíče k nim
jsou na serveru v souborech — **nikdy je nekopíruj do počítače ani do chatu.**

| Peněženka | Adresa | K čemu | Kde je klíč |
|---|---|---|---|
| **Pool payout** | `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6` | Vyplácí minery | `/etc/zion/MarketPlace/pool-wallet.json` na EDGE2 |
| **Shop vault** | `zion1f3y5j0l4p0m4g7g525a3g2z5u7a4m2q0t2pn0t0` | Přijímá platby z e-shopu | `/etc/zion/MarketPlace/shop-vault.json` na EDGE2 |
| **Trustee** | `zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5` | Rezerva / zásoba | `/etc/zion/trustee-wallet.json` na EDGE2 |

**Premine (16,78 miliardy ZION)** je rozdělený do **14 slotů** a všechny jsou
uzamčené (`admin_locked`). Odemykají se postupně podle výšky chainu. **Nedotýkej
se jich** — viz ČÁST 9.4.

### 3.6 Co je „výška chainu" a proč je důležitá

Každý blok má pořadové číslo. Říká se mu **výška** (height). Když je výška
123 773, znamená to, že od začátku sítě vzniklo 123 773 bloků.

**Blok vzniká přibližně každých 60 sekund.** Pokud se výška za hodinu nezmění,
síť se zastavila. To je nejdůležitější číslo, které kdy budeš kontrolovat.

**Kde ho najdeš:**

- `https://explorer.zionterranova.com` — nahoře velké číslo
- `https://app.zionterranova.com/api/health` — v textu `"height":123773`
- Nebo se zeptej operátora

### 3.7 „Loď Království srdce" — vize, ne majetek

**Tohle musíš vědět, protože se na to může někdo zeptat.**

Na webu `/terranova/kralovstvi-srdce` a v `docs/3.3/ARCHA-NOEMOVA.md` je
popsaná **„loď Království srdce"** jako 13. uzel L5. Je to **vize a příběh**,
ne fyzická loď, ne postavený objekt, ne závazek.

**Co to znamená pro tebe:**

- **Nikdy neříkej, že loď existuje.** Řekni: „Je to vize, která je součástí
  příběhu projektu. Fyzická loď neexistuje."
- **Nikdy neslibuj termín, cenu ani stavbu.** To by z vize udělalo právní
  závazek.
- **Neměň ty texty** bez výslovného pokynu. Status `vision` v
  `ARCHA-NOEMOVA.md` zůstává `vision`.
- Pokud se někdo ptá „kdy bude loď?", odpověz: „To není rozhodnuté. Projekt
  dnes běží na serverech, ne na lodi."

**Interní realita (pro tvé rozhodování, ne pro veřejnost):** v `docs/3.3/ARCHA-ZACHRANNA-MISE.md`
je popsaná záchranná mise — co by loď musela umět, aby zachránila děti při
regionální katastrofě. To je **interní analýza**, ne veřejný slib. Minimální
kritérium úspěchu je **záchrana dětí**, ne pohodlí dospělých. Pokud by někdy
došlo k rozhodování o stavbě, postupuj podle této analýzy a vždy s právníkem.

### 3.8 Co je „pool" a proč je důležitý

Pool je služba, do které se připojují **mineři** (lidé s grafickými kartami), aby
společně hledali bloky a rozdělili se o odměnu. Pool jim za to posílá ZION.

**Když pool nevyplácí**, mineři odejdou. Když mineři odejdou, síť zpomalí.
Proto je pool druhá nejdůležitější věc po chainu.

**Kde to zkontroluješ:** `https://pool.zionterranova.com` — hledej „miners online"
a „poslední výplata". Pokud je poslední výplata starší než 2 hodiny, jdi na ČÁST 7.5.

---

## ČÁST 4 — Lidé a role

### 4.1 Ty — Erika Imlaufová

**Role:** majitelka / hlavní správkyně / strážkyně klíčů.

**Co rozhoduješ ty:**

- Co se stane s projektem (pokračovat, utlumit, prodat, darovat)
- Kdo dostane přístup
- Kam jdou peníze (v mezích ČÁST 9)
- Kdy se něco vypne

**Co NEROZHODUJEŠ sama:**

- Přesun premine (potřebuje 3 admin podpisy + DAO)
- Změnu admin/guardian sady
- Změnu genesis nebo konsensu
- Prodej domén nebo firmy (potřebuje právníka)

**Co máš dnes:** přístup do repa (čtení) a USB s premine klíči.
**Co nemáš:** SSH, GitHub účet, Contabo, DNS, password manager, e-mail.
**To je největší riziko projektu.** ČÁST 5.4 říká, co s tím.

### 4.2 Petra Tkácová — zástupkyně

**Role:** druhá správkyně. Má **stejná práva jako ty**, ale jen když ty nemůžeš
(nebo když jste obě aktivované současně).

**Kdy nastupuje:**

- Ty jsi nedostupná (nemoc, úraz, smrt)
- Ty se rozhodneš, že chceš, aby něco udělala ona
- Ty i Petra se dohodnete, že je potřeba rozhodnout společně

**Kde je to napsané:** `docs/private/ZION_DAROVACI_LISTINA_A_PLNA_MOC.md`

**Co musíš udělat hned:** zavolat jí (ČÁST 1, Den 0). Tento dokument nefunguje,
když jsi na to sama.

### 4.3 Právník

**Role:** radí ve věcech firmy, dědictví, smluv a daní.

**Co od něj potřebuješ:**

- Ověřit, že darovací listina a plná moc jsou platné
- Poradit s převodem vlastnictví (pokud bude potřeba)
- Zkontrolovat každou smlouvu s operátorem
- Řešit případné právní útoky (ČÁST 7.8)

**Kontakt:** `<<DOPLNIT: jméno, firma, telefon, e-mail>>`

### 4.4 Aelan

**Role:** `<<DOPLNIT: kdo je Aelan, jaká je jeho/její role, kontakt>>`

*Poznámka: v `docs/private/` je fotografie `aelan_vaast.jpg`. Pokud Aelan hraje
roli v nástupnictví nebo v komunikaci s veřejností, musí to být zde popsané.
Dokud to není doplněné, ber Aelana jako „člověka, kterého Yosef znal", ne jako
někoho s rozhodovací pravomocí.*

### 4.5 Operátor — člověk na techniku

**Tohle je nejdůležitější role, kterou musíš vytvořit.** Dnes neexistuje.

**Proč:** Ty nejsi sysadmin a nemáš být. Ale někdo musí umět restartovat server,
obnovit ze zálohy a opravit pool. Tomu člověku se říká **operátor**.

**Co operátor dělá:**

- Restartuje služby, když spadnou
- Kontroluje zálohy a dělá testovací obnovu
- Sleduje alarmy
- Opravuje drobné technické problémy
- Píše ti krátkou zprávu, co udělal

**Co operátor NIKDY nedělá:**

- Nemá přístup k privátním klíčům ani mnemonic
- Nemá přístup k peněženkám (jen ke čtení adres)
- Nemění DNS
- Nepodepisuje nic za tebe
- Nepřesouvá peníze

**Jak operátora vybrat (postup):**

1. **Sežeň 3 kandidáty.** Doporučení od lidí, které znáš. Ne z internetu.
2. **Pošli jim tento dokument** (bez ČÁST 15 — kontakty). Ať ho přečtou a řeknou,
   co by dělali v situaci X.
3. **Zkontroluj reference.** Zavolej dvěma lidem, pro které pracovali.
4. **Podepiš smlouvu + NDA.** Smlouva musí říkat: co smí, co nesmí, jaká je
   odpovědnost, jak se ukončuje. Právník to zkontroluje.
5. **Vytvoř jim vlastní SSH klíč.** Nikdy nedávej svůj. Nikdy nedávej heslo.
   Operátor si vygeneruje klíč, pošle ti veřejnou část, ty ji povolíš.
6. **Zkušební období 30 dní.** První měsíc jen čte a hlásí. Nemění nic.
7. **Zapiš do deníku**, kdy nastoupil, co má, co udělal.

**Jak operátora kontrolovat (bez toho, aby ti lhal):**

Operátor ti může říct „vše je v pořádku", i když není. Proto **vždycky kontroluj
sama z prohlížeče** — čtyři adresy z ČÁST 6.1. Ty fungují bez ohledu na to, co
operátor říká.

Navíc:

- Požaduj **screenshot** z `journalctl` (výpis logu), ne jen tvrzení
- Požaduj, aby ti ukázal **číslo výšky chainu** před a po zásahu
- Když něco mění, ať to nejdřív napíše do deníku a ty to odsouhlasíš
- **Druhý názor:** když operátor řekne „je potřeba přesunout peníze", zavolej
  Petrovi a právníkovi. Vždy.

**Kolik to stojí:** `<<DOPLNIT: orientační cena za hodinu / měsíc>>`

### 4.6 L5 správci (správci komunitních projektů)

**Role:** každý z 6 L5 projektů má svého správce, který rozhoduje o rozdělení
3,3 miliardy ZION v rámci svého projektu.

**Co to znamená pro tebe:** ty nejsi správce L5 projektů. Ty jen dohlížíš, že
rozdělení odpovídá pravidlům (viz `docs/private/ZION_SUCCESSION_AND_IP_TRANSFER_PLAN.md`
§3.2). L5 scanner je **read-only** — nemůže sám utrácet.

### 4.7 DAO guardians (7 lidí, 5-of-7)

**Role:** hlasují o změnách v DAO (treasury, parametry). Je jich 7, k rozhodnutí
jich je potřeba 5.

**Co to znamená pro tebe:** pokud chceš něco změnit v DAO, potřebuješ 5 z 7
guardianů. Ty nejsi guardian. **Nemůžeš DAO ovládat sama** — a to je záměr.

### 4.8 Admin 3-of-3 (Rama / Sita / Hanuman)

**Role:** tři klíče, které dohromady odemykají premine a správu sítě. Všechny tři
musí být použity současně. Jeden nestačí.

**Kde jsou:** `<<DOPLNIT: kde jsou fyzicky uložené — trezor, bankovní schránka,
notář, USB>>`

**Co to znamená pro tebe:** **nikdy** nebudeš mít moc sama přesunout premine.
To je správně. Když ti někdo řekne „potřebujeme všechny tři klíče", je to buď
legitimní operace podle checklistu, nebo podvod. Vždycky se ptej proč.

### 4.9 Rodina

**Role:** `<<DOPLNIT: kdo je v rodině, kdo má být informovaný, kdo nemá>>`

**Pravidlo:** rodina má právo vědět, že projekt existuje a že ty ho spravuješ.
Nemá právo vědět částky, klíče ani podrobnosti. Pokud se někdo z rodiny začne
ptát na klíče, je to signál, že se něco děje — zavolej právníkovi.

---

## ČÁST 5 — Přístupy: co máš, co nemáš, co musíš získat

Tohle je nejdůležitější praktická část. Bez přístupů nejsi správkyně, jsi
jen člověk se seznamem hesel, která nemá.

### 5.1 Co máš dnes (2026-11-14)

| Přístup | Stav | Kde to je | Co s tím můžeš dělat |
|---|---|---|---|
| **Repo (čtení)** | ✅ máš | GitHub `Yose144/Zion-v3.0.0` (privátní) | Číst kód, dokumenty, runbooky |
| **USB s premine klíči** | ✅ máš | `<<DOPLNIT: kde fyzicky>>` | Držet v bezpečí. **Nepřipojovat k internetu.** |
| **Tištěná kopie tohoto dokumentu** | `<<DOPLNIT>>` | zapečetěná obálka | Číst v krizi |

### 5.2 Co musíš získat (a jak)

Tohle je seznam věcí, které Yosef musí zařídit **za života**. Po jeho smrti
je získat mnohem těžší (někdy nemožné).

| Přístup | Proč ho potřebuješ | Jak ho získat | Stav |
|---|---|---|---|
| **SSH klíč na EDGE2 + EDGE** | Restartovat služby, obnovit ze zálohy | Yosef vygeneruje nový klíč, předá ti ho na USB, přidá veřejnou část na servery | `<<DOPLNIT>>` |
| **GitHub účet + přístup do repa** | Číst a měnit kód, vidět historii | Yosef tě přidá jako collaboratora | `<<DOPLNIT>>` |
| **Contabo účet** | Restartovat/rebuild serveru z konzole, platit hosting | Yosef přidá tvůj e-mail jako sub-account nebo předá přihlášení | `<<DOPLNIT>>` |
| **Webglobe (DNS)** | Měnit, kam domény ukazují | Yosef přidá tvůj e-mail jako správce | `<<DOPLNIT>>` |
| **Password manager** | Bezpečně sdílet hesla (ne v chatu) | Yosef vytvoří účet (Bitwarden/1Password) a předá ti master heslo | `<<DOPLNIT>>` |
| **E-mail na doméně** | Komunikace s providery, soudy, úřady | Yosef nastaví schránku `erika@zionterranova.com` nebo podobnou | `<<DOPLNIT>>` |
| **Bankovní přístup k Omnity.One** | Platit náklady, přijímat peníze | Yosef tě přidá do internetového bankovnictví | `<<DOPLNIT>>` |
| **Účetnictví Omnity.One** | Daně, faktury, přehled | Yosef tě přidá do účetního systému | `<<DOPLNIT>>` |

### 5.3 Co NIKDY nesdílet

- Privátní klíče peněženek (jsou na serveru, ne v tvém počítači)
- Mnemonic (12/24 slov)
- Admin klíče (Rama/Sita/Hanuman)
- Heslo k password manageru (jen v hlavě nebo v trezoru)
- SSH privátní klíč (nikdy nekopíruj, nikdy neposílej)

### 5.4 Dnešní kritické mezery

Tohle musíš vědět **hned**, protože to určuje, co v krizi dokážeš a co ne:

1. **Nemáš SSH klíč.** Bez něj nemůžeš restartovat server. Můžeš jen koukat
   z prohlížeče.
2. **Nemáš GitHub účet.** Nemůžeš vidět historii změn ani opravit kód.
3. **Nemáš Contabo ani DNS.** Nemůžeš obnovit server z konzole ani přesměrovat
   doménu.
4. **Nemáš password manager.** Nemáš kde bezpečně držet hesla.
5. **Nemáš e-mail na doméně.** Nemůžeš komunikovat jménem projektu.
6. **Zálohy jsou jen na Yosefově Macu.** `~/backups/edge/` na tomto počítači
   **neexistuje** — zálohy se tam nikdy nestáhly. To znamená, že dnes
   **neexistuje žádná záloha nezávislá na Yosefově počítači.** To je největší
   technické riziko projektu. Viz ČÁST 13, řádek 1.

**Co s tím:** tyhle mezery se nedají vyřešit v krizi. Musí je vyřešit Yosef
**teď**, dokud je živý a při síle. Tabulka v ČÁST 13 je tvůj seznam úkolů pro
něj — dej mu ji přečíst a trvej na tom, aby každý řádek měl datum a podpis.

---

## ČÁST 6 — Pravidelná kontrola

Kontrola není „něco dělat". Kontrola je **podívat se, jestli je vše v pořádku**.
Když je, nic neděláš. Když není, jdeš na ČÁST 7.

### 6.1 Týdenní kontrola (5 minut, z prohlížeče)

Jednou týdně, ideálně ve stejný den (např. pondělí ráno). Otevři čtyři adresy
a zapiš výsledek do deníku.

**1. Web**

Otevři `https://app.zionterranova.com`

- ✅ Vidíš web ZION
- ❌ Prázdná stránka, chyba, „502", „503" → ČÁST 7.3

**2. Chain (explorer)**

Otevři `https://explorer.zionterranova.com`

- ✅ Vidíš seznam bloků a nahoře číslo
- ❌ Nic se nenačte → ČÁST 7.3
- ⚠️ Číslo se za hodinu nezmění → ČÁST 7.4

**3. Pool**

Otevři `https://pool.zionterranova.com`

- ✅ Vidíš statistiky a „miners online" > 0
- ❌ Nic → ČÁST 7.5
- ⚠️ Poslední výplata starší než 2 hodiny → ČÁST 7.5

**4. Health API**

Otevři `https://app.zionterranova.com/api/health`

- ✅ Text začíná `{"status":"ok"` a obsahuje `"height":<číslo>`
- ❌ `"status":"degraded"` nebo chyba → ČÁST 7.3

**Do deníku napiš:** datum, výšku chainu, počet minerů, jestli vše OK.
Jeden řádek. Trvá to 30 sekund.

### 6.2 Měsíční kontrola (30 minut, s operátorem)

Jednou měsíčně, ideálně první týden v měsíci. **Tohle už potřebuje operátora** —
ty jen dohlížíš a zapisuješ.

Operátor ti ukáže (nebo pošle screenshot):

- [ ] **Disk na obou serverech** — `df -h /` musí být pod 80 %. Pokud je víc,
      je potřeba uklidit (operátor ví jak).
- [ ] **Paměť** — `free -h`, musí být aspoň 1 GB volné.
- [ ] **Služby** — `systemctl --failed`, nesmí být nic „failed".
- [ ] **Zálohy** — `ls -la /opt/zion/backups/` na EDGE, musí být soubory
      z posledních 24 hodin.
- [ ] **Postgres zálohy** — `ls -la /opt/zion/backups/pg/` na EDGE2, musí být
      soubory z posledních 7 dní.
- [ ] **Pool výplaty** — `curl -s http://127.0.0.1:8080/health` na EDGE,
      musí vrátit `{"ok":true`.
- [ ] **Certifikáty** — `certbot renew --dry-run` na EDGE2, musí projít bez chyby.
- [ ] **Peněženky** — viz ČÁST 9.2 (kontrola zůstatku).

**Ty si to zapíšeš do deníku a pošleš Petrovi krátkou zprávu:** „Měsíční kontrola
OK, výška X, disk Y %, zálohy Z." Pokud něco není OK, napiš to taky.

### 6.3 Čtvrtletní kontrola (2 hodiny, s operátorem a Petrou)

Jednou za tři měsíce. Cíl: **ověřit, že obnova funguje**, ne jen že zálohy existují.

- [ ] **Testovací obnova zálohy** — operátor vezme nejnovější zálohu databáze
      a zkusí ji obnovit na testovacím serveru (ne na produkci). Výsledek: funguje / nefunguje.
- [ ] **Kontrola přístupů** — kdo má SSH klíč? Kdo má GitHub? Kdo má Contabo?
      Zapsat do deníku. Kdokoli, kdo tam být nemá, se odstraní.
- [ ] **Kontrola klíčů** — jsou admin klíče (Rama/Sita/Hanuman) tam, kde mají být?
      (Jen zkontrolovat, že jsou — ne je používat.)
- [ ] **Kontrola dokumentů** — je tento dokument aktuální? Je tištěná kopie
      mladší 6 měsíců?
- [ ] **Kontrola smluv** — má operátor platnou smlouvu? NDA? Kdy končí?
- [ ] **Přečíst si ČÁST 13** — co z blokátorů se od minule vyřešilo?

**Výsledek čtvrtletní kontroly je vždycky jeden list papíru** s datem, podpisem
tvým a Petřiným, a seznamem „co je hotové / co není". Založ do desek.

### 6.4 Roční kontrola (půl dne)

Jednou ročně, ideálně v lednu:

- [ ] **Přečíst celý tento dokument** znovu, od začátku.
- [ ] **Aktualizovat ho** — co se změnilo (IP adresy, služby, lidé, ceny).
- [ ] **Nechat vytisknout a zapečetit novou kopii.**
- [ ] **Zkontrolovat, že Petra má aktuální kopii.**
- [ ] **Projít s právníkem**, jestli se nezměnil zákon nebo firma.
- [ ] **Zkontrolovat domény** — platí se? Neexpirují?
- [ ] **Zkontrolovat hosting** — platí se? Neexpiruje?
- [ ] **Zkontrolovat, že máš pořád všechny přístupy** z ČÁST 5.2.

---

## ČÁST 7 — Rozhodovací stromy pro situace

Každá situace má **tři fáze: zjistit → rozhodnout → udělat**. Nikdy nezačínej
„udělat". Vždycky nejdřív „zjistit".

### 7.1 Yosef zemřel (potvrzeno)

**Zjistit:**

- Máš úmrtní list? Bez něj se nic neděje.
- Ví o tom Petra? Právník? Rodina?

**Rozhodnout:**

- Aktivujeme plán? (Ano, pokud je úmrtní list.)
- Kdo bude operátor? (Musíš ho najít do 7 dnů.)
- Co s projektem? (Pokračovat / utlumit / prodat — rozhodnutí do 90 dnů.)

**Udělat (v tomto pořadí):**

1. Zavolat Petře (Den 0).
2. Zavolat právníkovi (Den 0).
3. Najít zapečetěnou kopii tohoto dokumentu a USB (Den 0).
4. Přečíst dokument (Den 1).
5. Zkontrolovat síť z prohlížeče (Den 2).
6. Najmout operátora (do 7 dnů).
7. Zapsat vše do deníku.

**Co NEDĚLAT:** neposílat peníze, neměnit DNS, neprodávat domény, neposkytovat
rozhovory, nepřesouvat premine.

### 7.2 Yosef je nezvěstný / v bezvědomí / dlouhodobě nemocný

**Zjistit:**

- Je potvrzená incapacita? (lékařská zpráva, soudní rozhodnutí)
- Jak dlouho to potrvá? (dny / týdny / měsíce / trvale)

**Rozhodnout:**

- Do 7 dnů: jen „udržovací režim" — platit hosting, kontrolovat síť, nic neměnit.
- Po 30 dnech: aktivovat plán jako při úmrtí (bez úmrtního listu, ale s lékařskou zprávou).
- Po 90 dnech: plný režim — najít operátora, rozhodnout o projektu.

**Udělat:**

1. Zavolat Petře a právníkovi.
2. Zajistit, že hosting a domény jsou zaplacené (viz ČÁST 11).
3. Kontrolovat síť týdně (ČÁST 6.1).
4. Nic neměnit, dokud se Yosef nevrátí nebo dokud neuplyne 90 dnů.

**Proč 90 dnů:** za 90 dnů se dá vrátit z mnoha nemocí. Předčasná aktivace
znamená zbytečné přesuny a rizika. Po 90 dnech je riziko, že se něco rozbije
a nebude to mít kdo opravit, větší než riziko předčasné aktivace.

### 7.3 Server neodpovídá (web nejde, ale chain možná běží)

**Zjistit (v tomto pořadí):**

1. Otevři `https://app.zionterranova.com` — jde?
2. Otevři `https://explorer.zionterranova.com` — jde?
3. Otevři `https://pool.zionterranova.com` — jde?
4. Otevři `https://app.zionterranova.com/api/health` — jde?

**Rozhodnout podle toho, co nejde:**

| Co nejde | Co to znamená | Kam jít |
|---|---|---|
| Nic nejde | Možná je problém u tebe (internet) | Zkus na mobilních datech |
| Jen app. | Web služba spadla | Restart `zion-website` (ČÁST 8.3) |
| Jen explorer | Explorer služba spadla | Restart exploreru (ČÁST 8.3) |
| Jen pool | Pool spadl | ČÁST 7.5 |
| Všechno kromě app. | Možná problémy s nginx | Restart nginx (ČÁST 8.3) |
| Health hlásí `degraded` | Něco je rozbité, ale běží | Zavolej operátora |

**Udělat:**

1. Počkej 10 minut. Většina výpadků se spraví sama.
2. Pokud ne, zavolej operátorovi.
3. Pokud operátor není, zkus restart podle ČÁST 8.3.
4. Zapiš do deníku.

**Co NEDĚLAT:** nerestartuj všechno najednou. Jeden restart, počkat 2 minuty,
zkontrolovat. Pak další.

### 7.4 Chain se zastavil (výška se nemění)

**Tohle je nejvážnější situace.** Chain je srdce projektu. Když se zastaví,
zastaví se všechno ostatní.

**Zjistit:**

- Jak dlouho se výška nemění? (10 min / 1 h / 6 h / 24 h)
- Kolik minerů je online? (`pool.zionterranova.com`)
- Co říká `api/health`? (`"height":<číslo>`, `"status"`)

**Rozhodnout:**

| Doba | Co to znamená | Co dělat |
|---|---|---|
| < 10 min | Normální (někdy blok trvá déle) | Nic |
| 10–60 min | Možná problém s minerem | Zkontroluj pool, zavolej operátora |
| 1–6 h | Vážné | Operátor musí zasáhnout (ČÁST 8.4) |
| > 6 h | Kritické | Operátor + ty + Petra + právník |

**Udělat:**

1. Zkontroluj, že na EDGE běží `zion-fallback-miner` (operátor).
2. Zkontroluj, že EDGE2 node běží (operátor).
3. Pokud miner neběží, operátor ho spustí — to obvykle chain rozjede.
4. Pokud to nepomůže, operátor zkontroluje, jestli se nody navzájem vidí.
5. Zapiš vše do deníku.

**Co NEDĚLAT:** nezasahuj do chainu sám. Neměň parametry. Nespouštěj
`--reset` ani nic podobného. Chain se dá rozjet, ale špatný zásah ho může
rozbít natrvalo.

### 7.5 Pool nevyplácí

**Zjistit:**

- Kdy byla poslední výplata? (`pool.zionterranova.com`)
- Kolik minerů je online?
- Jaký je zůstatek pool payout peněženky? (ČÁST 9.2)

**Rozhodnout:**

| Stav | Co to znamená | Co dělat |
|---|---|---|
| Poslední výplata < 2 h | Normální | Nic |
| 2–6 h | Možná fronta | Zavolej operátora |
| 6–24 h | Vážné | Operátor musí zasáhnout |
| > 24 h | Kritické | Operátor + ty rozhodnete, co dál |

**Nejčastější příčiny (a co s nimi):**

1. **Pool peněženka je fragmentovaná** — má příliš mnoho malých UTXO a nemůže
   poslat velkou částku. Řešení: konsolidace (operátor, ČÁST 8.5).
2. **Pool peněženka je prázdná** — došly peníze. Řešení: přesunout z trustee
   peněženky (ty + Petra + operátor).
3. **Node neodpovídá** — pool nemůže ověřit transakce. Řešení: restart node.
4. **Pool služba spadla** — restart.

**Co NEDĚLAT:** neposílej minerům peníze „ručně" z jiné peněženky. Nejdřív
zjistit příčinu, pak opravit.

### 7.6 Pool HA — přepnutí na záložní server

**Tohle NIKDY nedělej sama.** Je to nejrizikovější operace v celém projektu.

**Proč:** pokud přepneš na záložní pool, ale primární pool běží dál, **oba
mohou vyplatit stejné peníze dvakrát**. To je nevratná ztráta.

**Kdy se to dělá:**

- Primární server (EDGE) je **prokazatelně mrtvý** (nejde SSH, nejde ping,
  služba neběží) — ne jen „zpomalený".
- Operátor to potvrdí.
- Ty a Petra to odsouhlasíte.

**Postup (jen s operátorem):**

1. Operátor zastaví `zion-v31-pool` a `zion-v31-watchdog.timer` na EDGE.
2. Operátor ověří, že primární pool opravdu neběží.
3. Operátor spustí záložní pool na EDGE2.
4. Operátor zkontroluje, že záložní pool vyplácí.
5. Zapiš do deníku datum, čas, důvod.

**Runbook:** `docs/3.2/ops/POOL-HA-RUNBOOK.md`

**Co NEDĚLAT:** nepřepínej „pro jistotu". Nepřepínej, když si nejsi jistá.
Když si nejsi jistá, zavolej operátorovi a Petrovi.

### 7.7 Hack / únik klíčů

**Tohle je noční můra. Ale dá se přežít.**

**Zjistit:**

- Co uniklo? (heslo / SSH klíč / mnemonic / admin klíč)
- Odkud? (server / tvůj počítač / e-mail / chat)
- Kdy? (minuty / hodiny / dny)

**Rozhodnout:**

| Co uniklo | Závažnost | Co dělat |
|---|---|---|
| Heslo k webu | Nízká | Změnit heslo |
| SSH klíč | Střední | Zrušit klíč, vytvořit nový, zkontrolovat logy |
| Mnemonic peněženky | **Kritická** | Přesunout peníze na novou peněženku (okamžitě!) |
| Admin klíč | **Kritická** | Rotace admin sady (3-of-3 + DAO, 30 dnů) |

**Udělat (obecně):**

1. **Zastavit krvácení** — zrušit přístup, změnit heslo, vypnout službu.
2. **Zavolat operátorovi a Petrovi.**
3. **Zavolat právníkovi** (pokud jde o peníze nebo data zákazníků).
4. **Zapsat vše** — co, kdy, jak, kdo.
5. **Nepanikařit a neposílat peníze „na bezpečné místo"**, dokud nevíš, kam.
   Špatná adresa = druhá ztráta.

**Co NEDĚLAT:** nekomunikovat s útočníkem. Neplatit výkupné. Nepřiznávat
veřejně nic, dokud to neprobereš s právníkem.

### 7.8 Právní útok (žaloba, exekuce, kontrola)

**Zjistit:**

- Kdo útočí? (bývalý společník / zákazník / úřad / neznámý)
- Co chce? (peníze / data / vypnutí / vlastnictví)
- Má to papír? (žaloba, výzva, rozhodnutí)

**Rozhodnout:**

- **Nikdy nejednej bez právníka.** Ani odpovědět e-mailem.
- Pokud jde o peníze: zmrazit výdaje, dokud právník neřekne.
- Pokud jde o data: zkontrolovat, co se dá doložit.

**Udělat:**

1. Zavolat právníkovi (okamžitě).
2. Zkopírovat všechny dokumenty, e-maily, rozhodnutí.
3. Neodpovídat, nemazat, neměnit.
4. Zapsat do deníku.

### 7.9 Ukončení projektu (wind-down)

**Kdy:** rozhodneš se (s Petrou a právníkem), že projekt nemá pokračovat.

**Postup (postupný, ne náhlý):**

1. **Rozhodnutí** — ty + Petra + právník. Zapsat.
2. **Oznámení** — 90 dnů předem, na webu a e-mailem. Právník zkontroluje text.
3. **Ukončení výplat** — poslední výplata minerům, oznámit.
4. **Převod zůstatků** — kam? (charita / rodina / držitelé) — rozhodne právník.
5. **Vypnutí služeb** — postupně, jedna po druhé.
6. **Zrušení domén a hostingu** — až na konci.
7. **Archivace** — zazálohovat vše, co má hodnotu (kód, dokumenty, data).
8. **Zápis** — co, kdy, proč.

**Co NEDĚLAT:** nevypínej všechno naráz. Nemaž data. Nezruš domény před
archivací. Nezapomeň na zákazníky (mají právo vědět).

### 7.10 Ty nemůžeš (nemoc, úraz, smrt)

**Tohle je důvod, proč existuje Petra.**

**Petra udělá:**

1. Ověří, že ty nemůžeš (stejně jako ty ověřuješ Yosefa).
2. Aktivuje tento dokument (stejné kroky jako ČÁST 1).
3. Zavolá právníkovi.
4. Najde zapečetěnou kopii (u notáře / v trezoru).
5. Pokračuje podle ČÁST 1.

**Co musíš udělat ty, dokud můžeš:**

- [ ] Říct Petře, kde je tento dokument a USB.
- [ ] Říct Petře, kdo je právník a operátor.
- [ ] Říct Petře, kde jsou admin klíče.
- [ ] Zapsat to do deníku a podepsat s Petrou.

**Pokud Petra nemůže:** `<<DOPLNIT: kdo je třetí v pořadí>>`

---

## ČÁST 8 — Obnova sítě (skutečné příkazy)

**Tuhle část čti jen tehdy, když máš operátora, nebo když ti to výslovně
řekne operátor.** Příkazy vypadají jednoduše, ale špatné použití může
projekt poškodit.

**Jak číst příkazy:** řádky začínající `$` jsou to, co napíšeš. Řádky bez `$`
jsou to, co uvidíš. Nikdy nekopíruj `$`.

### 8.1 Přihlášení na server

**Potřebuješ:** SSH klíč (`~/.ssh/zion-edge-post-wipe-2026-07-29`), terminál.

**Na EDGE2 (hlavní server):**

```
$ ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 root@207.180.217.100
```

Uvidíš:
```
Welcome to Ubuntu 24.04...
root@vmi3684458:~#
```

**Na EDGE (těžařský server):**

```
$ ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@62.171.141.136
```

Uvidíš:
```
Welcome to Ubuntu 24.04...
root@vmi3425821:~#
```

**Když to nefunguje:**

- `Permission denied` → klíč není správný, nebo není povolený. Zavolej operátorovi.
- `Connection refused` → server je dole, nebo tě blokuje firewall. Zkus IPv6:
  `ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 -6 root@2a02:c207:2342:5821::1`
- `Connection timed out` → server neodpovídá. Zavolej Contabo podporu.

**Jak se odhlásit:** napiš `exit` a Enter.

### 8.2 Kontrola, že vše běží

**Na EDGE2:**

```
$ systemctl is-active zion-v31-node zion-website zion-marketplace zion-zis zion-v31-oasis zion-v31-dao zion-v31-multichain nginx
```

Uvidíš (každý řádek `active`):
```
active
active
active
...
```

Pokud je někde `inactive` nebo `failed`, ta služba neběží.

**Na EDGE:**

```
$ systemctl is-active zion-v31-pool zion-v31-node zion-fallback-miner prometheus alertmanager grafana-server
```

**Kontrola výšky chainu:**

```
$ curl -s -X POST http://127.0.0.1:9445/jsonrpc -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":[]}'
```

Uvidíš něco jako:
```
{"id":1,"jsonrpc":"2.0","result":{"chain_height":123773,...}}
```

**Kontrola poolu:**

```
$ curl -s http://127.0.0.1:8080/health
```

Uvidíš:
```
{"ok":true,...}
```

### 8.3 Restart služby (když spadla)

**Na EDGE2:**

```
$ systemctl restart zion-website
```

Počkej 10 sekund, pak zkontroluj:

```
$ systemctl status zion-website
```

Uvidíš `active (running)`.

**Stejný postup pro ostatní:**

| Co restartovat | Příkaz |
|---|---|
| Web | `systemctl restart zion-website` |
| E-shop | `systemctl restart zion-marketplace` |
| Přihlašování | `systemctl restart zion-zis` |
| Hlavní node | `systemctl restart zion-v31-node` |
| OASIS | `systemctl restart zion-v31-oasis` |
| DAO | `systemctl restart zion-v31-dao` |
| WARP | `systemctl restart zion-v31-multichain` |
| Nginx | `nginx -t && systemctl reload nginx` |

**Na EDGE:**

| Co restartovat | Příkaz |
|---|---|
| Pool | `systemctl restart zion-v31-pool` |
| Záložní node | `systemctl restart zion-v31-node` |
| Miner | `systemctl restart zion-fallback-miner` |

**Pravidlo:** jeden restart, počkat 2 minuty, zkontrolovat. Pak další.

### 8.4 Co dělat, když chain stojí

**Tohle dělej jen s operátorem.**

1. Zkontroluj, že node běží: `systemctl is-active zion-v31-node` na EDGE2.
2. Zkontroluj, že miner běží: `systemctl is-active zion-fallback-miner` na EDGE.
3. Zkontroluj výšku na všech nodech:
   ```
   $ curl -s -X POST http://127.0.0.1:9445/jsonrpc -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":[]}' | grep -o '"chain_height":[0-9]*'
   ```
   Na EDGE2 (9445) a na EDGE (9446, 9447). Čísla by měla být stejná nebo
   maximálně o 1–2 rozdílná.
4. Pokud se nody rozcházejí, operátor rozhodne, který je správný.
5. Pokud miner neběží, spusť ho: `systemctl start zion-fallback-miner`.
6. Počkej 5 minut, zkontroluj znovu.

**Co NEDĚLAT:** neresetuj chain. Nemaž databázi. Neměň `genesis`. To jsou
operace, které se dělají jen při plánovaném hard resetu, ne v krizi.

### 8.5 Konsolidace pool peněženky (když pool nevyplácí)

**Tohle je normální údržba, ne krizová operace.** Dělá se, když peněženka
má příliš mnoho malých UTXO a nemůže poslat velkou částku.

**Na EDGE:**

```
$ cd /opt/zion/data/v31
$ runuser -u zion -- /opt/zion/bin/zion wallet consolidate --wallet /etc/zion/MarketPlace/pool-wallet.json --rpc 127.0.0.1:9445 --rounds 8 --target-utxos 0
```

Uvidíš něco jako:
```
round 1: 177 inputs -> 1 output
round 2: ...
```

**Pozor:** každé kolo stojí malý poplatek (~0,02 ZION). 8 kol = ~0,2 ZION.
To je normální.

**Automaticky:** na EDGE2 běží `zion-wallet-consolidate.timer`, který to dělá
každých 6 hodin. Pokud neběží, operátor ho zapne.

### 8.6 Obnova ze zálohy (nejtěžší operace)

**Tohle nedělej sama. Tohle je práce pro operátora + tebe jako dohled.**

**Kdy:** server je mrtvý a nedá se opravit, nebo databáze je poškozená.

**Postup (zjednodušeně):**

1. **Zjistit, co je potřeba obnovit** — celý server, nebo jen databáze?
2. **Najít nejnovější zálohu** — `/opt/zion/backups/` na EDGE, nebo
   `/opt/zion/backups/pg/` na EDGE2.
3. **Zastavit služby**, které zálohu používají.
4. **Obnovit data** ze zálohy.
5. **Spustit služby.**
6. **Ověřit**, že vše běží (ČÁST 8.2).
7. **Zapsat do deníku** — co, kdy, z jaké zálohy.

**Runbooky:**

- `infra/RUNBOOK.md` — obecný
- `docs/3.2/ops/DR-BRINGUP-RUNBOOK.md` — obnova poolu
- `docs/3.2/HARD_RESET_PLAYBOOK.md` — úplný reset (jen před veřejným launchem!)

**Co NEDĚLAT:** neobnovuj zálohu na produkci, dokud nemáš druhou kopii
současného stavu. Neobnovuj „naslepo". Nezapomeň zastavit služby před obnovou.

---

## ČÁST 9 — Peníze: pravidla

### 9.1 Ochranná lhůta 90 dní

**Prvních 90 dní po aktivaci tohoto dokumentu neposílej žádné peníze** kromě:

- Platby hostingu (Contabo)
- Platby domén (Webglobe)
- Platby operátorovi (mzda)
- Platby právníkovi

**Proč:** 90 dní je čas na to, aby se situace uklidnila, aby se našel operátor,
aby právník ověřil dokumenty. Unáhlené přesuny peněz jsou nejčastější příčina
ztráty majetku v krizi.

### 9.2 Jak zkontrolovat zůstatek (bez posílání čehokoli)

**Z prohlížeče:**

Otevři `https://explorer.zionterranova.com` a do vyhledávání vlož adresu
peněženky. Uvidíš zůstatek a historii transakcí.

**Přes RPC (jen pro kontrolu):**

```
$ curl -s -X POST http://127.0.0.1:9445/jsonrpc -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getUtxos","params":{"address":"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6","limit":0}}'
```

Uvidíš:
```
{"result":{"address":"zion1d2k...","utxos":[],"count":0,"total_count":12345,"total_amount":"123456789012","model":"v31-native"}}
```

**`total_amount` je v „flowers"** (1 ZION = 1 000 000 flowers). Vyděl milionem
a máš ZION. `total_count` je počet UTXO.

**Pozor:** `getBalance` vrací **0** — to je známá vlastnost, ne chyba. Vždy
používej `getUtxos` s `limit: 0`.

### 9.3 Pravidla pro posílání peněz

**Tohle platí pro každou transakci, vždy, bez výjimky:**

1. **Dvě oči.** Nikdy neposílej sama. Vždy Petra nebo operátor jako druhý.
2. **Ověř adresu třikrát.** Zkopíruj, vlož, zkontroluj první 4 a poslední 4
   znaky. Pak znovu. Pak ještě jednou.
3. **Testovací částka.** Při nové adrese pošli nejdřív malou částku (např.
   1 ZION), počkej na potvrzení, pak zbytek.
4. **Zapiš do deníku.** Komu, kolik, kdy, proč, tx hash.
5. **Nikdy neposílej z peněženky, které nerozumíš.** Pokud nevíš, čí je,
   neposílej.
6. **Nikdy neposílej na adresu, kterou ti někdo poslal e-mailem nebo zprávou.**
   Vždy si ji ověř jiným kanálem (zavolej).
7. **Nikdy neposílej „na ověření".** To je vždy podvod.

### 9.4 Premine (16,78 miliardy ZION)

**Co to je:** peníze, které vznikly na začátku sítě. Jsou v 14 slotech,
všechny uzamčené (`admin_locked`). Odemykají se postupně.

**Kdo s nimi může hýbat:** jen **3-of-3 admin multsig** (Rama + Sita + Hanuman)
**a** DAO. Jeden člověk nestačí. Ty sama nikdy.

**Kdy se odemykají:** podle výšky chainu. Kolem výšky 144 000 se odemykají
sloty 6–8. Checklist: `docs/3.2/ops/PREMINE_144K_CHECKLIST.md`

**Co to znamená pro tebe:**

- **Nedotýkej se jich**, dokud nepřijde čas a dokud není hotový checklist.
- **Nikdy nedávej všechny tři klíče jednomu člověku.**
- **Nikdy nepřesouvej premine „na bezpečnější místo"** bez 3-of-3 a DAO.
- Pokud ti někdo řekne „potřebujeme odemknout premine", chce vidět checklist
  a chce to schválit právník.

### 9.5 Příjmy a výdaje

**Příjmy:**

- E-shop (market) — platby v ZION a korunách
- Pool fee — malá část z každé výplaty minerům
- `<<DOPLNIT: další příjmy>>`

**Výdaje (viz ČÁST 11):**

- Hosting (Contabo)
- Domény (Webglobe)
- Operátor
- Právník
- `<<DOPLNIT: další>>`

**Pravidlo:** pokud výdaje převýší příjmy o víc než 50 % po tři měsíce,
je čas rozhodnout, co dál (ČÁST 7.9).

---

## ČÁST 10 — Právo a administrativa

### 10.1 Firma

**Název:** Omnity.One s.r.o.
**IČO:** 09120050
**DIČ:** `<<DOPLNIT>>`
**Sídlo:** `<<DOPLNIT>>`
**Registrace:** KS HK, oddíl C, vložka 45723
**Finanční úřad:** Ústí nad Orlicí
**Datová schránka:** `ebz4tpd`

**Kdo je jednatel:** `<<DOPLNIT>>`
**Kdo je společník:** `<<DOPLNIT>>`

**Co to znamená pro tebe:** firma je právnická osoba, která vlastní projekt.
Ty jako fyzická osoba nejednáš „za projekt", jednáš za firmu (nebo jako
správkyně podle plné moci).

### 10.2 Dokumenty, které musíš znát

| Dokument | Kde je | Co říká |
|---|---|---|
| Darovací listina + plná moc | `docs/private/ZION_DAROVACI_LISTINA_A_PLNA_MOC.md` | Kdo co dostane, kdo co smí |
| Prohlášení o nástupnictví | `docs/private/ZION_SUCCESSION_DECLARATION.pdf` | Podepsané PDF |
| Plán nástupnictví | `docs/private/ZION_SUCCESSION_AND_IP_TRANSFER_PLAN.md` | Detaily rozdělení |
| Předávací checklist | `docs/private/ZION_HANDOVER_CHECKLIST.md` | Co je hotové, co ne |

**Pozor:** `docs/private/` je **mimo git** (gitignored). Ty dokumenty nejsou
v repu, který vidíš na GitHubu. Jsou jen lokálně u Yosefa a v zapečetěné kopii.

### 10.3 Daně

- Firma podává daňové přiznání každý rok.
- Účetnictví: `<<DOPLNIT: kdo vede, jaký systém>>`
- Pokud dostaneš peníze z projektu, jsou to **příjmy** a musí se zdanit.
- **Nikdy neřeš daně sám** — vždy s účetním nebo právníkem.

### 10.4 Domény a hosting

**Domény:** Webglobe. Platí se ročně. Expirace: `<<DOPLNIT>>`
**Hosting:** Contabo. Platí se měsíčně. Výpadek = weby nejdou.

**Pokud se nezaplatí:**

- Domény expirují → někdo jiný si je může koupit → projekt ztratí jméno.
- Hosting se vypne → servery zmizí → data jsou v zálohách, ale web nejde.

**Pravidlo:** platby za domény a hosting mají **absolutní prioritu**.
I v krizi. I v ochranné lhůtě.

---

## ČÁST 11 — Měsíční náklady

**Tohle je odhad. Skutečné částky najdeš ve faktu rách.**

| Položka | Odhad / měsíc | Poznámka |
|---|---|---|
| Contabo EDGE2 | `<<DOPLNIT>>` | Hlavní server |
| Contabo EDGE | `<<DOPLNIT>>` | Těžařský server |
| Webglobe domény | `<<DOPLNIT>>` | Ročně / 12 |
| Operátor | `<<DOPLNIT>>` | Podle smlouvy |
| Právník | `<<DOPLNIT>>` | Podle potřeby |
| **Celkem** | `<<DOPLNIT>>` | |

**Kde to najdeš:**

- Contabo: e-mail s fakturami, nebo přihlášení do účtu
- Webglobe: e-mail s fakturami
- Banka: výpisy Omnity.One

**Co dělat, když peníze dojdou:**

1. Zjistit, kolik chybí a na co.
2. Zavolat Petrovi a právníkovi.
3. Rozhodnout: doplnit z trustee peněženky / utlumit část služeb / ukončit projekt.
4. **Nikdy nevypnout hosting bez zálohy.** Nejdřív záloha, pak vypnutí.

---

## ČÁST 12 — Čtvrtletní cvičení

**Proč:** dokument, který si nikdy nevyzkoušela, je jen papír. Cvičení odhalí,
co v něm chybí.

**Jak často:** jednou za tři měsíce, 2 hodiny.

**Scénář (střídej):**

1. **Q1:** „Yosef je tři dny nezvěstný." Co uděláš? (Projdi ČÁST 1.)
2. **Q2:** „Web nejde." Co uděláš? (Projdi ČÁST 7.3.)
3. **Q3:** „Chain se zastavil." Co uděláš? (Projdi ČÁST 7.4.)
4. **Q4:** „Někdo se ptá na klíče." Co uděláš? (Projdi ČÁST 2.)

**Postup cvičení:**

1. Vyber scénář.
2. Projdi ho nahlas, krok za krokem.
3. Zapiš, kde jsi narazila na „nevím" nebo „nemám přístup".
4. Ty mezery se stanou úkoly pro Yosefa (ČÁST 13).
5. Zapiš do deníku: datum, scénář, co chybělo, co se opravilo.

**Výsledek:** po roce bys měla mít projité všechny čtyři scénáře a žádné
„nevím" v kritických krocích.

---

## ČÁST 13 — Blokátory, které musí Yosef vyřešit ZA ŽIVA

**Tohle je nejdůležitější tabulka celého dokumentu.** Každý řádek je věc,
která dnes nefunguje, a která v krizi znamená, že nemůžeš jednat.

**Dej Yosefovi tuhle tabulku přečíst. Trvej na tom, aby každý řádek měl
datum a podpis. Bez toho je dokument jen přání.**

| # | Blokátor | Proč je to problém | Co musí Yosef udělat | Stav |
|---|---|---|---|---|
| 1 | **Žádná záloha nezávislá na Yosefově Macu** | `~/backups/edge/` neexistuje. Když Mac umře, zálohy jsou pryč. | Nastavit offsite zálohu (jiný počítač, cloud, USB u notáře) a **otestovat obnovu** | `<<DOPLNIT>>` |
| 2 | **Erika nemá SSH klíč** | Nemůže restartovat server | Vygenerovat nový klíč, předat na USB, přidat na oba servery | `<<DOPLNIT>>` |
| 3 | **Erika nemá GitHub účet** | Nevidí historii, nemůže opravit kód | Přidat jako collaboratora | `<<DOPLNIT>>` |
| 4 | **Erika nemá Contabo** | Nemůže obnovit server z konzole | Přidat jako sub-account | `<<DOPLNIT>>` |
| 5 | **Erika nemá Webglobe (DNS)** | Nemůže přesměrovat doménu | Přidat jako správce | `<<DOPLNIT>>` |
| 6 | **Erika nemá password manager** | Nemá kde bezpečně držet hesla | Vytvořit účet, předat master heslo | `<<DOPLNIT>>` |
| 7 | **Erika nemá e-mail na doméně** | Nemůže komunikovat jménem projektu | Nastavit schránku | `<<DOPLNIT>>` |
| 8 | **Dokumenty nejsou podepsané** | Darovací listina a plná moc jsou `PENDING` | Podepsat u notáře, ověřit právníkem | `<<DOPLNIT>>` |
| 9 | **Rozpor 35 vs 38 klíčů** | `V31/STATUS.md` říká 38, součet kategorií 35 | Zjistit, které tři chybí, doplnit dokumentaci | `<<DOPLNIT>>` |
| 10 | **Trustee wallet mnemonic prošel chatem** | Může být kompromitovaný | Rotovat peněženku (přesunout prostředky na novou) | `<<DOPLNIT>>` |
| 11 | **Pool HA není rozhodnuté** | Nevím, jestli přepínat, nebo ne | Rozhodnout: aktivovat / nechat manuální / vypnout | `<<DOPLNIT>>` |
| 12 | **Operátor neexistuje** | V krizi není kdo restartovat | Vybrat, podepsat smlouvu, zaučit | `<<DOPLNIT>>` |
| 13 | **Kontakty nejsou vyplněné** | `<<DOPLNIT>>` v celém dokumentu | Vyplnit ČÁST 15 | `<<DOPLNIT>>` |
| 14 | **Nikdy neproběhla testovací obnova** | Nevím, jestli zálohy fungují | Provést testovací obnovu na testovacím serveru | `<<DOPLNIT>>` |
| 15 | **Admin klíče — kde fyzicky jsou** | Nevím, kde je trezor / schránka | Zapsat do ČÁST 4.8 a říct Petře | `<<DOPLNIT>>` |

**Jak s tabulkou pracovat:**

1. Jednou za měsíc si ji projdi s Yosefem.
2. Každý vyřešený řádek přepiš na `HOTOVO <datum>`.
3. Každý nevyřešený řádek zůstává `<<DOPLNIT>>`.
4. Když je hotových 15/15, dokument je „provozuschopný".
5. Dnes (2026-11-14) je hotových **0/15**.

---

## ČÁST 14 — Slovník

**Pojmy, které budeš potkávat. Nauč se je — ušetří ti to paniku.**

| Pojem | Co to znamená (lidsky) |
|---|---|
| **Chain / blockchain** | Síť počítačů, které si navzájem potvrzují transakce. „Řetěz bloků." |
| **Blok** | Balík transakcí, který vzniká ~každých 60 sekund. |
| **Výška (height)** | Pořadové číslo bloku. Čím vyšší, tím déle síť běží. |
| **Node** | Počítač, který drží kopii chainu a ověřuje transakce. |
| **Miner** | Počítač, který hledá nové bloky (a dostává za to ZION). |
| **Pool** | Služba, která sdružuje minery a rozděluje odměny. |
| **Stratum** | Protokol, kterým se miner připojuje k poolu (port 8444). |
| **RPC** | Rozhraní, kterým se dá node ptát na data (port 9445). |
| **UTXO** | „Nevyužitý výstup" — jako bankovka v peněžence. Peněženka jich má víc. |
| **Fragmented wallet** | Peněženka s příliš mnoha malými UTXO. Nedá se z ní poslat velká částka. |
| **Consolidate** | Sloučení mnoha malých UTXO do jednoho velkého. |
| **Mnemonic** | 12 nebo 24 slov, která obnoví peněženku. **Nikdy je nikomu neříkej.** |
| **Privátní klíč** | Tajný klíč k peněžence. **Nikdy ho nikomu nedávej.** |
| **Veřejná adresa** | Adresa, na kterou se posílá (začíná `zion1...`). Můžeš ji sdílet. |
| **Premine** | Peníze, které vznikly na začátku sítě. Uzamčené v 14 slotech. |
| **Admin 3-of-3** | Tři klíče (Rama/Sita/Hanuman), které dohromady ovládají síť. |
| **DAO** | Decentralizovaná organizace — hlasování držitelů. 7 guardianů, 5-of-7. |
| **Guardian** | Člen DAO, který hlasuje. |
| **Timelock** | Časový zámek — peníze se odemknou až po určité výšce. |
| **G8** | 30denní test dostupnosti sítě. Cíl: 99,9 %. |
| **Mainnet Beta** | Aktuální stupeň vývoje. Není to „hotové", ale je to „živé". |
| **SSH** | Způsob, jak se přihlásit na server z terminálu. |
| **Terminál** | Černé okno, kam se píšou příkazy. |
| **Služba (service)** | Program, který běží na serveru pořád (např. `zion-website`). |
| **Systemd** | Systém, který spravuje služby (`systemctl restart ...`). |
| **Journal** | Záznam toho, co služba dělá (`journalctl -u ...`). |
| **Záloha (backup)** | Kopie dat, ze které se dá obnovit. |
| **Obnova (restore)** | Vrácení dat ze zálohy. |
| **Failover** | Přepnutí na záložní server. |
| **HA (high availability)** | Schopnost běžet i při výpadku části. |
| **DNS** | Překlad doménového jména na IP adresu. |
| **Nginx** | Program, který rozděluje webový provoz. |
| **Certbot** | Program, který obnovuje HTTPS certifikáty. |
| **Contabo** | Firma, u které jsou pronajaté servery. |
| **Webglobe** | Firma, u které jsou domény. |
| **ZIS** | ZION Identity System — přihlašování. |
| **OASIS** | Virtuální svět s avatary a questy. |
| **L5** | Vrstva komunitních projektů (6 projektů, 3,3 miliardy ZION). |
| **Tithe** | Desátek — část příjmů jde na humanitární účely. |
| **WARP** | Bridge na jiné blockchainy (Base, BSC, Polygon...). |

---

## ČÁST 15 — Adresy, kontakty, inventář

### 15.1 Kontakty

| Kdo | Role | Telefon | E-mail | Poznámka |
|---|---|---|---|---|
| **Erika Imlaufová** | Hlavní správkyně | `<<DOPLNIT>>` | `<<DOPLNIT>>` | Ty |
| **Petra Tkácová** | Zástupkyně | `<<DOPLNIT>>` | `<<DOPLNIT>>` | Druhá v pořadí |
| **Právník** | Právní rada | `<<DOPLNIT>>` | `<<DOPLNIT>>` | Smlouvy, dědictví |
| **Operátor** | Technika | `<<DOPLNIT>>` | `<<DOPLNIT>>` | Zatím neexistuje |
| **Účetní** | Daně | `<<DOPLNIT>>` | `<<DOPLNIT>>` | |
| **Contabo podpora** | Hosting | — | `<<DOPLNIT>>` | Účet: `<<DOPLNIT>>` |
| **Webglobe podpora** | Domény | — | `<<DOPLNIT>>` | Účet: `<<DOPLNIT>>` |
| **Aelan** | `<<DOPLNIT>>` | `<<DOPLNIT>>` | `<<DOPLNIT>>` | |
| **Třetí v pořadí** | Když Petra nemůže | `<<DOPLNIT>>` | `<<DOPLNIT>>` | |

### 15.2 Adresy (weby)

| Co | URL | Co tam je |
|---|---|---|
| Hlavní web | `https://app.zionterranova.com` | Web ZION |
| Health | `https://app.zionterranova.com/api/health` | Stav všech služeb (JSON) |
| Explorer | `https://explorer.zionterranova.com` | Bloky, transakce, adresy |
| Pool | `https://pool.zionterranova.com` | Mineři, výplaty |
| E-shop | `https://market.zionterranova.com` | Objednávky |
| Přihlášení | `https://auth.zionterranova.com` | ZIS |
| OASIS | `https://oasis.zionterranova.com` | Avatary, questy |
| Grafana | `https://grafana.zionterranova.com` | Grafy (Basic Auth) |
| Dashboard | `https://dashboard.zionterranova.com` | Provozní přehled (Basic Auth) |
| RPC | `https://rpc.zionterranova.com/jsonrpc` | Veřejné RPC |
| Archiv | `https://app.zionterranova.com/zion-archive` | Knihy |
| Nirvana | `https://nirvana.zionterranova.com` | Hry |
| Kingdom | `https://kingdom.zionterranova.com` | Portál |

### 15.3 Servery

| Server | IP (IPv4) | IP (IPv6) | SSH port | Uživatel |
|---|---|---|---|---|
| **EDGE2** | `207.180.217.100` | `<<DOPLNIT>>` | 22 | root |
| **EDGE** | `62.171.141.136` | `2a02:c207:2342:5821::1` | 22 a 2222 | root |

**SSH klíč:** `~/.ssh/zion-edge-post-wipe-2026-07-29` (na Yosefově Macu).
**Pokud ten soubor nemáš, nemáš přístup.** Viz ČÁST 13, řádek 2.

### 15.4 Peněženky

| Peněženka | Adresa | Klíč (soubor) | Server |
|---|---|---|---|
| Pool payout | `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6` | `/etc/zion/MarketPlace/pool-wallet.json` | EDGE2 |
| Shop vault | `zion1f3y5j0l4p0m4g7g525a3g2z5u7a4m2q0t2pn0t0` | `/etc/zion/MarketPlace/shop-vault.json` | EDGE2 |
| Trustee | `zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5` | `/etc/zion/trustee-wallet.json` | EDGE2 |

**Co v souborech je:** JSON s adresou, veřejným klíčem a privátním klíčem
(v hex). **Nikdy je nekopíruj jinam. Nikdy je neposílej. Nikdy je nevypisuj
do terminálu před někým.**

### 15.5 Admin klíče (Rama / Sita / Hanuman)

**Co to je:** tři klíče, které dohromady odemykají premine a správu sítě.

**Kde jsou fyzicky:** `<<DOPLNIT: trezor / bankovní schránka / notář / USB>>`

**Kdo k nim má přístup:** `<<DOPLNIT>>`

**Pravidlo:** nikdy všechny tři na jednom místě. Nikdy všechny tři u jednoho
člověka. Nikdy je nepoužívej bez checklistu a bez druhé osoby.

### 15.6 USB s premine klíči

**Co na něm je:** `<<DOPLNIT: co přesně — mnemonic? JSON? PDF?>>`

**Kde je:** `<<DOPLNIT>>`

**Kdo k němu má přístup:** `<<DOPLNIT>>`

**Pravidlo:** USB se nepřipojuje k internetu. Otevírá se jen na počítači,
který není připojený (nebo po konzultaci s operátorem). Nikdy se z něj
nekopírují soubory do cloudu.

### 15.7 Co je v repu a co ne

| Co | Kde | Je v gitu? |
|---|---|---|
| Kód | `V31/`, `apps/`, `infra/` | ✅ ano |
| Dokumentace | `docs/` | ✅ ano (kromě `docs/private/`) |
| Runbooky | `infra/RUNBOOK.md`, `docs/3.2/ops/` | ✅ ano |
| Tento dokument | `docs/3.3/TRUSTEE-CONTINUITY.md` | ✅ ano |
| Právní dokumenty | `docs/private/` | ❌ **ne** (gitignored) |
| Klíče | `/etc/zion/...` na serverech | ❌ **ne** (nikdy) |
| Zálohy | `/opt/zion/backups/` na serverech | ❌ **ne** (nikdy) |

**Co to znamená:** když máš přístup do repa, máš kód a dokumentaci. Nemáš
právní dokumenty, klíče ani zálohy. Ty musíš mít fyzicky (USB, zapečetěná
kopie, trezor).

---

## Změnový log

| Datum | Verze | Co se změnilo | Kdo |
|---|---|---|---|
| 2026-11-14 | 1.0 | První verze. Sepsáno na základě `docs/private/ZION_SUCCESSION_AND_IP_TRANSFER_PLAN.md`, `ZION_HANDOVER_CHECKLIST.md`, `ZION_DAROVACI_LISTINA_A_PLNA_MOC.md`, `infra/RUNBOOK.md`, `docs/3.2/ops/DR-BRINGUP-RUNBOOK.md`, `POOL-HA-RUNBOOK.md`, `ALERT-RUNBOOK.md`, `PREMINE_144K_CHECKLIST.md`. Ověřen živý stav: chain 123 773, v3.2.0, Mainnet Beta. | Yosef Hubálek |

---

## Podpisová stránka

**Tento dokument jsem přečetla, rozumím mu a vím, kde jsou klíče a kontakty.**

| Kdo | Datum | Podpis |
|---|---|---|
| Erika Imlaufová | | |
| Petra Tkácová | | |
| Yosef Hubálek (sepsal) | | |
| Právník (zkontroloval) | | |

**Zapečetěná kopie uložena:** `<<DOPLNIT: kde>>`
**Datum zapečetění:** `<<DOPLNIT>>`
**Kopie pro Petru předána:** `<<DOPLNIT>>`

---

> **Poslední slovo:** Tenhle dokument není o technice. Je o tom, že projekt
> přežije tebe. Když ho budeš číst za deset let a budeš mít pocit, že je
> zastaralý, znamená to, že fungoval — protože se projekt vyvíjel dál.
> V tom případě ho aktualizuj a nech zapečetit novou kopii.
>
> A když se někdy budeš cítit sama a budeš mít pocit, že to nemůžeš zvládnout:
> **zavolej Petrovi.** Proto tam je.
