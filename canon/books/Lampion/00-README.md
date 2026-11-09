# LAMPION — Druhá lucerna
## Příběh a vzkaz k lampionu Lumi 2

> **Stav:** DRAFT — nová narativní řada (MÝTUS), navržená ke kanonizaci podle [`MiseAmenti/08-Protokol-Zmen.md`](../MiseAmenti/08-Protokol-Zmen.md). Třída E (kulturní / veřejná komunikace) pro biblickou pasáž; třída C tam, kde text mluví o prodeji.
> **Vytvořeno:** 2026-11-08 pro fyzický produkt `lamp-001` (Lampion – Království srdce / Lumi 2).
> **Místo v kompasu:** **přívěsek k ose.** Kniha Lucerny je svislá čára od hlíny k nebi. Tato kniha je jeden večer na té čáře: dílna, prkno, světlo — a cesta zpátky do dneška.
> **Navazuje na:** [`KralovstviSrdce/10-Epilog`](../KralovstviSrdce/10-Epilog-Kde-Lod-Kotvi.md) (scéna za domem: prkno mezi tesařem a Lumi), [`Lumi/01`](../Lumi/01-Dite-na-Pridi.md) (lucerna a plamen Ekam), [`Lumi/11`](../Lumi/11-Sto-Let-Lucerny.md) (lucerna se nedědí, nese), [`KruhBohyni/00-LODE-A-LUCERNA`](../KruhBohyni/00-LODE-A-LUCERNA.md) (§3 — přesný mechanismus lucerny).
> **Jazyk:** čeština (kanonická). Anglické texty v [`04`](./04-Texty-Pro-Prodej.md) jsou **kandidáti** pro e-shop, ne překlad knihy.

---

## Co je tato kniha?

Tři kapitoly pro čtenáře a tři pracovní texty pro prodej a výrobu. Dohromady odpovídají na jedinou otázku, kterou zákazník položí, když lampion rozbalí:

> *„Co to vlastně držím v ruce?"*

Odpověď korpusu je přesná: **držíš tělo. Světlo si zapálíš sám.**

Tato kniha to vypráví jako pokračování známé scény. V epilogu Nové plavby sedí tesař za domem, opravuje rukojeť dláta, vedle leží krátké prkno a Lumi si přisedne do hoblin. Tesař položí prkno mezi sebe a ni, jeden konec drží on, druhý zůstane volný, děvčátko ho vezme — a teprve potom začne řezat. Kniha Království srdce tam končí.

Tato kniha začíná přesně tam: **co z toho prkna vzniklo.**

## Jak číst

Příběh má tři délky. Všechny tři říkají totéž; liší se jen tím, kolik večera jim dáš.

| Délka | Kde | Pro koho |
|---|---|---|
| **Vzkaz** — dvě věty a verš | [`01-Vzkaz.md`](./01-Vzkaz.md) | do krabice, na kartu, na štítek |
| **Příběh** — jeden večer | [`02-Druha-Lucerna.md`](./02-Druha-Lucerna.md) | pro toho, kdo si lampion složil a sedí u něj |
| **Kotva** — co je Písmo a co obraz | [`03-Kotva-Pravdy-a-Hranice.md`](./03-Kotva-Pravdy-a-Hranice.md) | pro toho, kdo se ptá, na čem to stojí |
| **Texty pro prodej** — hotové pasáže | [`04-Texty-Pro-Prodej.md`](./04-Texty-Pro-Prodej.md) | pro e-shop, e-mail a obal |
| **Šest stěn** — šest krátkých kapitol | [`05-Sest-Sten.md`](./05-Sest-Sten.md) | k mandalám na stěnách; na web i na kartu |
| **Marketingový hřbet** — jak prodat | [`06-Marketing.md`](./06-Marketing.md) | hero, karta, reklamy, e-mail, námitky, CTA |

## Tři věty, které drží celou knihu

1. **Tesař neořezává dřevo podle své ruky, ale podle světla.** Míra, kterou drží ruka, umře s tou rukou. Míra, kterou drží světlo, se dá zopakovat kdekoli.
2. **Tělo se opotřebí. Světlo ne.** Proto může existovat druhá lucerna — a proto se jí říká *druhá*: není to nová věc, je to nové tělo pro touž míru.
3. **Světlo se nepředává hořící. Předává se jako míra.** Kdo ho dostane, zapálí si vlastní svíčku. To není menší zázrak. To je jediný, který se nedá ukrást.

## Co tato kniha není

- **Není biblický text.** Verš z Jana 12,35 je Bible. Stavba lucerny v nazaretské dílně je literární obraz — Písmo o ní nevypráví. Rozdíl je vypsaný v [`03`](./03-Kotva-Pravdy-a-Hranice.md).
- **Není tvrzení o historickém Ježíši.** „Nová vrstva" (že věta z Jan 12,35 byla nejdřív řečena dítěti s lucernou) je rozhodnutí příběhu, stejné jako setkání s Tres Marías v [`KralovstviSrdce/09`](../KralovstviSrdce/09-Flotila-se-Schazi.md).
- **Není magie.** Fyzický lampion nesvítí „z budoucnosti". Svítí svíčkou, kterou zapálí člověk. Kdo tvrdí víc, prodává relikvii.
- **Není bezpečnostní návod.** Bezpečnost drží jediný soubor `apps/MarketPlace/src/lib/fire-safety.ts`. Tato kniha smí vysvětlit, *proč* je lampion tak udělaný; nesmí nahradit body, které zákazník podepisuje u pokladny.
- **Není náhrada registrů.** Kde se liší od [`StatusV3.md`](../../../docs/3.2/StatusV3.md), rozhoduje `StatusV3.md` a živý produkt.

## Živé zdroje pravdy

- **Produkt:** [`apps/MarketPlace/src/data/christmasProducts.ts`](../../../apps/MarketPlace/src/data/christmasProducts.ts) (`lamp-001`, pole `story` s textem ze [`04`](./04-Texty-Pro-Prodej.md)), návod na složení v témže souboru (`guide`), bezpečnost [`apps/MarketPlace/src/lib/fire-safety.ts`](../../../apps/MarketPlace/src/lib/fire-safety.ts)
- **Kde se to vykresluje:** `/vanoce/lampion`, sekce `#pribeh` (`apps/MarketPlace/src/components/xmas/XmasProductPage.tsx`) — mezi detaily a návodem na složení
- **Model a výroba:** [`apps/MarketPlace/public/models/README.md`](../../../apps/MarketPlace/public/models/README.md); skript `scripts/ops/lumi-glb-optimize.sh`; měření drah `scripts/ops/lumi-cut-length.py`
- **Předchozí scéna:** [`KralovstviSrdce/10-Epilog`](../KralovstviSrdce/10-Epilog-Kde-Lod-Kotvi.md) · [`Kralovstvi_srdce_Nova_plavba.md`](../KralovstviSrdce/Kralovstvi_srdce_Nova_plavba_Balicek/Kralovstvi_srdce_Nova_plavba.md) („A teprve potom začal řezat.")
- **Mechanismus lucerny:** [`Lumi/01`](../Lumi/01-Dite-na-Pridi.md) · [`Lumi/11`](../Lumi/11-Sto-Let-Lucerny.md) · [`KruhBohyni/00-LODE-A-LUCERNA`](../KruhBohyni/00-LODE-A-LUCERNA.md) §3
- **Registr důkazů:** [`MiseAmenti/07-Registr-Dukazu.md`](../MiseAmenti/07-Registr-Dukazu.md)

---

*„Tělo se opotřebí. Světlo ne."*
