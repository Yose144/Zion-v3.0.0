# Secrets scan report — 2026-07-30

> **Cíl:** 3.0.9 Go/No-Go `git secrets --scan` clean. Protože `git secrets` není
> nainstalován v tomto prostředí, provedli jsme ruční heuristický scan.

## Metodika

Prohledány cesty `V3/`, `public/V3/`, `docs/`, `scripts/`, `edge-deploy/` a
`ZION_OS/` pomocí těchto patternů:

- `-----BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) KEY-----`
- `0x[0-9a-fA-F]{64}` (EVM klíče / test vektory)
- `0x[1-9a-fA-F][a-fA-F0-9]{63}` (non-zero EVM klíče)
- `mnemonic|seed phrase|SEED_PHRASE|MNEMONIC`
- `PRIVATE_KEY` / `PRIVATE KEY`
- Známá placeholderová klíče (`0x0000...0001`)

## Zjištění

### 1. Hardcoded kryptografické klíče

- **0 výskytů** reálných SSH/ED25519/RSA/EC private key bloků ve `V3/`
  (kromě historických audit reportů v `docs/docs2.9/2.8.3/SECURITY_AUDIT_REPORT.txt`,
  které jsou archivní a mimo aktivní kód).
- **0 výskytů** 64-byte EVM privátních klíčů s non-zero prefixem ve `V3/`.
  Všechny shody `0x{64}` jsou EVM event topics (`Transfer`, `Approval` atd.)
  nebo test vektory.

### 2. Hlášky a nástroje okolo klíčů

- `V3/scripts/upgrade-bridge-mainnet.sh` — správně čte `PRIVATE_KEY` z env
  a při absenci skončí s chybou. **Žádný hardcoded klíč.**
- `V3/L1/core/src/bin/canonical-mainnet-operator-env.rs` — tiskne pouze
  kanonické adresy (nikoli seed phrase); SK je explicitně z offline backupu.
- `V3/cli/src/commands/wallet.rs` — `mnemonic` se používá pouze pro CLI
  odvození z uživatelem zadaného seedu.

### 3. Potenciální false positive — `V3/L2/contracts/hardhat/hardhat.config.ts`

Původně obsahoval:

```ts
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x000...0001";
```

I když je to dummy/placeholder, `git secrets` entropy pravidla by na něj
mohla reagovat (a při `HARDHAT_TARGET=mainnet` by se použil neplatný klíč).

**Opraveno (2026-07-30):**

```ts
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
if (!PRIVATE_KEY && ((process.env.HARDHAT_TARGET || "").includes("-sepolia") || process.env.HARDHAT_TARGET === "mainnet")) {
  throw new Error("DEPLOYER_PRIVATE_KEY must be set for non-local deployments");
}
```

Stejná změna provedena i v `public/V3/L2/contracts/hardhat/hardhat.config.ts`
(jednorázový sync; důkladnější subtree sync je stále v plánu).

### 4. IP adresy a RPC endpointy

- Aktivní kód obsahuje pouze veřejné RPC endpointy (`https://base-mainnet.publicnode.com`,
  `https://sepolia.base.org` atd.).
- Interní IP `62.171.141.136` je uváděna pouze v dokumentaci a `edge-deploy/`,
  což je očekáváno — tato oblast není součástí `public/` subtree.
- Stará dekomisovaná IP `77.42.71.94`/`100.76.16.108` jsou označeny jako
  historické v `AGENTS.md` a `StatusV3.md`.

### 5. Soubory s vysokou koncentrací hex řetězců

- `public/V3/L2/bridge/contracts/lib/openzeppelin-contracts/` — test fixtures
  (`TrieProof.test.js`, `BlockHeader.test.js` atd.) obsahují velké množství
  validních 64-char hex hashů. Jsou to veřejné testovací vektory, ne tajemství.
- `ZionDex/contracts/lib/forge-std/test/fixtures/broadcast.log.json` — test
  broadcast log, ne reálný klíč.

## Doporučení pro dokončení 3.0.9

1. Nainstalovat `git secrets` / `trufflehog` na server a spustit jako součást
   CI před `git subtree push`.
2. Přidat `.secrets.baseline` pro potvrzené false-positive (OpenZeppelin fixtures,
   test vektory).
3. Odstranit historické `docs/docs2.9/2.8.3/SECURITY_AUDIT_REPORT.txt` z repa
   (obsahuje staré klíče), nebo jej přesunout do offline archivu.
4. Přesunout všechny RPC/IP/wallet konfigurace z kódu do env vars / TOML
   souborů s placeholders.

## Závěr

V aktivním `V3/` kódu **nejsou nalezeny commited privátní klíče**.
Hlavním nálezem byla dummy fallback private key v Hardhat configu, která byla
opravena. Pro plný `git secrets --scan clean` je potřeba nástroj spustit v CI
a vyloučit známé test fixtures.

*Vygenerováno 2026-07-30.*
