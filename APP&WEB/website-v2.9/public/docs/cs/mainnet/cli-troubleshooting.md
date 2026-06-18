# ZION CLI Troubleshooting

## 1. `zion status` hlásí problém

Spusť:

```bash
zion status
zion node status
zion agent status
```

Když selže node i agent, podezírej nejdřív host nebo deploy vrstvu.

## 2. `zion agent` běží ve fallback režimu

To obvykle znamená, že služba žije, ale model backend není dostupný.

Zkontroluj:

```bash
zion agent status
zion agent config
zion logs ai-native
```

## 3. Lifecycle příkazy míří jinam, než čekáš

CLI mapuje na compose service names, ne na odhadované názvy kontejnerů.

Důležité příklady:

- `node` nebo `core` -> `core`
- `agent` nebo `ai-native` -> `ai-native`
- `monitoring` -> monitoring bundle

Nepodporovaný lifecycle target má teď selhat lokálně s jasným seznamem podporovaných targetů ještě před SSH voláním.

## 4. Veřejné docs po změně chybí

Web čte markdowny z website public docs tree.

Samotné repo docs nestačí.

Ověř:

```bash
cd APP&WEB/website-v2.9
npm run build
```

## 5. Config změny se neprojevují

Nejdřív zkontroluj aktivní soubor:

```bash
zion config path
zion config show
```

Pak nastav hodnotu znovu nebo spusť:

```bash
zion config init
```

## 6. Rychlé pořadí triage

1. `zion status`
2. `zion node status`
3. `zion pool stats`
4. `zion agent status`
5. `zion logs <affected-service>`