# Logo workflow — ZION 3.1

> Interní postup pro aktualizaci a nasazení oficiálního ZION loga.

## Zdrojové logo

Kanonický zdroj je `canon/brand/ZionLogo.png` (rastr 1024×1024, ideálně čtverec). Staré logo `canon/brand/symbol.png` zůstává v repu jako fallback.

## Build brand package

Z kořene repa spusť:

```bash
python3 canon/brand/org/build_org_logos.py
```

Skript vygeneruje / přepíše celou adresářovou strukturu `canon/brand/org/`:

- transparentní `symbol-*.png`
- favikony a `.ico`
- wordmarky (dark / light)
- OG banner
- app ikony (`zion-primary-cosmic.png`, ...)
- `.icns` pro macOS, `.ico` pro desktop Windows
- mobile splash a adaptive icon

Pokud chceš znovu vyrobit balíček z původního `canon/brand/symbol.png`:

```bash
python3 canon/brand/org/build_org_logos.py --source canon/brand/symbol.png --legacy-symbol
```

## Deploy do aplikací

Po buildu zkopíruj aktualizované assety. Bezpečnější je to udělat přes Python skript, protože cesty obsahují `&`:

```python
import shutil
from pathlib import Path

ORG = Path("canon/brand/org")

copies = [
    # website-v2.9
    (ORG / "favicon.ico", Path("apps/website-v2.9/public/favicon.ico")),
    (ORG / "favicon-32.png", Path("apps/website-v2.9/public/favicon.png")),
    (ORG / "favicon-180.png", Path("apps/website-v2.9/public/apple-icon.png")),
    (ORG / "favicon-180.png", Path("apps/website-v2.9/public/apple-touch-icon.png")),
    (ORG / "favicon-192.png", Path("apps/website-v2.9/public/icon-192.png")),
    (ORG / "favicon-512.png", Path("apps/website-v2.9/public/icon-512.png")),
    (ORG / "symbol-200x200.png", Path("apps/website-v2.9/public/symbol-200x200.png")),
    (ORG / "zion-social-banner.png", Path("apps/website-v2.9/public/zion-social-banner.png")),
    (ORG / "favicon-32.png", Path("apps/website-v2.9/public/images/favicon.png")),
    (ORG / "favicon-180.png", Path("apps/website-v2.9/public/images/apple-touch-icon.png")),

    # MarketPlace
    (ORG / "favicon.ico", Path("apps/MarketPlace/public/favicon.ico")),
    (ORG / "symbol-200x200.png", Path("apps/MarketPlace/public/symbol-200x200.png")),
    (ORG / "zion-social-banner.png", Path("apps/MarketPlace/public/zion-social-banner.png")),

    # OasisWeb
    (ORG / "favicon.ico", Path("apps/OasisWeb/public/favicon.ico")),
    (ORG / "symbol-200x200.png", Path("apps/OasisWeb/public/symbol-200x200.png")),
    (ORG / "zion-social-banner.png", Path("apps/OasisWeb/public/zion-social-banner.png")),

    # Dashboard
    (ORG / "favicon.ico", Path("ZION_OS/dashboard/v31/favicon.ico")),
    (ORG / "symbol-200x200.png", Path("ZION_OS/dashboard/v31/symbol-200x200.png")),

    # Mobile
    (ORG / "zion-mobile-adaptive-icon.png", Path("apps/mobile-app/assets/icon.png")),
    (ORG / "zion-mobile-adaptive-icon.png", Path("apps/mobile-app/assets/adaptive-icon.png")),
    (ORG / "zion-mobile-splash.png", Path("apps/mobile-app/assets/splash.png")),

    # Desktop agent
    (ORG / "zion-primary-cosmic.png", Path("apps/desktop-agent/src/assets/icon.png")),
    (ORG / "zion-desktop.ico", Path("apps/desktop-agent/src/assets/icon.ico")),
    (ORG / "zion-desktop.icns", Path("apps/desktop-agent/src/assets/icon.icns")),
    (ORG / "favicon-64.png", Path("apps/desktop-agent/src/assets/tray-icon.png")),
    (ORG / "favicon-512.png", Path("apps/desktop-agent/src/assets/logo.png")),
]

for src, dst in copies:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
```

## Co se nemění

`logo144.png` v `apps/MarketPlace/public/` a `apps/website-v2.9/public/images/` zůstává původní historická firemní značka (500×500). Stargate animace `stargate/Z.gif` se také nemění.

## Ověření

- `file canon/brand/org/symbol-200x200.png` → 200×200 RGBA
- `file canon/brand/org/favicon.ico` → multi-res ICO
- `file apps/desktop-agent/src/assets/icon.icns` → macOS icon
- `git status` nesmí obsahovat neočekávané změny v `logo144.png`

## Commit

```bash
git add -A
git commit -m "Rebrand: regenerate canon/brand/org from canon/brand/ZionLogo.png and deploy"
git push origin main
```

Viz také `logo.md` (přehled použití) a `canon/brand/org/README.md` (popis všech výstupů).
