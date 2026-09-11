# ZION Issobella — L6 Dokumentace

> *"Hvězda není cíl — je začátek."*

Tato složka je primárním zdrojem pravdy pro L6 vrstvu ZION TerraNova V31 Mainnet Alpha. Integruje vizuální popisy, technickou dokumentaci, financování a časovou osu.

---

## Struktura dokumentace

| Soubor | Obsah |
|--------|-------|
| [`STANICE_ISSOBELLA.md`](STANICE_ISSOBELLA.md) | Filozofie, symbolika, mise, koncept stanice, kosmická rodina |
| [`FINANCOVANI.md`](FINANCOVANI.md) | Zdroje financování, fee split, rozpočet, tokenomika |
| [`CASOVA_OSA.md`](CASOVA_OSA.md) | Milníky 2026–2050+, roadmap |
| [`V31_SOFTWARE.md`](V31_SOFTWARE.md) | Technická dokumentace crate `zion-issobella` — API, DB, konfigurace, DAO integrace |
| [`CLI.md`](CLI.md) | Reference příkazu `zion issobella` |

### Výzkumné podklady (L6data)

| Soubor | Obsah |
|--------|-------|
| [`L6data/Architektura.md`](../../../L6data/Architektura.md) | Architektura stanice, moduly, energetika |
| [`L6data/Kvantovy_Motor.md`](../../../L6data/Kvantovy_Motor.md) | Návrh a roadmap kvantového motoru |
| [`L6data/Umela_Gravitace.md`](../../../L6data/Umela_Gravitace.md) | Fyzika a design umělé gravitace |
| [`L6data/Lidske_Faktory.md`](../../../L6data/Lidske_Faktory.md) | Biomedicína a psychologie posádky |
| [`L6data/GPT_Podklady.md`](../../../L6data/GPT_Podklady.md) | Kompaktní kontext pro GPT |

---

## Rychlé odkazy

- Hlavní README: [`../README.md`](../README.md)
- Legacy V3 L6 docs: [`../../../archive/V3/L6/issobella/docs`](../archive/V3/L6/issobella/docs)
- L5 Free World (pozemní podpora): [`../../L5/free-world`](../L5/free-world)
- L2 DAO (governance): [`../../L2/dao`](../L2/dao)
- ZION whitepaper: [`../../../docs/WP/ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_CZ.md`](../../../docs/WP/ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_CZ.md)

---

## Vztah k ostatním vrstvám

```text
L1 TerraNova  ──>  5 % block reward  ──>  L6 Issobella Fund
L2 DAO        ──>  governance, granty, schvalování misí
L3 WARP       ──>  cross-chain fundraising pro hardware
L4 OASIS      ──>  NFT kolekce, VR simulace stanice
L5 Free World ──>  pozemní podpora, kvantový motor
L6 Issobella  ──>  TATO VRSTVA (orbitální stanice)
```

---

## Stav implementace (V31)

| Komponent | Stav |
|-----------|------|
| `zion-issobella` crate | Implementován (Axum API, SQLite, L1 scanner, metriky) |
| CLI integrace | `zion issobella` subcommandy |
| Systemd service | [`deploy/systemd/zion-v31-issobella.service`](../../deploy/systemd/zion-v31-issobella.service) |
| DAO client | Propojení s L2 DAO |
| Hiran AI bridge | Volitelný AI pro posuzování misí a návrhů |
| Testy | Unit + integrační |
| Web UI | [`APP&WEB/website-v2.9/src/app/l6-issobella/page.tsx`](../../../APP&WEB/website-v2.9/src/app/l6-issobella/page.tsx) |
| Orbitální hardware | Dlouhodobá vize (2040+) |

---

## Klíčové konstanty

| Parametr | Hodnota | Zdroj |
|----------|---------|-------|
| Fee split L6 | 5 % z každého block reward | `zion_core::emission` |
| Tail emission start | 2126 | `MAINNET_CONSTANTS.md` |
| Tail emission rate | ~724.78 ZION/blok | `MAINNET_CONSTANTS.md` |
| Cílový rok stanice | 2040+ | Roadmap |
| Default API port | 8097 | `src/config.rs` |
| Fund address | `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0` | `src/config.rs` |

---

*"Od blockchainu ke hvězdám — nestavíme jen technologii, stavíme budoucnost."*
