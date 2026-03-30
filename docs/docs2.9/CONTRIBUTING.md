# Přispívání do ZION

Děkujeme za zájem přispět do projektu ZION! Toto je průvodce, jak přispět efektivně a v souladu s našimi standardy.

## 📋 Obsah

- [Code of Conduct](#code-of-conduct)
- [Jak mohu přispět?](#jak-mohu-přispět)
- [Development setup](#development-setup)
- [Coding standards](#coding-standards)
- [Testing guidelines](#testing-guidelines)
- [Pull request proces](#pull-request-proces)
- [Commit messages](#commit-messages)
- [Reporting bugs](#reporting-bugs)
- [Feature requests](#feature-requests)

---

## Code of Conduct

### Náš závazek

V zájmu podpory otevřeného a přívětivého prostředí se jako přispěvatelé a udržovatelé zavazujeme, že účast na našem projektu a naší komunitě bude bez obtěžování pro všechny.

### Naše standardy

**Příklady chování, které vytváří pozitivní prostředí:**

- Používání přívětivého a inkluzivního jazyka
- Respektování odlišných názorů a zkušeností
- Přijímání konstruktivní kritiky s grácií
- Zaměření na to, co je nejlepší pro komunitu
- Projevování empatie vůči ostatním členům komunity

**Příklady nepřijatelného chování:**

- Používání sexualizovaného jazyka nebo obrázků
- Trolling, urážlivé komentáře, osobní nebo politické útoky
- Veřejné nebo soukromé obtěžování
- Zveřejňování soukromých informací ostatních bez výslovného svolení
- Jiné chování, které by mohlo být považováno za nevhodné v profesionálním prostředí

---

## Jak mohu přispět?

### 🐛 Hlášení bugů

Před vytvořením bug reportu:

1. **Zkontrolujte dokumentaci** - problém může být již vyřešen
2. **Vyhledejte existující issues** - možná už byl bug nahlášen
3. **Zkuste reprodukovat** - ujistěte se, že bug je konzistentní

**Jak vytvořit dobrý bug report:**

```markdown
**Popis**
Jasný a stručný popis problému.

**Kroky k reprodukci**
1. Přejít na '...'
2. Kliknout na '...'
3. Scrollovat dolů na '...'
4. Vidět chybu

**Očekávané chování**
Jasný popis toho, co jste očekávali.

**Aktuální chování**
Co se skutečně stalo.

**Screenshots**
Pokud je to relevantní, přidejte screenshots.

**Prostředí:**
 - OS: [např. Ubuntu 22.04]
 - Python verze: [např. 3.11.5]
 - ZION verze: [např. 2.8.9]

**Dodatečný kontext**
Jakékoliv další informace o problému.
```

### 💡 Návrhy funkcí

**Před návrhem funkce:**

1. Zkontrolujte roadmap - funkce může být již plánována
2. Vyhledejte existující feature requesty
3. Zvažte, zda funkce zapadá do scope projektu

**Jak vytvořit dobrý feature request:**

```markdown
**Je váš feature request související s problémem?**
Jasný popis problému. např. "Frustruje mě, když..."

**Popište řešení, které byste chtěli**
Jasný popis toho, co chcete, aby se stalo.

**Popište alternativy, které jste zvažovali**
Jasný popis alternativních řešení, které jste zvažovali.

**Dodatečný kontext**
Jakékoliv další informace o feature requestu.

**Use cases**
Příklady, kdy by tato funkce byla užitečná.
```

### 🔧 Code contributions

**Oblasti, kde můžete přispět:**

- ✅ Oprava bugů
- ✅ Implementace nových funkcí
- ✅ Zlepšení výkonu
- ✅ Dokumentace
- ✅ Testy
- ✅ Code reviews

---

## Development Setup

### 1. Fork & Clone

```bash
# Fork repozitář na GitHubu
# Poté klonujte svůj fork

git clone https://github.com/YOUR_USERNAME/Zion-2.9.git
cd Zion-2.9

# Přidejte upstream remote
git remote add upstream https://github.com/Yose144/Zion-2.9.git
```

### 2. Vytvoření branch

```bash
# Ujistěte se, že jste na main
git checkout main

# Aktualizujte z upstream
git fetch upstream
git merge upstream/main

# Vytvořte feature branch
git checkout -b feature/your-feature-name
```

Naming conventions pro branches:
- `feature/` - nové funkce
- `bugfix/` - opravy bugů
- `hotfix/` - kritické opravy
- `docs/` - změny v dokumentaci
- `test/` - přidání nebo úprava testů
- `refactor/` - refaktoring kódu

### 3. Setup vývojového prostředí

```bash
# Vytvořte virtuální prostředí
python3.11 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Instalace všech závislostí (včetně dev tools)
pip install --upgrade pip
pip install -r requirements.txt

# Ověření instalace
pytest --version
black --version
flake8 --version
mypy --version
```

### 4. Instalace pre-commit hooks (volitelné, ale doporučené)

```bash
pip install pre-commit
pre-commit install
```

Toto automaticky spustí code quality checks před každým commitem.

---

## Coding Standards

### Python Style Guide

Dodržujeme **PEP 8** s následujícími konfiguracemi:

**Formátování:**
- **Black** - automatické formátování
  - Line length: 100 znaků
  - Target: Python 3.11
  
```bash
black src/ tests/
```

**Import sorting:**
- **isort** - třídění importů
  - Profile: black-compatible
  
```bash
isort src/ tests/
```

**Linting:**
- **flake8** - code linting
  - Max line length: 100
  - Max complexity: 15
  
```bash
flake8 src/ tests/
```

**Type checking:**
- **mypy** - static type checking
  - Python version: 3.11
  - Strict equality enabled
  
```bash
mypy src/
```

### Code Quality Checklist

Před submitem PR ujistěte se, že:

- [ ] Kód je formátovaný pomocí Black
- [ ] Importy jsou seřazeny pomocí isort
- [ ] Flake8 nehlásí žádné warningy
- [ ] MyPy type checking prošel
- [ ] Všechny testy projdou
- [ ] Nový kód má testy (90%+ coverage)
- [ ] Dokumentace je aktualizována
- [ ] Commit messages následují guidelines

**Automatická kontrola:**

```bash
# Formátování a linting
black src/ tests/
isort src/ tests/
flake8 src/ tests/
mypy src/

# Testy
pytest --cov=src --cov-fail-under=90

# Bezpečnost
bandit -r src/
```

### Docstring Standards

Používáme **Google style docstrings**:

```python
def calculate_hashrate(shares: int, difficulty: float, time_window: int) -> float:
    """Vypočítá hashrate na základě přijatých shares.

    Args:
        shares: Počet přijatých shares
        difficulty: Aktuální difficulty
        time_window: Časové okno v sekundách

    Returns:
        Hashrate v H/s

    Raises:
        ValueError: Pokud time_window je 0 nebo záporný

    Example:
        >>> calculate_hashrate(100, 1000.0, 60)
        1666.67
    """
    if time_window <= 0:
        raise ValueError("Time window must be positive")
    
    return (shares * difficulty * 2**32) / time_window
```

### Type Hints

Vždy používejte type hints pro:
- Parametry funkcí
- Return values
- Class attributes
- Module-level variables

```python
from typing import Optional, List, Dict

def get_miner_stats(
    address: str,
    period: str = "hourly",
    limit: Optional[int] = None
) -> List[Dict[str, any]]:
    """Get miner statistics."""
    ...
```

---

## Testing Guidelines

### Test Structure

```
tests/
├── unit/              # Jednotkové testy (izolované, rychlé)
├── integration/       # Integrační testy (více komponent)
├── e2e/              # End-to-end testy (celý systém)
└── performance/      # Performance testy a benchmarky
```

### Writing Tests

**Unit test příklad:**

```python
import pytest
from src.database.historical_stats import HistoricalStatsDB

@pytest.fixture
def stats_db():
    """Fixture pro testovací databázi."""
    db = HistoricalStatsDB(":memory:")
    yield db
    db.close()

def test_record_miner_stat(stats_db):
    """Test zaznamenání miner statistiky."""
    # Arrange
    address = "test_address_123"
    hashrate = 1000.0
    
    # Act
    stats_db.record_miner_stat(address, hashrate, shares=10)
    
    # Assert
    stats = stats_db.get_miner_stats(address, period="hourly", limit=1)
    assert len(stats) == 1
    assert stats[0]["avg_hashrate"] == hashrate
```

**Integration test příklad:**

```python
import pytest
from fastapi.testclient import TestClient
from src.main import app

@pytest.fixture
def client():
    """Test client pro FastAPI."""
    return TestClient(app)

@pytest.mark.integration
def test_get_pool_history(client):
    """Test získání pool historie přes API."""
    response = client.get("/v2.8.8/history/pool?period=hourly&limit=10")
    
    assert response.status_code == 200
    data = response.json()
    assert "stats" in data
    assert len(data["stats"]) <= 10
```

### Test Coverage

**Minimální požadavky:**
- **Overall coverage**: 90%+
- **Branch coverage**: Zapnuto
- **Nový kód**: 100% pokrytí

```bash
# Spuštění testů s coverage
pytest --cov=src --cov-report=html --cov-fail-under=90

# Zobrazení HTML reportu
open htmlcov/index.html
```

### Test Markers

Použijte pytest markers pro organizaci testů:

```python
@pytest.mark.unit
def test_unit_function():
    """Jednotkový test."""
    pass

@pytest.mark.integration
def test_integration_flow():
    """Integrační test."""
    pass

@pytest.mark.e2e
def test_end_to_end():
    """E2E test."""
    pass

@pytest.mark.slow
def test_performance_benchmark():
    """Pomalý test."""
    pass
```

Spuštění specifických testů:

```bash
pytest -m unit          # Pouze unit testy
pytest -m "not slow"    # Všechny kromě slow testů
pytest -m "integration or e2e"  # Integration a E2E
```

---

## Pull Request Proces

### 1. Před vytvořením PR

**Checklist:**

- [ ] Kód je aktuální s main branch
- [ ] Všechny testy projdou lokálně
- [ ] Code quality checks projdou
- [ ] Dokumentace je aktualizována
- [ ] CHANGELOG.md je aktualizován (pokud je to významná změna)
- [ ] Screenshots/GIFs přidány pro UI změny

```bash
# Aktualizace z upstream
git fetch upstream
git rebase upstream/main

# Finální kontrola
black src/ tests/
isort src/ tests/
flake8 src/ tests/
mypy src/
pytest --cov=src --cov-fail-under=90
```

### 2. Vytvoření Pull Request

**PR Title:**
- Používejte jasný, deskriptivní title
- Začněte s typem: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `perf:`

Příklady:
```
feat: Add WebSocket support for real-time mining stats
fix: Resolve database connection leak in pool manager
docs: Update API documentation for v2.8.9 endpoints
refactor: Simplify historical stats aggregation logic
test: Add integration tests for dApp provider
perf: Optimize database queries for leaderboard
```

**PR Description Template:**

```markdown
## Popis
Jasný a stručný popis změn.

## Typ změny
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix nebo feature, které by způsobil non-funkční existující funkcionalitu)
- [ ] Dokumentace update
- [ ] Performance improvement

## Jak bylo testováno?
Popis testů, které jste provedli.

## Checklist:
- [ ] Můj kód dodržuje coding standards projektu
- [ ] Provedl jsem self-review svého kódu
- [ ] Okomentoval jsem složitý kód
- [ ] Provedl jsem odpovídající změny v dokumentaci
- [ ] Moje změny negenerují nové warningy
- [ ] Přidal jsem testy, které prokazují, že můj fix je funkční / feature funguje
- [ ] Nové i existující unit testy projdou lokálně
- [ ] Všechny dependent změny byly mergnuy a publikovány

## Screenshots (pokud je to relevantní):
Přidejte screenshots pro vizuální změny.

## Související Issues:
Closes #123
Related to #456
```

### 3. Code Review Proces

**Co očekávat:**

1. **Automated checks** - CI/CD pipeline spustí testy automaticky
2. **Code review** - Maintainer zkontroluje kód
3. **Feedback** - Může být požadováno provedení změn
4. **Approval** - Po schválení bude PR mergnuto

**Review timeline:**
- Iniciální response: 1-3 dny
- Kompletní review: 3-7 dní
- Emergency fixes: <24 hodin

### 4. Addressing Review Comments

```bash
# Proveďte požadované změny
# Commitněte změny
git add .
git commit -m "Address review comments"

# Push do vašeho forku
git push origin feature/your-feature-name
```

PR bude automaticky aktualizován.

### 5. Po Merge

```bash
# Aktualizujte svůj local main
git checkout main
git pull upstream main

# Smažte feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

---

## Commit Messages

### Formát

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**
- `feat`: Nová funkce
- `fix`: Bug fix
- `docs`: Dokumentace
- `style`: Formátování, chybějící středníky
- `refactor`: Refaktoring kódu
- `perf`: Performance improvement
- `test`: Přidání testů
- `chore`: Maintenance úkoly

**Scope (volitelný):**
- `api`: API změny
- `db`: Databázové změny
- `pool`: Mining pool
- `ws`: WebSocket
- `docs`: Dokumentace
- `tests`: Testy

**Subject:**
- Max 72 znaků
- Imperativní mood ("add" ne "added")
- Bez velkého písmene na začátku
- Bez tečky na konci

**Body (volitelný):**
- Vysvětlení "co" a "proč" ne "jak"
- Wrap at 72 characters

**Footer (volitelný):**
- Reference k issues: `Closes #123`, `Fixes #456`
- Breaking changes: `BREAKING CHANGE: description`

### Příklady

**Good:**
```
feat(api): add WebSocket endpoint for real-time stats

Implements WebSocket connection at /v2.8.8/ws/{client_id}
Supports subscription to pool_stats, block_mined, miner_hashrate events
Handles 1000+ concurrent connections with <100ms latency

Closes #789
```

**Good (simple):**
```
fix(db): resolve connection leak in historical stats
```

**Good (breaking change):**
```
feat(api): redesign authentication mechanism

BREAKING CHANGE: API now requires JWT tokens instead of API keys.
Clients must update their authentication flow.
```

**Bad:**
```
fixed stuff  # Příliš vague
```

**Bad:**
```
Added new feature to the API for getting stats and also fixed a bug
in the database and updated some docs  # Příliš mnoho změn v jednom commitu
```

---

## Bezpečnostní issues

**Nenalézejte bezpečnostní zranitelnosti veřejně!**

Pokud objevíte bezpečnostní problém:

1. **Netvořte GitHub issue**
2. Email na: security@zionterranova.com
3. Uveďte detailní popis zranitelnosti
4. Uveďte kroky k reprodukci
5. Navrhněte možné řešení (pokud máte)

**Bug bounty program:**
- Critical: $1,000 - $5,000
- High: $500 - $1,000
- Medium: $100 - $500
- Low: $50 - $100

---

## Pomoc a podpora

**Potřebujete pomoc?**

- 📖 **Dokumentace**: [docs/](docs/)
- 💬 **Discord**: [Join server](https://discord.gg/zion)
- 📧 **Email**: admin@zionterranova.com
- 🐛 **GitHub Issues**: [Open issue](https://github.com/Yose144/Zion-2.9/issues)

**Pravidelné community calls:**
- Každou první středu v měsíci
- 18:00 CET
- Discord voice channel

---

## Uznání

Přispěvatelé budou uvedeni v:

- **README.md** - Contributors section
- **CHANGELOG.md** - Pro významné změny
- **GitHub contributors** - Automaticky

**Hall of Fame:**
Top přispěvatelé každého kvartálu budou uznáni na našem webu a sociálních médiích.

---

## Licence

Přispěním do ZION souhlasíte s tím, že váš kód bude licencován pod [MIT License](LICENSE).

---

**Děkujeme za váš příspěvek do ZION! 🙏**

Každý příspěvek, ať už velký nebo malý, nám pomáhá vytvářet lepší blockchain platformu. Těšíme se na vaši spolupráci!

---

*Poslední aktualizace: v2.8.9 - November 2025*
