# Mise Amenti — Changelog

Tento changelog je součástí kanonu. Zachovává důvod změny, ne jen seznam souborů. Pokud změna opravuje veřejné nebo technicky významné tvrzení, musí odkazovat na příslušnou evidence položku v [`07-Registr-Dukazu.md`](./07-Registr-Dukazu.md).

---

## 2026-08-31 — Kanonizace 3.3 „Nirvana“

### Přidáno

- `README.md` a `README_EN.md` jako kanonický vstupní bod pro Mise Amenti.
- `01-Kanon-a-Ustava.md` — hierarchie pravdy, pět stavů tvrzení a závazek svobody/ověřitelnosti.
- `02-Pribeh-a-Architektura.md` — společná mapa čtyř knih, onboardingu, Sůl Země, Nirvany a NirvanaCloud.
- `03-Zivy-Zaklad-3.3.md` — L1–L6 baseline rozdělený na ŽIVÉ / STAVBA / HORIZONT / HYPOTÉZA.
- `04-Exekucni-Charta-3.3.md` — workstreamy M0–M8 a release gates R1–R9.
- `05-Autonomie-a-Bezpecnost.md` — lidský mandát, capability model, hard prohibitions a agentní incident response.
- `06-Generacni-Kompas-2026-2126.md` — mezigenerační kompas, krizová mapa a scénářové epochy.
- `07-Registr-Dukazu.md` — důkazní registry pro L1–L6 a reconciliation předchozích 3.3 nároků.
- `08-Protokol-Zmen.md` — klasifikace změn, review, veřejný filtr a předání dalším maintainerům.

### Kanonické rozhodnutí

- `MiseAmenti/` je **primární integrační canon** pro plánování a komunikaci ZION 3.3 „Nirvana“.
- `V33_NIRVANA_MASTER_PLAN.md` zůstává technickým execution companionem; živý kód, síť, `StatusV3.md` a `V31/STATUS.md` nadále mají vyšší prioritu.
- Příběhové materiály `docs/WP-Mainet/nirvana/` a `docs/WP-Mainet/NirvanaCloud/` zůstávají kanonickým narativním zdrojem, ale jejich faktické nároky se interpretují podle evidence registru.

### Opravené vymezení nároků

- Passkeys/WebAuthn, full multichain, production solver federation, Hiran v2.5 autonomy, UE5.7/WebGPU/Pixel Streaming, globální L5 portal a quantum/warp engine jsou vedeny jako **STAVBA, HORIZONT nebo HYPOTÉZA**, nikoli jako live feature.
- 1% coinbase slot je popsán podmíněně: **burn před node-reward activation, node reward po aktivaci**, podle aktuální konfigurace a on-chain evidence.
- „Global Assimilation“ je definována pouze jako **dobrovolná interoperabilita a spolupráce**, nikdy jako donucování nebo kulturní nadřazenost.
- „Consciousness“ u AI je výhradně narativní/etická metafora; canon netvrdí prokazatelné subjektivní vědomí softwaru.

### Kanonická integrace s existujícími dokumenty

- `V33_NIRVANA_MASTER_PLAN.md` — upraveno na technický execution companion; přidána čtecí smlouva, statusové štítky L2–L6 a odkaz na `MiseAmenti/07-Registr-Dukazu.md`.
- `ROADMAP.md` — přidán odkaz na `MiseAmenti/` a upřesněn rozdíl mezi live baseline 3.2 a vývojovým horizontem 3.3.
- `docs/WP-Mainet/nirvana/00-README.md` a `00-README_EN.md` — označeny jako MÝTUS-HORIZONT a propojeny s `MiseAmenti/` a `StatusV3.md`.
- `docs/WP-Mainet/NirvanaCloud/00-README.md` a `00-README_EN.md` — převedeny na narativní společník s hierarchií důkazů vedenou `MiseAmenti/`.
- `docs/WP-Mainet/NirvanaCloud/08-Kotva-Pravdy-Eticke-Hranice.md` — doplněn odkaz na `MiseAmenti/07-Registr-Dukazu.md` jako kotva technické pravdy.
- Vytvořen `docs/3.1/REPORTS/README.md` jako index historických reportů; opraven jeden rozbitý odkaz v `REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md`.
- Cílený link check kanonických dokumentů a `git diff --check` proběhly bez nálezů.

---

## 2026-09-02 — Bodhi Gaia: Kniha Země (L5) — DRAFT navržený ke kanonizaci

### Změněno

- Přidána nová narativně-technická řada [`docs/WP-Mainet/BodhiGaia/`](../BodhiGaia/00-README.md) (CZ, 9 kapitol + EN index): Zahrada Genesis, Dharma Temple / Nová Bodhi Gaia, Te Pīko Ora, Protokoly Země, zrcadlo L4 ↔ L5, onboarding do L5 a úplný L5 registr pravdy. Řada sjednocuje existující materiál z `public/V3/L5/docs/`, webu `/terranova/*` a `/l5-free-world`, OASIS (`WorldPanel`, `worlds.ts`), Sůl země (Sítá, Hanuman), TerraNova (kap. 3, 6, Hawaii) a Zohar (Yesod ↔ L5).
- `docs/WP-Mainet/README.md` — řada přidána do sekce „Koncepty a horizont (nekanonické)".
- `docs/WP-Mainet/nirvana/00-README.md`, `00-README_EN.md`, `10-Prameny-Zivota.md` — odkaz „sestup k hlíně" na Knihu Země.
- `07-Registr-Dukazu.md` — sekce 5 rozšířena o L5 řádky (komunity, Guardian Node, OASIS zrcadlo, dopad) s odkazem na detailní registr v `BodhiGaia/09`.
- `02-Pribeh-a-Architektura.md` — přidána devátá brána „Bodhi Gaia / Kniha Země" do mapy bran.

### Důkaz

- L1: `V31/L1/core/src/{emission,v3_template,v3_compat}.rs` (5 % → `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8`).
- L5 služba: `V31/L5/free-world/` (`config.rs` má kanonický default, `db.rs` tabulky `grants/projects/communities/fund_balance`), `zion-v31-free-world.service`, `StatusV3.md` 2026-08-23, `docs/3.2/L5_L6_ACTIVATION_PLAN.md` (G10).
- Komunity: `public/V3/L5/docs/COMMUNITIES/{genesis-garden,dharma-temple,te-piko-ora}.md`; web `APP&WEB/website-v2.9/src/app/terranova/**`, `public/docs/terranova/dharma-temple.{cs,en}.md`; OASIS `APP&WEB/OasisWeb/src/components/WorldPanel.tsx`, `src/domain/config/worlds.ts`.

### Dopad na stav tvrzení

- Nové L5 nároky zavedeny se stavem: protokol/fond/tracker **ŽIVÉ**; Zahrada Genesis **STAVBA**; Dharma Temple **STAVBA (dokumentace) / HORIZONT (fyzicky)**; Te Pīko Ora **HORIZONT**; sdílené protokoly (Guardian Node, mesh, Medical Table, Seed Library síť) **HORIZONT**; Resonance Protocol **MÝTUS / HORIZONT**; „fond vyplácí granty" a „komunity provozují Guardian node" **NEPLATNÝ NÁROK (dnes)**; ekonomické modely komunit **HYPOTÉZA**; příběh a symbolika **MÝTUS**.
- Nalezené rozpory k opravě (registr v `BodhiGaia/09` §4): TerraNova kap. 6 uvádí 10 % místo 5 % + 5 %; `/l5-free-world` lokalita Genesis „Střední Evropa" vs Algarve; OASIS svět Dharma Temple `layer: 3` místo L5; Te Pīko Ora Tahiti vs Raiatea; komunitní dokumenty datované 2026-05-21 bez evidence sekce; Nirvana ep. 10 statická čísla; inventář `L5_L6_ACTIVATION_PLAN.md` §4.2/§5 neodpovídá již opravenému kódu.

### Review

- Autor: Devin (AI) na základě čtení kódu, dokumentace, webu a OASIS klienta. **Řada je DRAFT** — vyžaduje technické review (L1/L5 fakta), bezpečnostní review (fond/DAO/API), factual editor a kulturní konzultaci (polynéské a buddhistické prvky) podle `08-Protokol-Zmen.md` §2 (třída E + C) před kanonizací nebo jakýmkoli veřejným výňatkem.

---

## Formát budoucích položek

```markdown
## YYYY-MM-DD — stručný název

### Změněno
- Co se změnilo.

### Důkaz
- Odkazy na code/test/live evidence.

### Dopad na stav tvrzení
- ŽIVÉ → STAVBA, STAVBA → ŽIVÉ atd.

### Review
- Kdo a jaký typ review provedl.
```

---

*[Zpět na index Mise Amenti → `README.md`](./README.md)*
