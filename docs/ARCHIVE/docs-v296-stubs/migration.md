# 🔄 Migrace z v2.9.5 na v2.9.6

> *Průvodce přechodem na Pre-Mainnet fork*

---

## Status: V přípravě

Migrační průvodce bude zveřejněn po dokončení vývoje v2.9.6.

---

## Co očekávat

### Breaking changes
- Nový genesis blok (reset chain)
- Aktualizované P2P porty pro mainnet
- Nové RPC endpointy

### Zpětná kompatibilita
- Wallet formát zachován
- Mining konfigurace kompatibilní
- API formát JSON-RPC 2.0 zachován

---

## Migrační kroky (předběžné)

```bash
# 1. Zastavit stávající node
systemctl stop zion-node

# 2. Aktualizovat binárky
# (instrukce budou doplněny)

# 3. Aktualizovat konfiguraci
# (nový config soubor bude poskytnut)

# 4. Restartovat
systemctl start zion-node
```

---

## Podpora

Máte otázky ohledně migrace?

- [Discord](https://discord.gg/zion-terranova) — #migration kanál
- [GitHub Issues](https://github.com/Zion-TerraNova/2.9.5-NativeAwakening/issues)

---

*Tato stránka bude aktualizována s detailními instrukcemi po dokončení v2.9.6.*
