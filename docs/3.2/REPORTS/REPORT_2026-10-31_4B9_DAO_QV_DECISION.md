# 4.B9 — DAO kvadratické hlasování: rozhodnutí

**Datum:** 2026-10-31 · **Audit item:** 4.B9 · **Verdikt: DECIDED — DAO zůstává stake-weighted, QV = advisory**

## Audit scope

> „DAO kvadratické hlasování: implementovat ve `voting.rs`, **nebo** rozhodnout, že QV zůstává advisory v L5 kolech a DAO je stake-weighted."

## Rozhodnutí

**Binding DAO hlasování zůstává stake-weighted (1 ZION = 1 vote).** Kvadratické vážení se NEimplementuje do `voting.rs` pro binding hlasy — a zůstává v advisory roli, kde už dnes existuje (`consent.rs` quadratic consent pro expulsion-typ rozhodnutí).

## Odůvodnění

### 1. Naivní QV na pseudonymním chainu je *horší* než lineární — sybil

Quadratic voting weight = √balance. Bez identitní vazby je to přísně zranitelné:

- Whale s balance `w` rozloží stake do `N` wallets → celková síla = `N·√(w/N) = √w·√N` — **√N amplifikace**, ne omezení
- Lineární model whale rozkladem nic nezíská (`N·(w/N) = w`)
- ⟹ Naivní QV *odměňuje* wallet splitting — přesně opak zamýšleného anti-whale efektu

QV smysluplně funguje jen jako **1 person = 1 voice** s identitním anchor (proof-of-personhood / ZIS-binding povinný pro votery).

### 2. ZIS binding existuje, ale není mandatory

`zis.rs` umí resolve ZIS session → identita existuje, ale DAO voting nevyžaduje ZIS binding. Zavedení binding QV by buď:
- (a) nechalo sybil díru otevřenou (QV bez identity), nebo
- (b) vyžadovalo ZIS pro všechny DAO votery = **participation regression** — stakeloci bez ZIS by ztratili binding hlas

Ani jedna varianta není přijatelná pro beta governance.

### 3. Advisory QV už existuje a pokrývá use-case

`consent.rs` implementuje quadratic consent pro expulsion-typ rozhodnutí (vážení attestations podle conviction/pořadí, `quadratic_weight` + `check_quadratic_consent` s objection-pause sémantikou) — přesně advisory/komunitní role, kterou audit zmiňuje pro L5 kola. Zde QV dává smysl, protože attestors jsou známé entity (guardians), ne pseudonymní wallets — sybil surface je kontrolovaný členstvím.

### 4. Stake-weighted je koherentní s treasury/fee governancem

Binding hlasy rozhodují o treasury, parametrech a fee — „skin in the game" model, kde váha = ekonomická expozice je záměrná konvence (stejně jako u většiny on-chain DAO). QV by navíc změnilo sémantiku `weight` pole napříč DB/API/UI — breaking surface bez dokázaného bezpečnostního zisku (viz bod 1).

## Co se NEZMĚNILO (a proč)

- `voting.rs` — binding cesta beze změny sémantiky; přidán pouze modulový doc komentář s rozhodnutím + odkazem na tento report (audit-stop pro další reviewery)
- `consent.rs` — quadratic consent zůstává jako advisory mechanismus
- Žádná změna konsenzu/governance pravidel — rozhodnutí je dokumentační, ne kódové

## Revisit podmínka (kdy se téma otevře znovu)

Zvážit sqrt-weighted **advisory** polly pro L5 komunitní kola (prioritizace, sentiment — ne binding) **pouze** pokud:
1. ZIS binding bude pro účastníky povinný (sybil vzdor), a
2. poll bude explicitně advisory (výstup nevykonává treasury/parametr změny)

Binding QV bez proof-of-personhood zůstává zamítnuté — matematicky slabší než současný model.

## Ověření

- `cargo test -p zion-dao voting` — 4/4 ✅ (beze změny chování)
- Diff = 1 doc-comment blok v `voting.rs`, žádná funkcionální změna
