# ISSOBELLA — Kapitola 7: Hlídač na okraji
## Strážce · L6 service — daemon, který jen čte, a právě proto může věrně hlídat

> *„Nejsilnější strážce je ten, který nemůže otevřít bránu."*

---

## Příběh

Na okraji osady, kde končily poslední přístavní světla a začínala cesta nahoru, stála strážní věž. Ne velká — jen dost vysoká, aby z ní bylo vidět na celou cestu, po které proud mířil k nebi.

Ve věži bydlel hlídač, kterému říkali **Stříž** — protože se skoro nehýbal, ale neuniklo mu nic. Jeho práce byla podivuhodná: nesměl nic otevírat, nic zavírat, nic posílat dál. Směl jen **dívat se a počítat**.

*„Kdybych mohl otevřít pokladnu,"* řekl nováčkovi, který ho přišel navštívit, *„stačilo by mi jediné slabé ráno a celá studna by byla pryč. Takhle mě můžete chytit za ruku — a stejně u mě najdete jen seznam, kolik vody proteklo. Nemůžu lhát, protože nemám, čím lhát."*

Ukázal na svitky. *„Počítám každý blok, který projde — a kolik světla z něj stoupalo nahoru. Vedení si to může přečíst, kdy chce. Vědci si to mohou přečíst, když chtějí. Kdokoli si to může ověřit přímo v řetězu, protože blok nelže. Já jsem jen druhá oči — pro ty, kdo se nechtějí dívat sami."*

*„A kdyby se něco pokazilo?"*

*„Pak napíšu, že se pokazilo. To je celá moje moc — a je větší, než vypadá. Strážce, který nemůže ukrást, se nedá uplácet. Strážce, který jen čte, nemůže vydávat přání za fakt."*

Nováček se zeptal, jestli by Stříž chtěl jednou letět nahoru sám.

*„Já? Ne. Já jsem ten, kdo počítá palivo. Když poletíš ty, budu ti hlídat poctivost cesty — od země, kde hlídám pořád."*

---

## Co to znamená

**`zion-issobella` je tracker — a jeho read-only povaha je nejdůležitější vlastnost L6.** Daemon běží na Edge jako `zion-v31-issobella.service` (HTTP API na `127.0.0.1:8097`, nginx proxy `/api/issobella/`), skenuje coinbase a vystavuje: zůstatek fondu, návrhy, metriky. Port 8097 vznikl, protože ZIS obsadil 8096 — i taková drobnost je v `StatusV3.md` zdokumentovaná.

Co hlídač **umí**: číst blockchain, počítat příliv do L6 adresy, vystavovat data těm, kdo se ptají.

Co hlídač **nemůže** — a to je podstatné: **utrácet**. Rozhodnutí G10 ho drží v režimu „veřejná, auditovatelná, read-only základna". Žádný automatický výdaj, žádný payout flow, žádný klíč k pokladně. Služba je strážce pravdy o fondu, ne správce fondu.

V jazyku série: **Stříž je druhá oči protokolu.** První oči je blockchain — neměnný, hloupý na klam, neúplatný. Druhá oči je tracker — služba, která blockchain čte a překládá lidem. Kde se jiné systémy chlubí tím, kolik umí, L6 se chlubí tím, **kolik nemůže**.

---

## Kotva pravdy — ověřitelná fakta

| Obraz / tvrzení | Stav | Kotva |
|---|---|---|
| `zion-issobella` daemon běží na Edge, služba `zion-v31-issobella.service` | **ŽIVÉ** | `StatusV3.md` (servisní tabulka: port 8097, 127.0.0.1, „active — fund tracker live on Edge") |
| HTTP API na `127.0.0.1:8097`, nginx proxy `/api/issobella/` | **ŽIVÉ** | `StatusV3.md` 2026-08-23 (port 8097 kvůli konfliktu se ZIS na 8096) |
| Tracker skenuje coinbase a vystavuje zůstatek / návrhy / metriky fondu | **ŽIVÉ** (read-only) | `V31/L6/issobella/` (zdroje + `V31/L6/issobella/docs/CLI.md`, `V31/L6/issobella/docs/FINANCOVANI.md`) |
| Tracker může vyplácet / podepisovat výdaje | **NEPLATNÉ TVRZENÍ** | G10: read-only režim; žádná automatická dispozice |
| Veřejný portál / dashboard L6 dat | **STAVBA** | Dashboard (`ZION_OS/dashboard/app.py`, `MissionControlDashboard`) zobrazuje L6 metriky operátorům; veřejný přístup chybí |
| API-key enforcement | **STAVBA** | Uvedeno jako chybějící v README této knihy (srov. BodhiGaia) |
| Postava Stříž, „věž na okraji osady" | **MÝTUS** | Narativní stylizace pro tuto knihu |

---

*„Strážce, který jen čte, nemůže vydávat přání za fakt."*

**Navigace:** [← Kapitola 6: Pět procent nahoru](./06-Pet-Procent-Nahoru.md) · [Kapitola 8: Zrcadlo →](./08-Zrcadlo.md)
