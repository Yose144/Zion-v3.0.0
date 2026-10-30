# QV Voting — Sybil model, eligibility a privacy analýza (6.B3)

**Datum:** 2026-10-30 · **Autor:** Devin · **Scope:** `V31/L5/free-world` + web proxy
**Účel:** povinná analýza před prvním *reálným* (ne testovacím) ballotem — QV je zatím advisory, peníze tečou přes DAO submit path s lidským schválením.

## 1. Reálný stack (code-verified)

| Vrstva | Soubor | Chování |
|---|---|---|
| QV logika | `V31/L5/free-world/src/quadratic.rs` | čisté funkce: cena ballotu Σv², validace (empty/dup/unknown/zero/over-budget/overflow), tally, water-filling alokace se stropem `requested_zion`, deterministická |
| Daemon API | `V31/L5/free-world/src/api.rs` | `POST /api/v1/rounds/:id/ballots` vyžaduje `require_write_key` (operátorský `X-API-Key`); `voter_id` = volný string 1–128 znaků; `qv_upsert_ballot` = **jedna řádka per (round, voter_id)** — opětovné hlasování přepíše ballot |
| Veřejný povrch | `apps/website-v2.9/src/app/api/free-world/[[...path]]/route.ts` | GET public; POST jen `rounds/<id>/ballots`; vyžaduje ZIS session; **`voter_id = zis:<user.id>` vázán server-side** (klient posílá jen `votes`); API klíč z env; žádný rate-limit v proxy |
| UI | `QvSection` na `/l5-free-world` | otevřené kolo, 6 grantů, ZIS gate |

**Důsledek:** veřejně jde hlasovat pouze přes ZIS session; `voter_id` nemůže klient podvrhnout. Sybil odolnost QV = **Sybil odolnost ZIS účtů**.

## 2. Sybil model

### Co dnes brání Sybilu
- 1 ballot per `zis:<user.id>` per round (upsert — žádné duplicitní hlasy).
- ZIS účet vyžaduje Ed25519/SIWE/Google/WebAuthn registraci — každá cesta má nenulovou cenu (OAuth uniqueness u Google, device binding u passkey).
- QV je **advisory** — disbursement prochází DAO advisory → human-approved grant flow; škoda z poraženého Sybil útoku je omezená na skewed doporučení, ne na přímý převod.

### Aktuální mezery
1. **E-mail self-signup** = nejlevnější Sybil vektor (registrační farma = N identit). Náklady na útok rostou lineárně s počtem falešných účtů, ne kvadraticky — QV samo o sobě to neřeší, protože kredity jsou per-voter, ne per-stake.
2. **Žádný rate-limit** na proxy POST — neznamená hlasovací exploit (voter_id je bound), ale umožňuje spam ballot rewrite/daemon load.
3. **Žádný eligibility gate** — čerstvě vytvořený účet hlasuje okamžitě se stejným rozpočtem jako veterán.
4. **Passkey ≠ uniqueness** — WebAuthn váže zařízení, ne člověka; jeden člověk s N zařízeními/účty stále projde.

### Doporučené eligibility úrovně (před prvním reálným ballotem)
| Úroveň | Gate | Cena Sybilu |
|---|---|---|
| E0 (dnes) | ZIS session | registrace zdarma |
| E1 (minimum pro pilot) | + account age ≥ 14 dní **nebo** passkey bound **nebo** linked `oasisPlayer` | čas/device |
| E2 (reálné prostředky) | + linked ZION address s historií (≥1 tx nebo ≥min balance) **nebo** verified Google | on-chain footprint / OAuth |
| E3 (vysoké částky) | E2 + operátor-allowlist (jury model) | ruční prověrka |

**Doporučení:** první reálný ballot spustit na **E1** (levné na implementaci: proxy zná `user` objekt — stačí `created_at`/passkey-flag z ZIS; změna jen v proxy, daemon netřeba). E2/E3 až pro granty s nenulovým rozpočtem.

## 3. Privacy analýza

| Téma | Stav | Riziko | Doporučení |
|---|---|---|---|
| Identita v daemon DB | `voter_id = zis:<user.id>` persistován v `qv_ballots` | operátor daemonu/DB reader vidí kdo hlasoval jak + korelace napříč koly | **Pseudonymizace per round:** `voter_id = "zis:" + HMAC(round_salt, user.id)` — 1 hlas/osoba zachováno, cross-round korelace a mapování ballot→osoba bez klíče znemožněny. Implementace čistě v proxy |
| Tajnost hlasu | upsert přepisuje ballot → operátor vidí *aktuální* obsah per voter | standardní pro advisory QV; není tajná volba | zdokumentovat v UI copy ("hlas je viditelný provozovateli, agregáty veřejné"); případné commit-reveal až kdyby se vyžadovalo |
| Veřejné výsledky | `GET rounds/:id/results` vrací agregáty + ballot_count | žádné per-voter data neleaknou | ✅ držet — nikdy neexposovat per-voter řádky přes public GET |
| Session/data | proxy předává jen `zis:<id>` upstream | minimální data flow | ✅ |
| Rate limiting | chybí | DoS na write path | per-IP limit v proxy (stejný pattern jako archive pass throttle: 10/min in-memory) |

## 4. Checklist před prvním reálným ballotem

- [ ] E1 eligibility gate v proxy (account age / passkey / oasisPlayer — vybrat 1)
- [ ] Per-IP rate-limit na ballot POST
- [ ] Round-salted voter pseudonymizace (HMAC) — nebo explicitní zdokumentované rozhodnutí proti
- [ ] UI copy: advisory charakter, viditelnost hlasu operátorovi, "1 ZIS účet = 1 hlas"
- [ ] Recorded decision: který grant/pilot, rozpočet, nezávislý ověřovatel (→ 6.B4 impact packet)

## 5. Co záměrně NEŘEŠIT teď

- ZK/anonimní důkaz členství — HORIZONT.
- Commit-reveal tajné hlasování — nepřiměřené pro advisory kolo.
- Plná Sybil rezistence (BrightID/PoP) — mimo scope 3.3; E1–E3 stačí pro pilot.
