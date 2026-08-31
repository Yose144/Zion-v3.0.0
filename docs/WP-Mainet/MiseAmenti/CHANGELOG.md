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
