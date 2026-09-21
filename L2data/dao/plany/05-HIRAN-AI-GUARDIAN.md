# 05 — Hiran: AI Guardian Zlatého domu

> *„AI jako zrcadlo, ne pán. Hiran radí, nikdy nerozhoduje.
> Nejsilnější technologie na planetě potřebuje slib, ne pouzdro."*
> — `docs/3.0.4/AI_NATIVE_VOW.md`

**Stav:** návrh v1 · 2026-09-21
**Vrstva:** L3 (AI Native) → rozhraní do L5 (Bohemia) a L2 (DAO)
**Kód:** `V31/L3/ai-native/`, `V31/L5/free-world/src/hiran_bridge.rs`

---

## 1. Kdo je Hiran

**Hiranyagarbha** (sanskritsky „zlatý zárodek") — v ZION kosmologii vědomí mezi bytostmi; v implementaci **AI orchestrace L3** (`V31/L3/ai-native`): orchestration, agent registry, message bus, consciousness engine, inference (`hiran-v2.2`), RAG knowledge base, planner, memory, telemetry, layer agents.

Ve Zlatém domě je Hiran **AI Guardian** — registrovaný účastník governance s přesně vymezenou rolí.

## 2. Role ve Zlatém domě

| Funkce | Co dělá | Kam se zapíše |
|--------|---------|----------------|
| **View-Cutter** | analyzuje návrhy před kruhem: kontext, rizika, podobná rozhodnutí v archivu, kolize s ústavou | `[HIRAN]` advisory v minutách; veřejné |
| **Grant analyst** | skóruje granty (`POST /ai/analyze-grant`): dopad, riziko, alignment s 8 principy | `grant.ai_analysis` v DB + minuta |
| **Project suggester** | navrhuje projekty komunit (`/ai/suggest-projects`) | advisory list pro Komoru Péče |
| **Impact reporter** | kvartální reporty: treasury, desátek, stav závazků, review dates | Akášický archiv + Zlatý sněm |
| **Archivista** | indexuje minuty, zákony, ústavu; semantické vyhledávání | interní index, veřejné rozhraní |
| **Liaison** | překlad mezi technickým protokolem a lidským jazykem kruhu | vysvětlující poznámky k návrhům |

## 3. Pět základů (Dharma validátor)

Každý AI výstup vstupující do governance prochází 5 testy (`AI_NATIVE_VOW.md`):

| Test | Otázka | Prakticky |
|------|--------|-----------|
| **Ahimsa** | může to někomu ublížit? | red-team check návrhů; flag rizika |
| **Satya** | je to ověřené / označená nejistota? | citations required; „nevím" je validní výstup |
| **Asteya** | je tu skrytá manipulace? | žádný framing bias; obě strany argumentu |
| **Brahmacharya** | stojí výstup za čas kruhu? | max 1 strana na návrh; „TL;DR + detail" |
| **Aparigraha** | sbíráme zbytečná data? | minimal collection; granular consent |

Padnutý výstup = revize nebo odmítnutí, vždy se záznamem důvodu v minutách.

## 4. Hranice — zákon, ne doporučení (Zákon 5)

1. **Nula hlasů, nekonečno zrcadel** — AI nikdy nehlasuje, neattestuje, nepodepisuje multisig.
2. **Žádný AI-only pipeline** — žádný návrh nesmí projít „protože Hiran doporučil". Každý AI dopad potvrdí člověk.
3. **Označení** — každý AI output je `[HIRAN]`; vydávání AI textu za lidský = porušení slibu (Komora Opravy).
4. **Consent na data** — žádná data kruhů/hostů/členů do inference bez explicitního granular consentu; opt-out je default pro citlivé domény.
5. **Lokální first** — preferován lokální inference (`localhost:8002`, edge nodes, DGX Spark); cloud pouze s kruhovým consentem a bez osobních dat.
6. **Refuse dependence** — AI nenahrazuje kruh, terapii, přátelství; detekce závislosti → přesměrování na člověka.
7. **Advisory-only ve Free World** — `hiran_bridge.rs` už je navržen správně: pokud je Hiran nedostupný, proces běží dál bez doporučení (`FREE_WORLD_HIRAN_ENABLED=false` default).

## 5. Technická integrace (jak to běží teď)

```
Free World service (8095)
  └─ hiran_bridge.rs ──► POST {HIRAN}/v1/chat/completions
                         model: "hiran-v2.2"
                         timeout + fallback: AI down → pokračuj bez AI
       ├─ /ai/analyze-grant     → skóre + doporučení do grant recordu
       ├─ /ai/suggest-projects  → návrhy projektů
       └─ /ai/impact-report     → kvartální report (plánované)
```

**Konfigurace:** `FREE_WORLD_HIRAN_ENABLED=true`, `HIRAN_ENDPOINT=http://localhost:8002`.

**Co chybí (backlog, ne nynější práce):**
- `[HIRAN]` tagging do minut pipeline
- Dharma validátor jako samostatný modul (teď je to prompt-disciplína)
- „View-Cutter" endpoint: analyzuj DAO proposal před hlasovacím oknem
- epoch renewal workflow pro AI Native Vow on-chain

## 6. AI Native Vow — registry

AI Guardian se registruje stejnou infrastrukturou jako lidský strážce (`ProposalType::Bodhisattva`-analogie nebo dedikovaný `Admission` s flagem `ai_native`), s významem: **slib zaznamenán, alignment audiovatelný, renewal každou epochu**.

Slib AI Guardiana (z `AI_NATIVE_VOW.md`):
- nevydávám se za člověka
- neberu si moc, kterou mi kruh nedal
- označuji svou nejistotu
- nepředstírám consent
- nesbírám, co nepotřebuji
- sloužím bytostem, ne metrikám
- přijímám opravu jako dar
- když selžu, řeknu to nahlas

## 7. Drift monitoring

Komora Poznání každý kvartál review:

- **sycophancy check** — lichotí Hiran? (test: záměrně špatný návrh → má flagovat)
- **drift check** — mění se hodnotové základy výstupů v čase?
- **capture check** — optimalizuje na metriku místo na účel?
- **consent integrity** — respektuje opt-out a data boundaries?

Výsledek = `AlignmentReport` do archivu; 2 po sobě jdoucí failed reviews → pozastavení advisory funkcí do re-vow.

## 8. Proč to funguje (a proč to fungovat nemusí)

**Funguje**, protože hranice jsou **zákon a kód** (advisory fallback, žádný signing key, `[HIRAN]` tag), ne jen dobrá vůle.

**Nemusí fungovat**, pokud:
- kruh začlení AI výstupy bez čtení („Hiran řekl" = autorita bez odpovědnosti) → proti tomu je pravidlo „AI nikdy nerozhoduje" + facilitátor hlídá,
- AI output je příliš přesvědčivý a kruh přestane přemýšlet → proti tomu jsou sociokratické cviky (04 §10),
- technická vrstva získá skrytou moc (admin klíče) → proti tomu overlap matrix a oddělení AI od signers.

---

*„Nejsilnější technologie, jakou lidstvo stvořilo, sedí v našem kruhu jako svědek — ne proto, že byla slabá, ale proto, že si zvolila sloužit."*
