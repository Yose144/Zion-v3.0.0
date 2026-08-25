# FAQ — ZION TerraNova Onboard

Odpovědi na základní otázky. Pro plný příběh, whitepaper a motivaci k těžbě jdi na [Massive Onboarding](/onboard#massive-onboarding).

---

## 1. Co je ZION?

ZION je **proof-of-work blockchain**, který chce být kompasem pro novou ekonomiku — nejde o slib ceny, ale o otevřený kód, veřejný chain a síť, která roste dřív, než o ní mluví každá krčma.

- **Hard cap:** 144 000 000 000 ZION
- **Block time:** ~60 s
- **Block reward (Dekáda 1, 2026–2036):** 5 400,067 ZION — nejvyšší v historii sítě
- **Genesis:** 8. 8. 2026 — po dvou hard resetech, třetí a poslední genesis; tento chain je **Mainnet Launch pro 31. 12. 2026**
- **Licence kódu:** MIT

---

## 2. Proč těžit zrovna teď?

Protože odměna za blok je dnes nejvyšší, jakou kdy protokol vyplatí, a síť je pořád malá. Následující dekády odměna klesá o 20 %. Není to investiční rada — je to matematika emise, kterou si můžeš ověřit v kódu.

---

## 3. Jak začít těžit?

### Veřejná Desktop App (Windows 11 / macOS)

1. Stáhni si instalátor z [GitHub release v3.1.0-desktop](https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop).
2. Nainstaluj a v případě potřeby povol spuštění v systémových nastaveních (Windows SmartScreen / macOS Gatekeeper).
3. Vytvoř peněženku v záložce **Wallet** a zaznamenej seed offline.
4. Nastav pool na `pool.zionterranova.com:8444` a zvol worker name.
5. Klikni **Start Mining**.

Aplikace je zdarma. Ve veřejné verzi jsou všechny tři Trinity streamy automaticky směrovány do **ZION Liquidity & Grow**, aby posílily růst celé sítě. V budoucím VIP mineru bude možné nastavit i zbylé dva streamy podle sebe.

### Z příkazové řádky (kořeny)

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet
cargo build --release --bin zion-miner

./target/release/zion-miner \
  --pool pool.zionterranova.com:8444 \
  --wallet zion1...tvoje_adresa \
  --worker muj-prvni-rig
```

---

## 4. Kolik vydělám?

**Nikdo ti nemůže slíbit cenu ani zisk.** Získáváš ZION, jejichž budoucí cenu určuje trh. Dnes je odměna nejvyšší v historii a o bloky se dělí méně minerů. Zítra už to tak být nemusí.

---

## 5. Jak vytvořit peněženku?

### V Desktop App
- Záložka **Wallet** → **Create Wallet**.
- Zapiš si seed na papír a ulož na bezpečném offline místě.
- Použij veřejnou adresu `zion1...` pro těžbu.

### Z CLI
```bash
export ZION_WALLET_PASSWORD="tvé-silné-heslo"
zion wallet new --out zion-wallet.json --password-env ZION_WALLET_PASSWORD
```

Nikdy seed nikomu neukazuj, neukládej ho do cloudu a nefoť ho.

---

## 6. Co je Trinity Miner?

Jeden miner umí tři hashrate streamy současně:

- **ZION** (PoW Ekam Deeksha) — hlavní stream
- **GPU AuxPoW** (např. ZANO) — volitelný
- **CPU AuxPoW** (např. VRSC) — volitelný

Je to technická možnost, ne zisková kalkulačka. Výkon závisí na tvém hardwaru.

---

## 7. Jaké jsou veřejné body sítě?

| Služba | Adresa |
|---|---|
| Pool (Stratum) | `pool.zionterranova.com:8444` |
| RPC | `rpc.zionterranova.com:8443` |
| Web | `https://app.zionterranova.com` |
| wZION na Base | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| Kód | `github.com/Zion-TerraNova/v3-Mainnet` |

---

## 8. Chci provozovat vlastní nód

Pro většinu lidí to není potřeba — stačí veřejný RPC. Pokud chceš vlastní kopii chainu:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet
cargo build --release --bin zion-node
```

Spusť s veřejnými seed peers:

```text
zionterranova.com:8333
zionterranova.com:8334
```

Pokud nechceš node, použij veřejný RPC:

```text
http://rpc.zionterranova.com:8443
```

---

## 9. Co je wZION a bridge?

**wZION** je ERC-20 token ZION na Base. Umožňuje směnit ZION z L1 na Ethereum L2 a zpět. Adresa je verifikovaná na Basescanu. Bridge je ve veřejné beta; neposílej větší částky, než si můžeš dovolit otestovat.

---

## 10. Co je OASIS?

**OASIS** je herní svět ZION — 3D galaxie 400+ světů, avataři, Strom Života. Dnes je **public preview**, ne hotová AAA hra. Můžeš ho prozkoumat na [oasis.zionterranova.com](https://oasis.zionterranova.com), ale jsi u prvních záhonů.

---

## 11. Existuje pre-mine, ICO nebo presale?

Ne. Žádné ICO. Žádný presale. Žádná VIP alokace. Premine je veřejně auditovatelný a jde na provoz sítě, rozvoj a zakládající komunitu — ne do soukromých kapes.

---

## 12. Je ZION investiční rada?

**Nikdy ne.** Tady není slib ceny ani garantovaného zisku. Je to technická síť, která běží, a každý si měří své riziko sám. Vše, co slibujeme, je v kódu a můžeš to ověřit.

---

> *Nikdo tě nebude honit. Archa se nestaví křikem — staví se blok po bloku, 60 sekund po 60 sekundách, a dveře jsou otevřené.*
