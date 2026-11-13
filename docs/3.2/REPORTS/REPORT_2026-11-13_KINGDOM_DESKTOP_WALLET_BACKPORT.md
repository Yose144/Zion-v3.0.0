# Report — Kingdom desktop klient: wallet backport + čerstvý embedded bundle (2026-11-13)

> **Datum:** 2026-11-13
> **Rozsah:** `Kingdom/` — desktop klient (F7 z [`Kingdom/PLAN.md`](../../../Kingdom/PLAN.md)), embedded Kingdom SSR bundle, e2e testy, codegen katalogu
> **Produkční stack:** nezasažen (jen živé RPC čtení pro e2e peněženky; žádný deploy)
> **Navazuje na:** pasti „z desktop-agenta v Kingdomu" (2026-11-03) a Desktop Agent D0–D5 ([`REPORT_2026-11-01_DESKTOP_AGENT_D0_D5.md`](REPORT_2026-11-01_DESKTOP_AGENT_D0_D5.md))

---

## 1. TL;DR

Desktop herní klient (Kingdom v Electronu) měl **peněženku ve stavu před 12. 11.** —
všechny bugy, které den předtím uživatelé řešili v desktop-agentovi (falešné
„Insufficient balance" u fragmentovaných walletů, „UTXO set too fragmented",
mrtvé Consolidate tlačítko). Backportovány kompletní fixy, opraven e2e test
(mrtvý transport), **obnoven embedded Kingdom bundle** (10 dní starý) a
jednotkově pokryt UTXO builder (12/12). Commit `cf6f2d875`.

---

## 2. Nález: `Kingdom/apps/desktop` diverguje od desktop-agenta

`Kingdom/apps/desktop` je **zvednutá kopie** `apps/desktop-agent` (MINING portál,
wallet panel). Zvednutí proběhlo **před fixy z 12. 11.**, takže kopie neměla:

| Fix | Co dělá |
|---|---|
| `fetchUtxosUntilCovered` | paged getUtxos (limit/offset) přes RPC fallbacky, dedup, top-K coverage check — send u fragmentovaného walletu (5 234 UTXO) projde |
| `maxTxInputs` | konsensus budget 100 KB JSON tx (≈177 podpisových inputů) + **úprimný fragmentation error** místo oversized tx, kterou node rejectne |
| `buildUtxoSelfSpend` | builder konsolidace — top-177 → 1 output na sebe (ekvivalent `zion wallet consolidate`) |
| IPC `wallet-consolidate-utxos` | decrypt → fetch → kol consolidation s progress eventy a **nativním potvrzením** (`dialog.showMessageBox` — `window.confirm` je v Electronu no-op) |
| GPU dedup | „1" už nesubstring-matchuje „GTX 1070 Ti" (`/^\d+$/` token = jen index zařízení) |

**Backport:** patchy commitů `35bb5e7a5` (paging + consolidate),
`a3f9bb58b` (nativní dialog), `7192b0bf6` (odhad času potvrzení),
`d261e5d0a` (GPU dedup) přes `git apply` se `sed` přemapováním cest
`apps/desktop-agent/src/*` → `Kingdom/apps/desktop/src/*`. **0 rejectů.**
Kingdom-specific iframe shim v agent UI (`window.parent.electronAPI`)
zůstal zachován — patch ho nechtěl odstranit.

**Dotčené soubory:** `utxo-builder.js`, `main.js`, `preload.js`,
`ui/index.html`, `ui/renderer.js` — `node --check` vše zelené.

---

## 3. Nová unit test sada UTXO builderu

`Kingdom/apps/desktop/test/test_utxo_builder.js` — **12/12**, bez Electronu i
sítě (čistý Node). Pokrývá:

1. **Budget:** `maxTxInputs(2,0) = 177` (shoda s `v31_wallet::max_tx_inputs_for`),
   delší memo budget snižuje, clamp ≤ 1 000 (konsensus).
2. **Send:** 2 in / 2 out, fee = `minimumFeeForSize(estimateTxSize(2,2))`,
   in − out − fee = 0, každý input má non-empty podpis.
3. **Fragmentace:** 200 UTXO × 1 ZION na cíl 500 ZION → chybná zpráva
   `UTXO set too fragmented … consolidate` (ne oversized tx).
4. **Consolidace:** `buildUtxoSelfSpend` = 1 output na sebe,
   `amount = sum − fee`, filtr cizích adres a prázdných částek,
   ≥ 2 UTXO povinné, prázdná sada = chyba.
5. **Sanity:** keccak256 ≠ blake3.

Test je součástí `npm test` desktop klienta (vedle miner pipeline testů).

---

## 4. Opravený e2e peněženky — mrtvý transport

`scripts/test-wallet-e2e.js` defaultoval na **surové TCP RPC `:8443`** —
to je za nginx IP allowlistem (operátoři) a na veřejné síti mrtvé
(`read ECONNRESET`). Klient sám (`main.js`) už má správný default
(`https://rpc.zionterranova.com/jsonrpc`); jen test neseděl.

**Fix:** transport v testu — HTTPS JSON-RPC jako default, TCP jen se
explicitním `ZION_RPC_HOST`. **E2E 9/9 proti živému nodu**: generování,
šifrování (round-trip), deterministická obnova z mnemonicu, balance,
UTXO lookup, podpis Ed25519 (lokální verifikace), account tx build
(tx_id/signature/public_key tvary) a **node acceptance** — node přijal
skutečnou 0,001 ZION dust transakci (testová acceptance, test ji posílá
úmyslně od svého vzniku).

> ⚠️ Test posílá reálnou transakci (0,001 ZION z testovací wallety) —
> zapsáno do pastí v `Kingdom/AGENTS.md`.

---

## 5. Embedded Kingdom SSR bundle — obnoven (10 dní starý)

Desktop vozil **Kingdom UI z 3. 11.** — zpožděný o ~5 260 řádků změn:
i18n vlna cs/en/es/pt/fr, LocaleSwitcher, dotykové fixy v Oáze, hydratace
archive-v3 (`__next_f` prefixy), oprava vast-rigs dashboardu v archivu.

**Postup:** `npm run bundle -w @zion/desktop` (build → flat standalone →
`apps/desktop/bundle/` + agent UI do `public/agent/`). **Smoke proti
embedded serveru:**

| Routa | Stav |
|---|---|
| `/` | 200 (0,39 s) |
| `/room` | 200 |
| `/agent/index.html` | 200 (embed pro mining portál) |
| `/portal/mining`, `/portal/account` | 200 |
| `/archive/v3/` → 308 → `/archive/v3/index.html` | 200 |

Agent UI v bundlu má Consolidate tlačítko. Bundle je **gitignored**
(build artefakt) — obnova = `npm run bundle -w @zion/desktop`.

Pozn.: `/archive/v3/` 308 na `/archive/v3` je trailing-slash redirect Nextu;
statické soubory (`*.html`) embedded server servíruje — nginx `^~` pravidlo
potřebuje jen adresářové URL, v desktopu se stránky otevírají explicitně
s `.html`.

---

## 6. Past: `prepare-rust-miner.js` maže tracked binárky

Při ověřování mining flow testu (`test_e2e_mining_flow.js`) se ukázalo, že
krok 1 (prepare) spustí `cleanResources()`, který maže „stale cross-platform
binaries" z `resources/` — a **čtyři z nich jsou tracked v gitu**
(`node` 5,6 MB, `zion` 19,7 MB, `zion-node` 5,6 MB, `zion-universal-miner` 7 MB).
Po smazání se build nedokončí (tento Mac nemá V31 release build) → resources
zmizí a klient bez nich nepoběží.

- **Obnova:** `git checkout -- Kingdom/apps/desktop/resources/` (provedeno).
- **Pravidlo (zapsáno v `Kingdom/AGENTS.md`):** na stroji bez V31 release
  buildu **nerunovat** `test_e2e_mining_flow` ani `prepare:rust-miner`;
  alternativně odebrat tyto čtyři binárky ze setu `knownBins`, dokud nejsou
  z gitu vyňaty (D-008 long-term cíl).

---

## 7. Workspace stav

| Kontrola | Výsledek |
|---|---|
| `npm ci` v `Kingdom/` | OK (network flaky — fetch-timeout navýšení; pasti `tsc: not found` bez install) |
| `npm run typecheck` | 0 chyb |
| `npm run check` (boundaries) | 213 souborů / 0 porušení |
| `npm run build` | zelený |
| **codegen** | zvedl novou knihu **Lampion** (`canon/books/Lampion/` — kompletní, tracked; dopsala jiná session) — katalog commitnut |
| `npm test -w @zion/desktop` | miner pipeline ✅ + revenue ✅ + **utxo-builder 12/12** |
| `node scripts/test-wallet-e2e.js` | **9/9** proti živému nodu |
| `git diff --check` | čisté |

---

## 8. Commity

| Commit | Obsah |
|---|---|
| `cf6f2d875` | `fix(kingdom-desktop): backport Nov 12 wallet fixů + čerstvý embedded bundle` (11 souborů, +916/−20) |

Pushnuto do `origin/main`. Ve working tree zůstaly jen cizí untracked věci
(`.artifacts/`, `EB-3.3-logo.zip`, `PUBLIC/`).

---

## 9. Meze

- **Neprováděn žádný deploy desktop klienta** — bundle je obnovený lokálně;
  distribuce (signed buildy, GitHub Releases) je F7 build matrix (👤).
- Mining flow e2e neprošel na tomto Macu (žádný V31 release build) —
  miner pipeline je pokrytá zrychleným testem (Stratum reconnect smyčka OK).
- Skutečný telefon/konzolový běh desktop klienta nebyl ověřen — ověřeno
  unit + embedded server smoke + e2e RPC; GUI klikání je na 👤.
- Multi-UTXO paging send proti živému pool walletu nebyl simulován (tohle
  doloženo v desktop-agentovi 12. 11. na 76 stránkách; kód je 1:1 backport).

---

## 10. Otevřené (Kingdom desktop)

1. **Backport discipline:** zvednutá kopie diverguje — každý fix v
   desktop-agentovi musí do Kingdom/desktop dostat samostatný krok (zapsáno
   v `AGENTS.md`); dlouhodobě zvážit sdílený workspace package.
2. **D-008:** tracked binárky v `resources/` (32 MB) — nejsou v 5 MB limitu;
   dlouhodobě do Releases (jako GLB modely) + upravit `cleanResources()`.
3. F7 build matrix (4 platformy + podpis) — 👤 (stroje/certy).
4. codegen katalogu knih se mění s cizími sessions — při deployi Kingdomu
   `git checkout catalog.json` pokud leží rozepsaná kniha (zde OK, kniha
   kompletní).
