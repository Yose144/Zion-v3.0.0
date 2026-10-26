# ZION Infra Runbook (kanonický)

> Jediný zdroj pravdy pro restart/rollback/diagnostiku. Odpovídá `docs/ECOSYSTEM-REBUILD-PLAN.md` F5.
> Topologie: `docs/3.2/StatusV3.md` → EDGE2 (public+app+data) + EDGE (chain/mining tier).

## Deploy web (app.zionterranova.com)

```bash
bash apps/website-v2.9/deploy/deploy-web2.9.sh
```

- Build lokálně → rsync `.next`+`public`+standalone/public → EDGE2 `/opt/zion/apps/website-v2.9` → restart `zion-website.service` → smoke (/, hero.webp, favicon, manifest, /api/health).
- Rollback: `mv .next.bak-<ts> .next && systemctl restart zion-website.service`.
- Pokud obrázky 404: chybí `standalone/public/` (script to dělá automaticky).

## Deploy intro (zionterranova.com)

```bash
bash apps/website-v2.9/deploy/deploy-oasis-intro.sh
```

## Deploy OASIS web (oasis.zionterranova.com)

```bash
bash apps/OasisWeb/deploy/deploy-oasis-web.sh
```

## Deploy ZIS (auth.zionterranova.com)

```bash
bash apps/identity/deploy/deploy-zis.sh
```

## Deploy Marketplace (market.zionterranova.com)

```bash
rsync -az --delete apps/MarketPlace/.next zion-edge2:/opt/zion/apps/MarketPlace/ && systemctl restart zion-marketplace.service
```

## Restart služeb (EDGE2)

```bash
systemctl restart zion-website zion-marketplace zion-oasis zion-zis zion-v31-node zion-v31-pool nginx
```

## Diagnostika

- Health: `curl https://app.zionterranova.com/api/health`
- Nginx: `nginx -t && systemctl reload nginx`
- Logy: `journalctl -u <service> -n 50 --no-pager`
- Tunely: pouze 2 (edge2→edge :8080 pool API, :8003 rig LLM)

## Rollback DNS (F1)

9 záznamů zpět na `62.171.141.136`; edge vhosty živé. Window ≈ do 25.11.2026.
