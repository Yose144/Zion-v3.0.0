# 🔭 ZION Issobella — L6 Dokumentace

> *„Hvězda není cíl — je začátek."*

---

## Co je ZION Issobella?

**ZION Issobella** je vrcholová vrstva (L6) ZION ekosystému — dlouhodobá vize orbitální vědecké observatoře a výzkumné stanice na nízké oběžné dráze Země (LEO). Stanice nese jméno po **Issobele, Strážkyni Lidskosti** — symbolu soucitu, čistoty a služby, který spojuje technologii s vyšším vědomím.

Tato dokumentace je jediným zdrojem pravdy pro L6 — integruje data z legacy vrstev, whitepaperů, generativních textů i implementace V3.

---

## Struktura dokumentace

| Dokument | Obsah |
|----------|-------|
| [`STANICE_ISSOBELLA.md`](STANICE_ISSOBELLA.md) | Filozofie, symbolika, mise, koncept stanice, kosmická rodina |
| [`V3_SOFTWARE.md`](V3_SOFTWARE.md) | Technická dokumentace crate `zion-issobella` — API, DB, konfigurace, DAO integrace |
| [`FINANCOVANI.md`](FINANCOVANI.md) | Zdroje financování, fee split, rozpočet, tokenomika |
| [`CASOVA_OSA.md`](CASOVA_OSA.md) | Milníky 2026–2050+, roadmap |

---

## Rychlé odkazy

- **Legacy L6 README:** [`L6/README.md`](../../../../L6/README.md)
- **Guardian profil Issobely:** [`docs/docs2.9/ZION_OASIS/SACRED_TRINITY/08_ISSOBELA_GUARDIAN.md`](../../../../docs/docs2.9/ZION_OASIS/SACRED_TRINITY/08_ISSOBELA_GUARDIAN.md)
- **Layer architektura:** [`docs/v2.9.6/layer-architecture.md`](../../../../docs/v2.9.6/layer-architecture.md)
- **Whitepaper (CZ):** [`docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0.5_CZ.md`](../../../../docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0.5_CZ.md)
- **Kanonický whitepaper:** [`V3/docs/ZION_Mainnet_Whitepaper_v3.0.5_Canonical.md`](../../docs/ZION_Mainnet_Whitepaper_v3.0.5_Canonical.md)

---

## Vztah k ostatním vrstvám

```
L1 TerraNova  ──►  block reward (5 %)  ──►  L5/L6 Issobella Fund
L2 DAO        ──►  governance, granty, schvalování misí
L3 WARP       ──►  cross-chain fundraising pro hardware
L4 OASIS      ──►  NFT kolekce, VR simulace stanice, consciousness mining
L5 Free World ──►  pozemní podpora, kvantový motor, energetická nezávislost
L6 Issobella  ──►  *** TATO VRSTVA *** (orbitální stanice)
```

---

## Stav implementace (V3)

| Komponent | Stav |
|-----------|------|
| `zion-issobella` crate | ✅ Implementováno (Axum API, SQLite, L1 scanner, metrics) |
| CLI integrace | ✅ `zion-cli issobella` subcommandy |
| Docker service | ✅ `Dockerfile.issobella` + `docker-compose.yml` |
| DAO client | ✅ Propojení s L2 DAO (`/submit-to-dao` endpoint) |
| Testy | ✅ 3 integrační testy (mission lifecycle, proposal lifecycle, fund balance) |
| Orbitální hardware | 🔴 Dlouhodobá vize (2040+) |

---

## Klíčové konstanty

| Parametr | Hodnota | Zdroj |
|----------|---------|-------|
| Fee split L5/L6 | 5 % z každého bloku | `V3/L1/core/src/emission.rs` |
| Tail emission start | 2126 | `MAINNET_CONSTANTS.md` |
| Tail emission rate | ~724.78 ZION/blok | `MAINNET_CONSTANTS.md` |
| Cílový rok stanice | 2040+ | Roadmap |
| Default API port | 8096 | `zion-issobella/src/config.rs` |
| Fund address | `zion1issobella000000000000000000000000` | `config.rs` |

---

*„Od blockchainu ke hvězdám — nestavíme jen technologii, stavíme budoucnost."* ⭐
