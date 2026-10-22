# Vast rigs — report práce a nasazení

**Datum:** 21. 10. 2026

**Stav:** Vast dashboard i inference worker UI/API jsou pushnuté a nasazené.

## Cíl

Zpřehlednit stránku Vast rigs na mobilních i desktopových zařízeních a připravit
read-only přehled GPU/inference kapacity pro další práci na programovacím agentovi
Hiranovi.

## Technické zjištění k více GPU instancím

VRAM několika vzdálených Vast.ai instancí se běžně nedá sloučit do jedné
průhledné paměti pro jeden model. Použitelnější je rozdělit model či jeho práci
mezi více workerů a přistupovat k nim přes inference API/orchestraci. Taková
orchestrace vyžaduje samostatný návrh a implementaci; tento release ji
neimplementuje.

Volná VRAM sama o sobě neznamená volnou výpočetní kapacitu. Pokud na stejné GPU
běží těžba, inference může soupeřit o výpočetní výkon, propustnost paměti,
příkon i teplotní limit. Přidaný panel proto hlásí dostupné metriky a odděluje
GPU inventář od dostupnosti inference API; neslibuje sdílenou VRAM ani
garantovaný inference výkon.

## Provedené změny

- **Responzivní UI Vast rigs** v
  [`apps/IntroPage/src/app/vast-rigs/Dashboard.tsx`](./apps/IntroPage/src/app/vast-rigs/Dashboard.tsx):
  upravené rozvržení rig karet a ovládání pro úzké displeje, nabídky GPU pro
  mobilní zobrazení a tabulky pro širší obrazovky. Opravena také mobilní šířka
  karet a horizontální přetékání.
- **Read-only AI status API** v
  [`tools/vast/vastctl.py`](./tools/vast/vastctl.py): endpoint
  `/api/ai/status` agreguje dostupné rig/GPU údaje a stav lokálního
  OpenAI-kompatibilního inference API. Zobrazuje GPU metriky (například VRAM,
  vytížení, teplotu a příkon, pokud je instance poskytne) a modely dostupné přes
  inference API. Probe endpointu je omezen na lokální adresu a číselný port.
- **Backend testy** v
  [`tools/vast/test_vastctl.py`](./tools/vast/test_vastctl.py): parsování
  GPU/modelů, agregace stavu, případ bez model serveru, selhání probe,
  validace lokálního URL a portu.
- **Dokumentace** v
  [`VASTAI-MINING.md`](./VASTAI-MINING.md): popis AI status pilotu a omezení
  sdílené VRAM a GPU výkonu.
- **Vast inference worker ovládání** v
  [`tools/vast/vast_inference.py`](./tools/vast/vast_inference.py) a
  [`tools/vast/vastctl.py`](./tools/vast/vastctl.py): potvrzené deploy/stop/
  status akce a příkaz pro SSH port-forward. Akce cílí pouze na již běžící
  instanci; deployment váže vLLM host port na loopback a povoluje jen oficiální
  version-tagged vLLM image.
- **Sjednocené inference UI** v
  [`apps/IntroPage/src/app/vast-rigs/Dashboard.tsx`](./apps/IntroPage/src/app/vast-rigs/Dashboard.tsx):
  přehledný worker setup panel, výběr modelu a VRAM cíle a responsivní tlačítka
  Deploy, Check, Copy SSH tunnel a Stop na kartě každého rigu. Deploy a Stop
  vyžadují potvrzení; tunnel příkaz lze zkopírovat do clipboardu.

## Ověření

- `npm run build` v `apps/IntroPage` — úspěšný build; `/vast-rigs` je
  staticky generovaná stránka.
- `tsc --noEmit` v `apps/IntroPage` — bez TypeScript chyb.
- `python3 -m unittest discover -s tools/vast -p 'test_*.py' -v` — všech
  **15 testů prošlo** (loopback bind, origin ochrana, potvrzení akcí, validace
  instance/modelu/image a SSH tunnel command).
- `git diff --check` — bez whitespace chyb.
- Smoke test `http://127.0.0.1:8088/api/ai/status` — HTTP 200; odpověď obsahuje
  `ai_api_port`, `note`, `rigs`, `totals` a `ts`.
- Ověřena responzivita stránky v mobilním i desktopovém viewportu před
  nasazením.
- Po nasazení odpověděl lokální `/api/ai/status` i stejný endpoint přes Edge
  reverse tunnel HTTP 200; Edge obsahuje generovanou `/vast-rigs/` stránku
  s AI worker UI.
- Nepřihlášený veřejný požadavek na dashboard vrací HTTP 401 z nginx Basic
  Auth. Nginx konfigurace na Edge prošla `nginx -t`.

## Push a nasazení

- AI worker změny jsou v commitu `069bea305`; služba byla přepnuta na čistý,
  committed runtime snapshot a tato konfigurace je v `1fabc0c0a`.
- Při izolovaném buildu se zachytily omylem přibalené, nesouvisející mining UI
  změny. Byly vráceny v `2c7f7d906` před produkčním buildem a nasazením.
- Všechny změny byly pushnuty fast-forwardem na `origin/main`, bez force push.
- Čistý statický build z commitu `2c7f7d906` byl nasazen skriptem
  [`apps/IntroPage/deploy/deploy-intro.sh`](./apps/IntroPage/deploy/deploy-intro.sh)
  do `/var/www/zion-maintenance` na Edge; `nginx -t` uspěl a nginx byl reloadnut.
- Uživatelská služba `vastctl-serve.service` běží z
  `~/.local/share/vastctl-release/tools/vast` a Edge reverse tunnel API smoke
  test vrátil HTTP 200. Žádná Vast instance nebyla nasazena, zastavena ani
  jinak změněna.

## Provozní bezpečnost a zbývající práce

Tato iterace přidává ovládání jednoho inference workeru na jednom hostu, ale
během vývoje nebyla pronajata ani změněna žádná instance. Reálné nasazení
vyžaduje uživatelem potvrzenou akci, Docker + NVIDIA runtime na rigu a ruční
spuštění vygenerovaného SSH tunelu. `gpu-memory-utilization` je limit alokace
vLLM, nikoliv garance časového rozdělení výkonu s těžbou.

Zbývá reálný end-to-end test na vybrané existující Vast instanci a následné
napojení tunelovaného `LLM_BASE_URL` do běžící Hiran služby. Modely na různých
Vast hostech nesdílejí VRAM; distribuované model parallelism, routing/fallback
mezi workery a scheduler těžba/inference zůstávají samostatnými úkoly.
