# ZION CLI Troubleshooting (pro laiky)

Tady je rychlý postup, když "něco nefunguje".

## 0) Univerzální první krok

```bash
zion status
zion doctor
```

Když `zion` není dostupné:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- status
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- doctor
```

---

## 1) `zion status` ukazuje chyby

Pokračuj tímto pořadím:

```bash
zion node status
zion pool stats
zion agent status
```

Pak logy postižené služby:

```bash
zion logs node
zion logs pool
zion logs ai-native
```

---

## 2) Na webu nejsou bloky / explorer je prázdný

To bývá nejčastěji problém node RPC.

Ověř:

```bash
zion node status
zion logs node
```

Když node neběží, web nemá odkud číst chain data.

---

## 3) Agent je "degraded" nebo fallback

To neznamená vždy pád služby.

Ověř:

```bash
zion agent status
zion agent config
zion logs ai-native
```

Interpretace:

- služba běží + backend není dostupný = fallback (očekávané),
- služba neběží = je nutný restart / deploy zásah.

---

## 4) Start/stop/restart "nic neudělá"

Používej správné cíle (`node`, `pool`, `agent`, `bridge`, ...), ne názvy kontejnerů.

Příklad:

```bash
zion restart node
zion logs node
```

---

## 5) Změnil jsem config, ale neprojevilo se to

```bash
zion config path
zion config show
zion config validate
```

Potom nastav hodnotu znovu:

```bash
zion config set node.rpc_host seed.zionterranova.com
```

---

## 6) Nemám jistotu, co řešit první

Drž se tohoto "anti-chaos" pořadí:

1. `zion status`
2. `zion node status`
3. `zion pool stats`
4. `zion agent status`
5. `zion logs <sluzba>`

Nespouštěj hned restart všeho. Nejprve diagnostika, pak zásah.
