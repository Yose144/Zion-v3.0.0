# Vast rigs — report práce a nasazení

**Datum:** 21. 10. 2026

**Stav:** změny pushnuty do `origin/main`; statická stránka nasazena na Edge

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
  [`APP&WEB/IntroPage/src/app/vast-rigs/Dashboard.tsx`](./APP&WEB/IntroPage/src/app/vast-rigs/Dashboard.tsx):
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

## Ověření

- `npm run build` v `APP&WEB/IntroPage` — úspěšný build; `/vast-rigs` je
  staticky generovaná stránka.
- `tsc --noEmit` v `APP&WEB/IntroPage` — bez TypeScript chyb.
- `python3 -m unittest discover -s tools/vast -p 'test_*.py' -v` — všech
  **6 testů prošlo**.
- `git diff --check` — bez whitespace chyb.
- Smoke test `http://127.0.0.1:8088/api/ai/status` — HTTP 200; odpověď obsahuje
  `ai_api_port`, `note`, `rigs`, `totals` a `ts`.
- Ověřena responzivita stránky v mobilním i desktopovém viewportu před
  nasazením.

## Push a nasazení

- Změny byly přeneseny do izolovaného checkoutu založeného na aktuálním
  `origin/main`. Tím se předešlo pushnutí celé rozcházející se lokální historie.
- Push do `origin/main` proběhl jako fast-forward, bez force push.
- Statický IntroPage build byl nasazen skriptem
  [`APP&WEB/IntroPage/deploy/deploy-intro.sh`](./APP&WEB/IntroPage/deploy/deploy-intro.sh)
  do `/var/www/zion-maintenance` na Edge; `nginx -t` uspěl a nginx byl reloadnut.
- Uživatelská služba `vastctl-serve.service` byla restartována a následný lokální
  smoke test API vrátil HTTP 200.
- Vydaný commit na aktuální `origin/main` při přípravě tohoto reportu:
  `bdbf805516f78e6e5337b5a5fc52b4ccfa7aa663`
  (`Improve Vast rigs responsive dashboard`).

## Co zbývá

Tento release pouze monitoruje dostupný stav. Nezavádí vzdálené spouštění
modelů, plánování mezi Vast instancemi, dělení modelu přes více GPU, správu
podílů těžba/inference ani automatické přesměrování požadavků Hirana. Tyto
funkce vyžadují další návrh orchestrace, bezpečné správy přístupů a limitů
výkonu.
