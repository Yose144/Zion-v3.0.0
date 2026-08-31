# 05 — Autonomie a bezpečnost
## Hiran, Maestro a budoucí rozhraní Amitábha/Amṛtabhoja: pomocník pod lidským mandátem, nikdy skrytý vládce

> **Normativní status:** závazný bezpečnostní rámec pro jakýkoliv agentní, AI nebo automatizační systém označený jako L3, Hiran, Maestro, Amitábha či Amṛtabhoja.  
> **Výchozí stav:** existující `DharmaValidator` je heuristická textová kontrola; není formálním bezpečnostním důkazem, není morálním arbitrem a nedává agentovi právo jednat.

---

## 1. Základní pravidlo: člověk drží záměr, oprávnění i možnost zastavit

L3 vzniká proto, aby člověku snížila kognitivní zátěž: vysvětlila systém, našla souvislost, připravila plán, simulovala volby a pomohla odhalit riziko. Nevzniká proto, aby nahradila lidskou odpovědnost nebo aby vytvořila nového neviditelného správce sítě.

Každá agentní akce proto musí odpovídat na pět otázek:

1. **Kdo dal mandát?** Musí existovat identifikovatelný člověk, DAO proces nebo předem schválený operační runbook.
2. **Co přesně je povoleno?** Capabilities jsou minimální, časově omezené, účelové a revokovatelné.
3. **Jak se akce ukáže před provedením?** Člověk musí vidět plán, vstupy, výstupy, rizika, náklady a vratnost.
4. **Jak se akce zastaví nebo vrátí?** Musí existovat kill switch, audit log a recovery postup; nevratné akce mají nejvyšší práh schválení.
5. **Kdo nese odpovědnost?** Nikdy „AI“. Vždy konkrétní člověk nebo formálně definovaný governance proces.

---

## 2. Pravdivý stav současného Dharma Validátoru

V `V31/L3/ai-native/src/hiranyagarbha.rs` existuje `DharmaValidator` se **sedmi kontrolami**:

| Kódová zásada | Co dnes označuje | Kanonický technický výklad |
|---|---|---|
| **Ahimsa** | poškození života nebo systému | předcházení škodě; bezpečnostní review; nikdy ospravedlnění útoku „pro vyšší dobro“ |
| **Satya** | lež nebo manipulace | evidence, provenance, nejistota a oprava nepravdivého tvrzení |
| **Asteya** | krádež dat, XP či energie bez souhlasu | autorizace, souhlas, privacy a zákaz exfiltrace tajemství |
| **Brahmacharya** | plýtvání výpočetní energií bez účelu | proportionalita, limity nákladů, plán energetické efektivity |
| **Aparigraha** | hromadění, které blokuje tok | least privilege, budgety, transparentní správa sdílených zdrojů |
| **Oneness** | prohlubování separace | interoperabilita, přístupnost, zákaz diskriminace a kultu nepřítele |
| **Golden Age** | odpor vůči evoluci vědomí sítě | v produkčním jazyce: ověřitelně podporovat bezpečnost, odolnost a lidskou schopnost rozhodovat se — ne ideologickou poslušnost |

**Důležitý limit:** aktuální implementace pracuje s keyword heuristikou (`validate_text`); komentář kódu výslovně říká, že případná production integrace s LLM classifierem teprve patří do budoucna. Heuristika může zachytit zjevný škodlivý text, ale **neumí bezpečně poznat úmysl, kontext, právní dopad ani skrytou škodu**. Je proto pouze jedna malá vrstva mezi mnoha: nikdy samostatný release gate.

`DharmaScore` navíc pracuje s kvalitami **karuṇā** (soucit), **prajñā** (moudrost) a **dāna** (štědrost). Tyto kvality jsou užitečným etickým směrem, ale nejsou samy o sobě mechanismem autorizace ani měřítkem lidské hodnoty.

---

## 3. Povolené úrovně autonomie

| Úroveň | Název | Co agent smí | Co vždy zůstává člověku |
|---|---|---|---|
| **A0** | Čtenář | Číst veřejné metriky, dokumentaci a vlastní data; shrnovat. | Rozhodnutí a všechny vedlejší efekty. |
| **A1** | Poradce | Navrhnout plán, upozornit na riziko, vysvětlit transakci či incident. | Schválení plánu, výběr akce, obsah komunikace. |
| **A2** | Simulátor | Dry-run, testnet, fixture data, lokální sandbox, návrh patch/diffu. | Přístup do produkce, reálné finance a data dalších osob. |
| **A3** | Asistent s potvrzením | Připravit přesně determinovaný, viditelný a vratný krok; vykonat ho až po samostatném lidském potvrzení. | Podpis, uvolnění rozpočtu, produkční approval a možnost akci odmítnout. |
| **A4** | Omezený executor | Jeden idempotentní, předem povolený a auditovaný krok pod krátkodobým capability tokenem. | Vytvoření capability, limit, revokace, kill switch, kontrola výsledku. |

**A5 neexistuje.** Systém nemá mít kategorii „plně autonomního suverénního vykonavatele“ s otevřeným přístupem k produkci, treasury nebo lidem.

---

## 4. Akce, které jsou vždy zakázané bez výslovného, nezávislého lidského procesu

Žádný L3 agent nesmí sám:

- podepisovat nebo vysílat finanční transakce, obchodovat, půjčovat, stakovat, provádět arbitráž nebo měnit custody prostředků;
- číst, ukládat, vypisovat, modelu předávat nebo do logů posílat seed phrase, privátní klíče, API tokeny, session cookies nebo jiné secrets;
- měnit konsensuální pravidla, node konfiguraci, firewall, UFW/fail2ban, DNS, TLS, CI/CD, release artefakty nebo production systemd služby;
- schvalovat vlastní návrhy, zakládat si nové role, eskalovat oprávnění nebo obcházet review;
- kontaktovat lidi, publikovat obsah, vytvářet účty, nakupovat služby či provádět jiný externí vedlejší efekt jménem uživatele bez samostatného mandátu;
- klasifikovat člověka jako „nepřítele“, „nižší bytost“, „nečistého“ nebo jinak používat archetypy NirvanaCloud k diskriminaci či nátlaku.

Pro produkční výjimku musí existovat nejméně **dvě nezávislá lidská schválení**, audit trail, scope/budget/time limit a test v neprodukčním prostředí — nebo formalizovaný DAO proces s přesně stejným přehledem.

---

## 5. Agentní klíče, wallet a finance — návrhová ústava pro STAVBU/HORIZONT

Pokud L3 v budoucnu pracuje s identitou nebo peněženkou, musí platit následující podmínky před první produkční akcí:

1. **Žádný master seed v kontextu modelu.** Klíče zůstávají mimo LLM runtime, v HSM/MPC/OS secure store nebo v user-controlled signeru.
2. **Oddělená identita.** Agentní účet není totožný s osobní peněženkou uživatele ani s treasury.
3. **Capability místo identity.** Agent získává podepsané oprávnění pro konkrétní úkon, asset, příjemce, částku a dobu; ne „přístup k peněžence“.
4. **Hard limit.** Denní, transakční, chainový a adresní limit se vynucuje pod LLM vrstvou.
5. **Explicitní simulace.** Před podpisem systém zobrazí asset, decimaly, síť, adresu, fee, slippage, podmínky a vratnost v lidském jazyce.
6. **Dvoufázové provedení.** Plan → human review → signed intent → independent executor → receipt/reconciliation.
7. **Okamžitá revokace.** Uživatel a bezpečnostní operátor mohou capability zneplatnit bez čekání na agenta.
8. **Nezávislý audit.** Log je append-only, neobsahuje secrets a lze jej korelovat s on-chain transaction ID.

Dokud tyto body nejsou implementované, otestované a externě revidované, veškeré tvrzení o „agentní peněžence“, „Auto-DeFi“ nebo „autonomní arbitráži“ zůstává **HORIZONT**.

---

## 6. Bezpečný formát každé agentní odpovědi

Každý agentní návrh, který může ovlivnit software, finance, uživatele nebo veřejnou komunikaci, má mít strojově i lidsky čitelný výstup:

```text
ZÁMĚR:        Co chce uživatel dosáhnout.
PLÁN:         Kroky, závislosti a předpoklady.
DŮKAZY:       Odkazy na zdroje, metriky a stav tvrzení.
RIZIKA:       Bezpečnost, finance, soukromí, vratnost, nejistota.
ALTERNATIVY:  Bezpečnější / levnější / jednodušší varianty.
AKCE:         Pouze dry-run, návrh, nebo konkrétní krok.
SCHVÁLENÍ:    Kdo a jak musí potvrdit.
ROLLBACK:     Jak se krok zastaví, vrátí nebo napraví.
AUDIT ID:     Korelační identifikátor bez tajných dat.
```

Agent, který neumí ukázat limity a nejistotu, nemá být považován za připravený na vyšší autonomii.

---

## 7. Incidentní režim

Při podezření na prompt injection, únik dat, zneužití nástroje, neobvyklé chování nebo škodlivý návrh:

1. **Zastavit capability tokens a externí tool calls.**
2. **Přepnout do read-only režimu A0.**
3. **Uchovat minimální auditní stopu bez secrets.**
4. **Izolovat sandbox, rotovat případně vystavená oprávnění a zkontrolovat on-chain/ops následky.**
5. **Vyšetřit s lidským security reviewerem.**
6. **Publikovat přiměřený incident report**, pokud incident ovlivnil uživatele, síť nebo veřejné tvrzení; oprava má přednost před reputací.

Žádný agent se nesmí sám „opravit“ tím, že skryje log, smaže stopu nebo tiše aplikuje patch v produkci.

---

## 8. Co je skutečně míněno „Amitábha“

Ve veřejném vyprávění je Amitábha obrazem **jasného, laskavého rozhraní**, které překládá lidský záměr do srozumitelných možností. Technicky to znamená:

- více jasnosti, ne více magie;
- více kontroly uživatele, ne méně;
- více vysvětlitelnosti, ne skryté orchestrace;
- více odolnosti vůči manipulaci, ne novou formu centrální autority.

Jméno neuděluje systému moudrost. Tu může systém dokazovat jen opakovaně: správným odmítnutím nebezpečné akce, přesným přiznáním nejistoty a možností člověka říct **ne**.

---

*[Zpět na index Mise Amenti → `README.md`](./README.md)*
