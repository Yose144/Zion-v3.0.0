# 🔐 ZION v2.8.4 – Git publikace (Maximální bezpečnost)

Status: Required for any public push/release  
Aligned with v2.8.3 practices (tightened for ASIC‑only posture)

---

## 1) Identity & podepisování

- Povinné: podepisovat všechny commity a tagy (GPG nebo SSH signatures)
- Enforce v repo: Require signed commits (Branch protection → Rulesets)
- Podepsané tagy pro vydání: `git tag -s v2.8.4 -m "ZION 2.8.4"`
- Klíče:
  - GPG: min. RSA 4096 / Ed25519, 2FA zapnuté na GitHub účtu
  - Publikujte klíč do GitHub (Settings → SSH and GPG keys)

## 2) Ochrana větví (main, release/*)

- Protected branches: main, release/*
- Vyžadovat PR (žádné přímé push na main)
- Min. 2 code review approvals (CODEOWNERS pro klíčové soubory)
- Povinné status checks (CI: lint/type/test, SCA, secret scan)
- „Require linear history“ + „Require conversation resolution“
- „Require signed commits“ + „Require signed tags“

## 3) Tajemství a skenování

- Zakázáno: přímé ukládání secrets do repozitáře
- Zapnout GitHub Advanced Security skeny (nebo ekvivalent)
- Lokální pre-commit hooky (doporučeno):
  - `detect-secrets` / `git-secrets`
  - `pre-commit` framework pro jednotné spuštění
- CI skenování: trivy/grype (docker), pip-audit (Python), gitleaks (secrets)

## 4) CI/CD tvrdé zabezpečení

- GitHub Actions:
  - `permissions: read-all` default; explicitně povolit jen potřebné zápisy
  - `GITHUB_TOKEN` s minimálními právy; žádné trvalé PAT v repu
  - OIDC pro cloud přístupy (namísto dlouhodobých klíčů)
  - Reusable workflows, pinned SHA u akcí, zákaz „latest“ tagů
- Artefakty:
  - Reprodukovatelná build pipeline (deterministické verze, pinned deps)
  - Podepisovat binárky/knihovny (GPG, minisign, sigstore – vyberte 1)
  - Publikovat checksums (SHA3/BLAKE3) do release assets

## 5) Závislosti & supply‑chain

- `requirements.txt`/`pyproject.toml`: pinned verze; pokud možno s hash ověřením
- Nepoužívat neověřená mirrors; preferovat oficiální indexy
- Submoduly: vyhnout se; pokud nutné → pin na konkrétní commit, read‑only
- SBOM (volitelně): CycloneDX v CI pro publikování k releasu

## 6) Release proces (v2.8.4)

1. Vytvořit release branch `release/2.8.4`
2. Bump verze v hlavičkách a CLI (`--version`), aktualizovat Release Notes
3. CI musí být zelené (lint/type/test + security checks)
4. Build artefaktů (např. `libcosmicharmony.{so,dylib}`) → podepsat + vyrobit checksumy
5. Podepsaný tag `v2.8.4` (annotated + GPG/SSH signature)
6. GitHub Release: přiložit changelog, binárky, podpisy, checksumy, SBOM (pokud je)
7. Ověřit reproducibilitu buildů (alespoň 2 členy týmu)

## 7) Přístupová politika

- Všichni maintainers: GitHub 2FA povinné
- Minimální práva (princip least privilege)
- CODEOWNERS pro citlivé oblasti:
  - `src/core/*` (consensus, algoritmy)
  - `zion/mining/*` (nativní knihovny)
  - `docker*`, `requirements*`, CI yaml (supply‑chain)

## 8) Artefakty a ověřování

- Pro každý release asset zveřejnit:
  - `*.asc` (GPG signature) nebo `*.minisig` (minisign) nebo sigstore payload
  - `*.sha3`/`*.blake3` checksumy
- Přiložit „How to verify“ sekci do Release Notes

## 9) Audit & evidence

- Uchovávat build logs a podpisové logy pro audit
- PR diskuze a review jako audit trail (žádné out‑of‑band změny)
- Linkovat externí auditní zprávy (když jsou) v release page

## 10) Nouzové postupy

- V případě odhalení kompromitace:
  - Okamžitě revoke klíče/tokeny, rotate secrets (OIDC zásadně pomůže)
  - Zastavit publikaci nových artefaktů, označit release jako „compromised“
  - Incident post‑mortem + timeline + nápravná opatření

---

Poznámka k v2.8.3
- Tento postup navazuje na bezpečnostní standardy v2.8.3, rozšiřuje je o přísnější
  požadavek na ASIC‑only těžbu (žádný SHA256 fallback), a přidává důraz na podepisování
  artefaktů + SBOM.

Kontakt: security@zioncrypto.io  
Checklist owner: ZION Core Team
