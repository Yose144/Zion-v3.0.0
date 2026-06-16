# ZION CLI Quickstart (10 minut pro novacky)

Toto je nejkratsi cesta, jak si osahat ZION CLI bez chaosu.

## Cíl

Do 10 minut:

1. overis, ze CLI bezi,
2. uvidis stav stacku,
3. poznas, kde hledat chyby,
4. budes vedet, co delat dal.

---

## Krok 1: Otevri terminal

- macOS: Terminal
- Windows: PowerShell
- Linux: shell

Prejdi do rootu repa (`2.9.6`).

---

## Krok 2: Otestuj, ze mas Rust

```bash
cargo --version
```

Pokud dostanes verzi, pokracuj.

---

## Krok 3: Spust CLI bez instalace

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help
```

Tohle je nejbezpecnejsi start pro verejnost i novacky.

---

## Krok 4: Prvni zdravotni kontrola

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- status
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- doctor
```

Co to rika:

- `status` = souhrn stavu sluzeb,
- `doctor` = rychly preflight (config, endpointy, pripravenost).

---

## Krok 5: Kdyz uz mas `zion` v PATH

Muzes jit jednoduseji:

```bash
zion
```

nebo

```bash
zion menu
```

Menu je vhodne pro novacky: sipky + Enter + navrat zpet po kazdem prikazu.

---

## Krok 6: Minimalni orientacni sada prikazu

```bash
zion status
zion node status
zion pool stats
zion agent status
zion logs node
```

Tohle je tvoje prvni "diagnosticka petice".

---

## Krok 7: Co kdyz se nezobrazuji data v exploreru

Prvni kontrola:

```bash
zion node status
zion logs node
```

Pokud node padá, web/explorer obvykle nema zdroj dat.

---

## Co dal

1. ZION CLI pruvodce
2. ZION CLI referencni prehled
3. ZION CLI troubleshooting
4. ZION CLI deploy playbook
5. ZION CLI slovnicek pojmu
