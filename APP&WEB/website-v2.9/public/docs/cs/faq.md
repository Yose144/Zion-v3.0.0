# Často kladené otázky (FAQ)

---

### Co je ZION?

ZION je decentralizovaný blockchain Layer 1 postavený od nuly v Rustu. Používá Proof-of-Work konsenzus s algoritmem **Cosmic Harmony v3** a 6vrstvou architekturu „On the Star“. Verze 2.9.6 přináší emisní plán Decade Decay na 100+ let a vyhrazené financování planetárních projektů včetně vesmírné stanice **ZION Issobella**.

---

### Jaký je konsenzus?

Proof of Work s algoritmem **Cosmic Harmony v3** (multi-algo, CPU-friendly). Difficulty adjustment používá LWMA s oknem 60 bloků.

---

### Kolik ZION dostanu za blok?

**5 400,067 ZION** v první dekádě (2026–2036). Odměna se snižuje o 20 % každých 10 let (Decade Decay). Po dekádě 10 (2126+) pokračuje perpetual tail emission **724,785 ZION/blok**.

Distribuce: 89 % miner, 5 % humanitarian, 5 % L5/L6 Issobella fund, 1 % pool fee.

---

### Jaká je celková emise?

| Parametr | Hodnota |
|----------|---------|
| Celková emise | 144 mld ZION |
| Premine | 16,28 mld ZION (11,3 %) |
| Block reward (D1) | 5 400,067 ZION |
| Emisní model | Decade Decay (-20 % / 10 let) |
| Tail emission | 724,785 ZION/blok (od 2126) |
| Mining horizont | 100+ let + tail inf |

---

### Jak je rozdělen premine?

| Fond | Množství | Podíl |
|------|----------|-------|
| ZION Oasis + Golden Egg | 8,25 mld | 50,7 % |
| DAO Treasury | 4,00 mld | 24,6 % |
| Infrastruktura | 2,59 mld | 15,9 % |
| Humanitární fond | 1,44 mld | 8,8 % |

Vše je distribuováno ihned při genesi. Mimo mining neprobíhá žádný další minting.

---

### Co se stane s poplatky?

Poplatky jsou **spalovány**. To vytváří deflační tlak a chrání síť před spamem.

---

### Jak začít těžit?

Nejrychlejší cesta vede přes Docker, viz [Quick Start →](#getting-started). Případně stáhni binárky z [Download](https://www.zionterranova.com/download).

---

### Jak se připojím k testnet nodu?

```bash
./zion-core --network testnet \
  --peers "91.98.122.165:8334"
```

---

### Jaké porty potřebuji?

| Síť | P2P | RPC | Stratum | Pool API |
|-----|-----|-----|---------|----------|
| Testnet | 8334 | 8444 | 3333 | 8080 |
| Mainnet | 8333 | 8443 | 3333 | 8080 |

---

### Kdy bude mainnet?

Aktuální veřejný stav je **NO-GO do uzavření closure evidence**. Konec roku 2026 zůstává cílové okno, ne garantované datum. Aktuální stav sleduj na [Roadmap →](#whitepaper-roadmap).

---

### Je ZION CPU-only?

Ano. Cosmic Harmony v3 je navržen jako CPU-friendly, takže ASIC ani GPU nemají dramatickou výhodu proti moderním CPU.

---

### Existuje peněženka?

Desktop peněženka je ve vývoji. Aktuálně se používá CLI wallet a RPC API.

---

### Kde najdu zdrojový kód?

V GitHub organizaci [Zion-TerraNova](https://github.com/Zion-TerraNova):

- [2.9.5-NativeAwakening](https://github.com/Zion-TerraNova/2.9.5-NativeAwakening) — aktuální historická release větev
- [v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet) — příprava mainnetu

---

### Jak mohu přispět?

- Těžbou — každý node pomáhá decentralizaci
- Kódem — pošli PR na [GitHub](https://github.com/Zion-TerraNova)
- Komunitou — přidej se na [Discord](https://discord.gg/zion-terranova)

---

### Kam dál?

- [Quick Start →](#getting-started)
- [Mining průvodce →](#mining-guide)
- [API Reference →](#api)
- [Whitepaper →](#whitepaper-full)

---

*ZION TerraNova v2.9.6*