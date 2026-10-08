# Caminho do Jardim — kompletní projektový dokument L5

> **Stav:** DRAFT / koncept — podklad pro jednání s portugalskými institucemi. `v0.1` · 2026-10-07
> **Součást:** L5 Terra Nova — Genesis Garden (Sabacheira, concelho Tomar)
> **Vazby:** `L5MariaDelCamino.md` (onboarding na Tres Marias), `docs/WP-Mainet/MariaCaminho/`, `APP&WEB/website-v2.9/src/components/CaminhoDoJardimMap.tsx`

---

## 0. Sumário executivo (PT — pro instituce)

O **Caminho do Jardim** é um percurso pedestre e fluvial proposto que liga **Fátima a Tomar** através de **Seiça, Sabacheira e Agroal**, numa extensão total de aproximadamente **35 km**. O seu ponto central é o **Genesis Garden** — um projecto agro-ecológico e de acolhimento a peregrinos na freguesia de Sabacheira (concelho de Tomar), no qual está previsto o **Albergue do Jardim**, um albergue de peregrinos devidamente licenciado.

O percurso articula-se com três itinerários existentes: a **Rota Nascente do Caminho de Fátima** (Fátima→Tomar), o **Caminho Central Português de Santiago** (que atravessa Tomar) e o troço de descida náutica do **rio Nabão entre Agroal e Tomar**, já explorado comercialmente por operadores de canoagem.

Pretende-se: (i) registar/homologar o percurso junto da **FCMP — Registo Nacional de Percursos Pedestres**, (ii) reconhecê-lo como itinerário complementar junto do **Centro Nacional de Cultura — Caminhos de Fátima**, e (iii) licenciar o Albergue do Jardim como estabelecimento de alojamento local, modalidade hostel, junto da **Câmara Municipal de Tomar** (RNAL).

---

## 1. Projekt v jednom odstavci

Caminho do Jardim je navrhovaná poutní a přírodní trasa **Fátima → Seiça → Sabacheira (Genesis Garden + Albergue do Jardim) → Agroal (pramen Nabão) → po proudu Nabão → Tomar**. Slouží jako spirituálně-ekologická odbočka mezi dvěma hlavními poutními osami regionu (Fátima ↔ Santiago přes Tomar) a zároveň jako **onboarding do programu Tres Marias** — carimbo Zahrady v credencialu kvalifikuje poutníka **požádat** o místo na palubě lodí flotily (kvalifikace, nikoli garancia — rozhodují provozní pravidla plavby).

## 2. Trasa

```
Fátima ──(~15 km, existující značená stezka)──▶ Seiça ──(~5 km)──▶ Sabacheira
     · Genesis Garden + Albergue do Jardim ──(~4 km)──▶ Agroal (pramen Nabão)
     ──⛵ ~14 km PO PROUDU řeky Nabão──▶ Tomar (Caminho Central)
```

| Leg | Vzdálenost | Režim | Poznámka |
|---|---|---|---|
| Fátima → Seiça | ~15 km | pěšky | existující značený úsek (Caminho Nascente / červená značka) — ověřit přesný trail ID |
| Seiça → Sabacheira | ~5 km | pěšky | selské cesty; vstup do freguesie Sabacheira |
| Sabacheira → Agroal | ~4 km | pěšky | Genesis Garden → praia fluvial do Agroal, pramen Nabão |
| Agroal → Tomar | ~14 km | **kajak/kánoe po proudu** | sezónní (orientačně listopad–květen podle průtoku), açudy = krátké přenášky |
| fallback Agroal → Tomar | ~13 km | pěšky | po břehu, suchá sezóna |

**Klíčové souřadnice:**

| Bod | Lat | Lon | Poznámka |
|---|---|---|---|
| Genesis Garden — parcela | 39.6788 | −8.4778 | přesný pin pozemku (stav: akvizice pending) |
| Sabacheira (obec) | 39.678 | −8.482 | freguesia, concelho Tomar |
| Fátima (Santuário) | 39.617 | −8.652 | concelho Ourém |
| Seiça | 39.675 | −8.524 | freguesia, concelho Ourém |
| Agroal — praia fluvial | 39.679 | −8.436 | Formigais (Ourém) / hranice se Sabacheira |
| Tomar — Convento de Cristo | 39.603 | −8.409 | cíl, UNESCO, Caminho Central |
| Chão de Maçãs–Fátima (žel. stanice) | ~39.686 | −8.465 | Linha do Norte — dopravní páteř |

⚠️ **Status: schematické vedení.** Aktuální mapa (`CaminhoDoJardimMap.tsx`) používá ruční waypointy, ne přesnou geometrii. Před registrací potřeba: **reálný GPX survey** každého legu, kontrola průchodnosti, dohody s vlastníky pozemků na neveřejných úsecích.

## 3. Program uzlu

### 3.1 Genesis Garden (Sabacheira)

- Agro-ekologická zahrada, regenerativní zemědělství, komunitní učení
- Parcela: pin 39.6788, −8.4778 — právní převod/akvizice **pending**
- Úloha: zemská iniciace poutníka — práce v zahradě, nocleh, carimbo

### 3.2 Albergue do Jardim

- Plánovaná poutní noclehárna na parcele / v sousedství Zahrady
- Cílová koncepce: dormitórium ~10–20 lůžek (finalizovat dle kapacity parcely a licenční kategorie), společná kuchyň, sprchy, venkovní zázemí, prostor pro službu zahrady
- Vydává **carimbo do Jardim** do credencialu poutníka (oficiální CNC credencial + interní Credencial do Jardim)
- S carimbem může poutník **požádat o palubu Tres Marias** — viz `L5MariaDelCamino.md` §Caminho do Jardim

## 4. Registrace a homologace trasy — kde a jak

### 4.1 FCMP — Registo Nacional de Percursos Pedestres (RNPP) ← HLAVNÍ REGISTR

**Federação de Campismo e Montanhismo de Portugal** je jediný orgán certifikující pěší trasy v Portugalsku (GR/PR/PL značení jsou registrované ochranné známky FCMP v INPI — samovolné značení = porušení zákona).

- **Klasifikace:** celá trasa ~35 km → **Grande Rota (GR)** — národní číslování; nebo rozdělit na dva PR (per concelho: Seiça/Agroal ↔ Ourém, Sabacheira ↔ Tomar)
- **Proces:** `Projeto → Registo → Implementação → Homologação → Manutenção`
- **Formulář:** „Ficha de Registo de Percurso Pedestre" (PDF na fcmportugal.com) + projekt trasy
- **Adresa:** FCMP-RNPP, Av. Coronel Eduardo Galhardo 24D, 1199-007 Lisboa
- **Podmínky homologace:**
  - **Entidade promotora musí být právnická osoba** (obec, associação, klub) — viz §6.1
  - Závazek údržby trasy **min. 5 let**
  - Minimálně 1 propagační/informační leták
  - Terénní vistoria technikem FCMP → **Carta de Homologação** (certifikát kvality)
  - Homologace lze odebrat při neúdržbě

**Strategická poznámka:** v Portugalsku jsou promotéry tras obvykle **obce**. Nejrychlejší cesta = navrhnout trasu **Câmara Municipal de Tomar** (a skrze Ourém jako součást) jako promoterovi, ZION jako partner financování/údržby. Alternativa: vlastní associação (§6.1).

### 4.2 Obce a freguesie (povinná osa jednání)

| Subjekt | Proč |
|---|---|
| **Câmara Municipal de Tomar** — Divisão de Turismo / Urbanismo | parcela + Sabacheira + cílová etapa; promoter/approval značení v concelho; existující PR1 TMR „Nas Margens do Rio Nabão" (~9,2 km) — koordinovat napojení |
| **Câmara Municipal de Ourém** | Fátima, Seiça i Agroal (Formigais) leží v concelho Ourém — větší část trasy je fakticky ouremská |
| **Junta de Freguesia de Sabacheira** | hostitelská freguesie — klíčový partner, místní dohody, cesty |
| **Juntas:** Seiça, Formigais, Fátima, Santa Maria dos Olivais e São João Baptista (Tomar) | průchodnost, cesty, místní komunita |
| **CIMMT — Comunidade Intermunicipal do Médio Tejo** | regionální platforma (zasedá v Tomaru), meziobecní koordinace |
| **CCDR Centro** | regionální koordinace rozvoje, vstup do programů Centro 2030 |

### 4.3 Poutní legitimita — Caminhos de Fátima + Santiago

| Subjekt | Role |
|---|---|
| **Centro Nacional de Cultura (CNC)** — titulár značky „Caminhos de Fátima" | oficiální **Credencial do Peregrino dos Caminhos de Fátima** + Certificado dos Caminhos de Fátima; mechanismus razítek otevřený — **albergue razítkuje vlastním carimbem**; cíl: Albergue do Jardim uznán jako „entidade de acolhimento" na síti; kontakt: info@cnc.pt, +351 21 346 67 22, Rua António Maria Cardoso 68, Lisboa · caminhosdefatima.org |
| **ACF — Associação Caminhos de Fátima** | meziobecní asociace (14 obcí, **Ourém člen**, Tomar ne); provozuje Caminho do Centenário, Rota Carmelita; partner pro začlenění do sítě |
| **Comissão de Apoio a Peregrinos a Pé** (koordinuje Movimento Mensagem de Fátima) | bezpečnostní rámec: Santuário de Fátima, ANEPC, GNR, IP, Ordem de Malta, Cruz Vermelha, Servitas, CNE, VOST; registrace skupin přes **peregrinar.pt** |
| **Santuário de Fátima** | formální artikulace nové trasy se Santuáriem (CNC trasuje „em articulação com o Santuário") |
| **Diocese de Santarém** | církevní legitimace obou konců (Tomar i Ourém jsou v této diecézi); požehnání trasy a albergue |
| **Caminho de Santiago** | poutníci na Credencial del Peregrino sbírají razítka od jakéhokoliv ubytování/farnosti — Albergue do Jardim může razítkovat bez dalšího schvalování; pro hlubší integraci partnerství s asociacemi Caminho Português (např. Via Lusitana) |

**Cílový status trasy:** „itinerário complementar dos Caminhos de Fátima" + homologovaný GR/PR FCMP — ne nové samostatné „oficiální" poutní jmění (to vlastní CNC).

## 5. Licencování Albergue do Jardim — postup

### 5.1 Předpoklady (v tomto pořadí)

1. **Právní entita** — viz §6.1 (provozovatel musí být PT právnická osoba)
2. **Právo k nemovitosti** — caderneta predial / escritura / dlouhodobý pronájem parcely
3. **PIP — Pedido de Informação Prévia** na Câmara Municipal de Tomar (Urbanismo): proveditelnost stavby dle **PDM de Tomar** (rustikální půda = pravděpodobně „solo rústico" → zjištění podmínek: ekologická/landskábní zařazení, RAN/REN, Natura 2000, ochranná pásma vodotěče)
4. **APA — Agência Portuguesa do Ambiente / ARH Tejo** — pokud stavba/úpravy v **domínio público hídrico** (leito + margens Nabão/přítoků) nebo potřeba vrtu/captação → licença de captação de água

### 5.2 Stavební licenciace (RJUE, DL 136/2014)

- **Comunicação prévia** nebo **licença de construção** u Câmara Tomar — dle charakteru díla (novostavba = plný projekt: architektura + specialty + SCIE předběžný posudek)
- Projekt podepsaný architektem registrovaným v OASRS (Ordem dos Arquitectos)
- **SCIE — Segurança Contra Incêndios em Edifícios** (ANEPC): kategorie rizika podle kapacity (do ~10 uživatelů = 1. kategorie, zjednodušený režim; nad → projektová specialita)
- Vybavení: požární hlásiče, hasicí přístroje, nouzové světlo, značení úniku

### 5.3 Provozní licenze — Alojamento Local, modalidade **«hostel»**

Albergue s dormitóriem = **AL modalidade hostel** (DL 128/2014 ve znění L 62/2018, art. 14.º; podmínky provozu Portaria 262/2020).

Postup:
1. **Mera comunicação prévia com prazo** přes eBalcão (ePortugal / Balcão do Empreendedor) → směřuje Câmara Municipal de Tomar
2. Záznam do **RNAL** (Registo Nacional de Alojamento Local) → číslo v označení „XXXXX/AL"
3. Vyvěšení **placa identificativa** „AL"
4. Registrace činnosti u Autoridade Tributária (CAE 55201/55204)
5. Pravidelná **vistoria** Câmara + ASAE

Requisity (výběr — art. 12.º–14.º + Portaria 262/2020):
- Dormitórium: **min. 4 lůžka nebo palandy**, sdílené sociální zařízení v poměru dle kapacity
- Recepce/identifikace hostů, úklid, ložní prádlo, ventilace, pitná voda
- **Pojištění odpovědnosti za škody** (povinné) + doporučeno pojištění úrazů hostů
- **Livro de Reclamações eletrónico** (povinné)
- Komunikace hostů: SEF/SIBA — hlášení cizinců (entrega de boletins de alojamento)

> Alternativa pro větší provoz: **empreendimento turístico typu „Hostel"** dle RJET (DL 80/2017) — těžší režim, registrace přes Turismo de Portugal; pro poutní albergue ~≤20 lůžek je AL hostel lehčí a obvyklá cesta.

### 5.4 Zdraví, strava, voda

- **Delegado de Saúde / ARS Centro** — souhlas kuchyň a stravování; **HACCP** pokud servírování jídel
- **ASAE** — dozor potravinářství a služeb
- Voda: napojení na síť (Águas/EMT dle lokality) **nebo** vlastní vrt = licença de captação APA + **análise kvality vody** (akreditovaná laboratoř, opakovaně)
- Odpadní vody: napojení na kanalizaci nebo **fossa séptica** dle předpisu Câmara/ARH

## 6. Právní entita a provozní rámec

### 6.1 Entidade promotora

FCMP i licencování vyžadují právnickou osobu. Možnosti:
- **Vlastní portugalská associação** (např. „Associação Caminho do Jardim / Terra Nova") — nezávislost, trvá měsíce
- **Partnerství s Câmara Municipal de Tomar** — obec jako promoter trasy, ZION financuje/komaintains; nejrychlejší pro značení
- **Partnerství s Junta de Freguesia de Sabacheira** — menší dosah, ale přímá místní kotva
- Doporučená kombinace: **associação (provozovatel albergue) + Câmara (promoter trasy)**

### 6.2 Vodní úsek (Agroal → Tomar po Nabão)

- Komerční sjezd existuje (operátoři RNAAT): ~14 km, ~4,5 h, střední obtížnost, **sezóna ~listopad–květen** podle průtoku; açudy (jezy) = povinné krátké přenášky
- **Model A (doporučený):** partnerství s licencovaným operátorem — albergue rezervuje „vodní etapu", operátor poskytuje lodě, průvodce, pojištění
- **Model B:** vlastní provoz = **RNAAT** registrace (Registo Nacional dos Agentes de Animação Turística, Turismo de Portugal) + pojištění animace + plavidla + průvodcovská kvalifikace + souhlas APA/ARH Tejo (leito e margens jsou domínio público hídrico) + dohody o přenáškách s vlastníky/regantes açudů
- Bezpečnost: flow monitoring, zákaz za vysoké vody, výstroj, 112/GNR kontakty; skupiny registrovat na **peregrinar.pt**
- Suchá sezóna → pěší varianta po břehu (cca 13 km) — součást trasy od začátku, ne ad-hoc

### 6.3 Credencial a carimbo — mechanika

- **Credencial do Jardim** (interní, ZION): vlastní poutní dokument — žádný státní schvalovací proces; design vázaný na Tres Marias
- **CNC Credencial dos Caminhos de Fátima**: albergue = „entidade de acolhimento" razítkující vlastním carimbem; dlouhodobě žádost o zařazení do seznamu referenčních bodů
- **Credencial del Peregrino (Santiago)**: razítkovat standardně jako jakékoliv ubytování
- Zásada veřejné komunikace: **carimbo = kvalifikace k žádosti o palubu, nikoli garancia** (kapacita, bezpečnost, pravidla plavby)

## 7. Financování — relevantní programy

| Program | Osa | Poznámka |
|---|---|---|
| **Centro 2030** (Programa Regional do Centro 2021-2027) — SIBT/FTJ Médio Tejo | stavba, vybavení, energie | avisos pro Médio Tejo zahrnují Tomar+Ourém; sledovat mediotejo.pt / portugal2030.pt |
| **LEADER / DLBC — GAL ADIRN** | venkovský rozvoj, turismus, komunita | **ADIRN pokrývá Tomar i Ourém** — potvrzené eligible území; typicky nevratná podpora ~50 % |
| **PEPACC** (přes ADIRN) | bioekonomika zahrady | drobné investice 10–250 k€, 50 % non-refundable — vhodné pro agro část Genesis Garden |
| **Turismo de Portugal** — nástroje SI Turismo / Apoiar / Turismo 360 | ubytování, ESG | lišit podle aktuálních výzev |
| **CIMMT / obecní programy** | značení, infra | meziobecní doplatky |
| **ZION / Free World fund** | přímé financování L5 | interní alokace per registry |

## 8. Checklist náležitostí

| # | Dokument/krok | Orgán | Fáze |
|---|---|---|---|
| 1 | Zřídit/zvolit entidade promotora (associação) | konservatória | 0 |
| 2 | Doklad práva k parcele (caderneta + escritura/nájem) | registo predial | 0 |
| 3 | PIP — proveditelnost stavby na parcele | Câmara Tomar | 0 |
| 4 | GPX survey všech legů + dohody s vlastníky pozemků | terén | 0–1 |
| 5 | Jednání: Juntas Sabacheira/Seiça/Formigais + Câmara Tomar + Ourém | obce | 1 |
| 6 | Projekt trasy + Ficha de Registo | FCMP-RNPP | 1 |
| 7 | Implementace značení (po souhlasech) | terén | 2 |
| 8 | Vistoria → Carta de Homologação | FCMP | 2 |
| 9 | Jednání CNC — zapojení do Caminhos de Fátima (carimbo bod) | CNC | 1–2 |
| 10 | Bezpečnostní koordinace (Comissão MMF, GNR, peregrinar.pt) | MMF/ANEPC | 2 |
| 11 | Jednání Diocese Santarém + Santuário de Fátima + paróquias | diecéze | 1–2 |
| 12 | Architektonický projekt albergue + specialty + SCIE | projektanti | 1–2 |
| 13 | Comunicação prévia / licença de construção | Câmara Tomar | 2 |
| 14 | APA/ARH Tejo — posudek (margens, captação vrtu) | APA | 1–2 |
| 15 | Stavba + rekolaudace, vistoria SCIE | stavitelé/ANEPC | 3 |
| 16 | Mera comunicação prévia AL-hostel → RNAL číslo | Câmara/eBalcão | 3 |
| 17 | Pojištění RC, livro reclamações, SIBA/CAE, ASAE readiness | — | 3 |
| 18 | RNAAT operátor vodního úseku (nebo partnerští smlouva) | Turismo de Portugal | 3 |
| 19 | Dohody o přenáškách u açudů (regantes/vlastníci) | APA/regantes | 3 |
| 20 | Leták/informační materiál trasy (podmínka homologace) | FCMP požadavek | 2 |
| 21 | Funding applications (ADIRN LEADER, Centro 2030, PEPACC) | GAL/CCDR | 1+ |

## 9. Rizika a otevřené otázky

- **Parcela:** akvizice/právní převod pending — licenciace albergue je bez dokladu o právu blokovaná
- **Trasa:** GPX nesurveyováno; červená značka Fátima→Seiça = předpoklad Caminho Nascente — ověřit trail ID a stav
- **Voda:** Nabão sezónní; açudy vyžadují dohody; operátor model nezvolen
- **Legitimita:** Caminho do Jardim je koncept; formální „oficiální" status poutní cesty vlastní CNC/Caminhos de Fátima — cíl = complementar itinerary
- **Komunity:** FPIC-ekvivalent — jednání s Juntou de Sabacheira a obyvateli před jakýmkoliv značením
- **Veřejná copy:** nikde netvrdit existující vyznačení, povolení, ani garanci paluby

## 10. Okamžité další kroky (priorita)

1. GPX survey: Fátima→Seiça→Sabacheira→Agroal + břeh Nabão Agroal→Tomar
2. Kontakt: Junta de Freguesia de Sabacheira + Câmara Municipal de Tomar (Urbanismo + Turismo) — představení konceptu
3. Kontakt: CNC (info@cnc.pt) — poptávka mechanismu acolhimento bodu
4. Kontakt: GAL ADIRN — aktuální avisos LEADER/PEPACC pro Tomar
5. Rozhodnutí právní entity (associação vs. partnerství Câmara jako promoter)
6. Sezonní průtok Nabão: konzultace operátorů sjezdu Agroal→Tomar

---

*Vytvořeno pro interní plánování ZION L5. Veškerá veřejná komunikace drží status „koncept/vize" do doby reálných povolení.*
