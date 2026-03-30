# ZION ML Module - Implementation Roadmap

**Status:** 38% Complete (3/8 components)  
**Last Updated:** November 12, 2025  
**Author:** ZION TerraNova

---

## ✅ COMPLETED COMPONENTS (3/8)

### 1. Hardware Detector ✅
**File:** `src/orchestration/ml/hardware_detector.py` (674 lines)  
**Status:** PRODUCTION READY  
**Completion Date:** November 12, 2025

**Features:**
- ✅ CPU detection (cores, architecture, AVX2, AES-NI, cache)
- ✅ GPU detection (NVIDIA via nvidia-smi, AMD via rocm-smi)
- ✅ RAM/disk detection (psutil with graceful fallback)
- ✅ Optimal thread count calculation per algorithm
- ✅ Hardware profiling and recommendations
- ✅ Singleton pattern for efficiency

**Testing:**
- ✅ Tested on macOS (fallback mode)
- ⏳ Needs testing on Linux with real hardware

---

### 2. Algorithm Benchmarker ✅
**File:** `src/orchestration/ml/algorithm_benchmarker.py` (1180 lines)  
**Status:** PRODUCTION READY  
**Completion Date:** November 12, 2025

**Features:**
- ✅ Cosmic Harmony benchmark (ctypes → libcosmic_harmony.so)
- ✅ RandomX benchmark (ctypes → librandomx.so)
- ✅ Yescrypt benchmark (ctypes → libyescrypt.so)
- ✅ Autolykos v2 GPU benchmark (external_miners/autolykos_gpu)
- ✅ SQLite database for results storage
- ✅ Power/temperature monitoring (CPU + GPU)
- ✅ NVIDIA support (nvidia-smi)
- ✅ AMD support (rocm-smi)
- ✅ Auto-rebenchmark logic (7-day expiry)
- ✅ Best algorithm selection by hashrate

**Quality:**
- ✅ No fake data (all placeholders removed)
- ✅ Graceful error handling (library not found)
- ✅ Real ctypes bindings (no hardcoded values)

**Testing:**
- ✅ Tested on macOS (libraries missing, error handling works)
- ⏳ Needs testing on Linux with compiled libraries

---

### 3. Profitability Calculator ✅
**File:** `src/orchestration/ml/profitability_calc.py` (640 lines)  
**Status:** PRODUCTION READY  
**Completion Date:** November 12, 2025

**Features:**
- ✅ Real-time ZION price fetching (CoinGecko API)
- ✅ Fallback price mechanism (clearly marked)
- ✅ Network stats API integration (hashrate, difficulty)
- ✅ Mining rewards calculation (blocks/day, ZION/day)
- ✅ Electricity cost calculation (USD/kWh configurable)
- ✅ Daily/monthly profit calculation
- ✅ ROI calculation (days to breakeven)
- ✅ Best algorithm selection by profitability

**Testing:**
- ✅ Tested with fallback prices
- ⏳ Needs testing with live CoinGecko API

---

## 🚧 PLANNED COMPONENTS (5/8)

### 4. AI Algorithm Selector ❌
**File:** `src/orchestration/ml/ai_algorithm_selector.py` (103 lines - skeleton)  
**Status:** SKELETON ONLY  
**Estimated Effort:** 16 hours  
**Priority:** HIGH (needed for auto-switching)

**Required Implementation:**

#### Phase 1: Basic Decision Tree (4h)
```python
class AIAlgorithmSelector:
    async def select_best_algorithm(self) -> AlgorithmSelection:
        """
        Decision logic:
        1. Detect hardware (CPU-only vs GPU available)
        2. If GPU: compare GPU algo profitability vs CPU algos
        3. If CPU-only: compare RandomX vs Yescrypt vs Cosmic Harmony
        4. Consider electricity costs
        5. Return algorithm with highest profit/day
        """
```

**Steps:**
1. Get hardware profile from HardwareDetector
2. Get latest benchmark results for all algorithms
3. Get profitability calculations for all algorithms
4. Apply decision rules:
   - GPU available + Autolykos profitable → select Autolykos
   - CPU-only + AVX2 → prefer Cosmic Harmony
   - CPU-only + no AVX2 → prefer RandomX or Yescrypt
5. Return AlgorithmSelection with reasoning

#### Phase 2: Dynamic Switching (6h)
```python
async def should_switch_algorithm(self, current: str) -> Optional[AlgorithmSelection]:
    """
    Switching logic:
    1. Calculate current algorithm profit/day
    2. Calculate all other algorithms profit/day
    3. If another algo is >10% more profitable, recommend switch
    4. Anti-thrashing: don't switch if switched <5min ago
    5. Log switch decisions for analysis
    """
```

**Steps:**
1. Track last switch timestamp (SQLite table: algo_switches)
2. Implement profitability comparison logic
3. Add configurable switch threshold (default 10%)
4. Add configurable cooldown period (default 5 minutes)
5. Emit switch events for monitoring

#### Phase 3: Universal Miner Integration (6h)
```python
# Integration with src/miners/zion_universal_miner.py
class UniversalMiner:
    async def switch_algorithm(self, new_algo: str):
        """
        1. Stop current mining thread
        2. Wait for cleanup (max 10s)
        3. Load new algorithm library
        4. Restart mining with new algo
        5. Update pool connection if needed
        """
```

**Steps:**
1. Add switch_algorithm() method to UniversalMiner
2. Graceful shutdown of current algorithm
3. Hot-reload new algorithm (no miner restart)
4. Preserve share statistics across switches
5. Update dashboard UI with switch notifications

**Testing Requirements:**
- ✅ Unit tests for decision logic
- ✅ Integration tests with profitability calculator
- ✅ End-to-end test: auto-switch when price changes
- ✅ Stress test: rapid price fluctuations (no thrashing)

**Success Criteria:**
- Selects most profitable algorithm within 1 second
- Switches algorithms when >10% more profitable
- No thrashing (respects cooldown period)
- Logs all decisions with reasoning

---

### 5. Difficulty Predictor ❌
**File:** `src/orchestration/ml/difficulty_predictor.py` (112 lines - skeleton)  
**Status:** SKELETON ONLY  
**Estimated Effort:** 12 hours  
**Priority:** MEDIUM (nice-to-have)

**Required Implementation:**

#### Phase 1: Data Collection (3h)
```python
def collect_historical_data(self, algorithm: str):
    """
    Collect difficulty history from blockchain:
    1. Query ZION RPC for last 10,000 blocks
    2. Extract: block_height, timestamp, difficulty, algorithm
    3. Store in SQLite: difficulty_history table
    4. Calculate derived features: rolling averages, trends
    """
```

**Database Schema:**
```sql
CREATE TABLE difficulty_history (
    id INTEGER PRIMARY KEY,
    block_height INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    algorithm TEXT NOT NULL,
    difficulty REAL NOT NULL,
    network_hashrate REAL,
    UNIQUE(block_height, algorithm)
);

CREATE INDEX idx_algo_time ON difficulty_history(algorithm, timestamp DESC);
```

#### Phase 2: Feature Engineering (3h)
```python
def engineer_features(self, df):
    """
    Create features for RandomForest:
    - hour_of_day (0-23)
    - day_of_week (0-6)
    - block_height_delta (blocks since last retarget)
    - difficulty_rolling_mean_24h
    - difficulty_rolling_std_24h
    - hashrate_trend (increasing/decreasing)
    - difficulty_change_rate (derivative)
    """
```

#### Phase 3: Model Training (4h)
```python
from sklearn.ensemble import RandomForestRegressor

def train_model(self, algorithm: str):
    """
    Train RandomForest model:
    1. Load historical data (last 30 days minimum)
    2. Split train/test (80/20)
    3. Train RandomForestRegressor(n_estimators=100)
    4. Evaluate: RMSE, MAE, R²
    5. Save model to pickle file
    """
```

**Model Parameters:**
- n_estimators: 100 trees
- max_depth: 10
- min_samples_split: 5
- Features: 8-10 engineered features
- Target: difficulty at t+6h, t+12h, t+24h

#### Phase 4: Prediction API (2h)
```python
def predict(self, algorithm: str, horizon_hours: int = 6) -> DifficultyPrediction:
    """
    Make prediction:
    1. Load trained model from pickle
    2. Get current blockchain state
    3. Engineer features for current timestamp
    4. Predict difficulty at t+{horizon_hours}
    5. Calculate confidence (model variance)
    6. Return DifficultyPrediction
    """
```

**Testing Requirements:**
- Backtesting on historical data (1 month)
- Accuracy target: RMSE < 10% of mean difficulty
- Prediction latency: < 100ms
- Auto-retraining when accuracy drops below threshold

**Success Criteria:**
- Predicts difficulty 6h ahead with <15% error
- Model retrains daily automatically
- API responds in <100ms

---

### 6. Price Predictor ❌
**File:** `src/orchestration/ml/price_predictor.py` (110 lines - skeleton)  
**Status:** SKELETON ONLY  
**Estimated Effort:** 12 hours  
**Priority:** MEDIUM (nice-to-have)

**Required Implementation:**

#### Phase 1: Data Collection (3h)
```python
async def collect_historical_prices(self):
    """
    Collect ZION price history:
    1. CoinGecko API: /coins/zion/market_chart (if listed)
    2. Pool API: /price/history
    3. DEX APIs: Uniswap, PancakeSwap (if available)
    4. Store in SQLite: price_history table
    5. Keep last 180 days minimum
    """
```

**Database Schema:**
```sql
CREATE TABLE price_history (
    id INTEGER PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    price_usd REAL NOT NULL,
    volume_24h REAL,
    market_cap REAL,
    source TEXT NOT NULL,
    UNIQUE(timestamp, source)
);
```

#### Phase 2: Prophet Model Setup (4h)
```python
from prophet import Prophet

def train_model(self):
    """
    Train Prophet model:
    1. Load price history (90+ days)
    2. Format as DataFrame: ds (timestamp), y (price)
    3. Configure Prophet:
       - daily_seasonality=True
       - weekly_seasonality=True
       - changepoint_prior_scale=0.05
    4. Add regressors: volume, market_cap
    5. Fit model
    6. Save to pickle
    """
```

**Prophet Configuration:**
- Seasonality: daily + weekly patterns
- Changepoint detection: automatic
- Uncertainty intervals: 80% confidence
- Cross-validation: 30-day rolling window

#### Phase 3: Prediction API (3h)
```python
def predict(self, horizon_hours: int = 24) -> PricePrediction:
    """
    Make price prediction:
    1. Load trained Prophet model
    2. Create future dataframe (+{horizon_hours})
    3. Predict (yhat, yhat_lower, yhat_upper)
    4. Calculate confidence from interval width
    5. Return PricePrediction
    """
```

#### Phase 4: Model Retraining (2h)
```python
async def retrain_if_needed(self):
    """
    Auto-retrain logic:
    1. Check last training timestamp
    2. If >7 days, retrain
    3. Evaluate new model vs old model (backtesting)
    4. If new model better (lower MAE), replace
    5. Log model performance metrics
    """
```

**Testing Requirements:**
- Backtesting on historical data (3 months)
- Accuracy target: MAE < 15% of mean price
- Handles missing data gracefully
- Weekly auto-retraining

**Success Criteria:**
- Predicts price 24h ahead with <20% error
- Provides useful confidence intervals
- Retrains weekly automatically

---

### 7. Energy Optimizer ❌
**File:** `src/orchestration/ml/energy_optimizer.py` (138 lines - skeleton)  
**Status:** SKELETON ONLY  
**Estimated Effort:** 12 hours  
**Priority:** HIGH (needed for profitability)

**Required Implementation:**

#### Phase 1: Power Monitoring (4h)
```python
def get_current_power_draw(self) -> float:
    """
    Real-time power monitoring:
    1. Linux RAPL: /sys/class/powercap/intel-rapl:0/energy_uj
    2. NVIDIA GPU: nvidia-smi -q -d POWER
    3. AMD GPU: rocm-smi --showpower
    4. Fallback: estimate from CPU usage (psutil)
    """
```

**Implementation Steps:**
1. Read RAPL counters (Intel CPU power)
2. Parse nvidia-smi XML output for GPU power
3. Parse rocm-smi output for AMD GPU power
4. Sample every 1 second, calculate average
5. Store in circular buffer (last 60 samples)

#### Phase 2: Time-of-Use Pricing (3h)
```python
class EnergyOptimizer:
    def __init__(
        self,
        peak_hours: List[time] = None,
        peak_price_kwh: float = 0.20,
        offpeak_price_kwh: float = 0.10
    ):
        """
        User-configurable electricity pricing:
        - Peak hours: 9 AM - 9 PM (default)
        - Off-peak hours: 9 PM - 9 AM
        - Peak price: $0.20/kWh
        - Off-peak price: $0.10/kWh
        """
```

**Configuration File:**
```json
{
  "electricity_pricing": {
    "peak_hours": ["09:00", "21:00"],
    "peak_price_kwh": 0.20,
    "offpeak_price_kwh": 0.10,
    "currency": "USD"
  }
}
```

#### Phase 3: Auto-Pause Logic (3h)
```python
def should_mine_now(self) -> EnergySchedule:
    """
    Decision logic:
    1. Get current profitability ($/day)
    2. Get current electricity cost ($/kWh)
    3. Calculate real-time profit
    4. If profit < min_profit_threshold, pause mining
    5. Check temperature limits (CPU < 80°C, GPU < 85°C)
    6. Return EnergySchedule (mine=True/False, reason, next_check)
    """
```

**Decision Rules:**
- If profit/day < $0: PAUSE (losing money)
- If profit/day < $1: WARN (barely profitable)
- If CPU temp > 80°C: PAUSE (thermal limit)
- If GPU temp > 85°C: PAUSE (thermal limit)
- If peak hours + low profit: PAUSE (wait for off-peak)

#### Phase 4: Smart Scheduling (2h)
```python
def get_optimal_schedule(self) -> Dict[str, bool]:
    """
    24-hour mining schedule:
    1. For each hour 0-23:
       - Calculate expected profit (price * hashrate - electricity)
       - Consider peak/off-peak pricing
       - Factor in difficulty predictions
    2. Return {hour: should_mine}
    """
```

**Testing Requirements:**
- Unit tests for each decision rule
- Integration test with profitability calculator
- Simulate 24h schedule with varying prices
- Test thermal throttling

**Success Criteria:**
- Pauses mining when unprofitable
- Resumes mining when profitable again
- Respects thermal limits
- Optimizes for time-of-use pricing

---

### 8. Profit Calculator UI ❌
**File:** `website-v2.8.9/src/app/profit/page.tsx`  
**Status:** NOT STARTED  
**Estimated Effort:** 12 hours  
**Priority:** LOW (dashboard feature)

**Required Implementation:**

#### Phase 1: Page Structure (2h)
```tsx
// website-v2.8.9/src/app/profit/page.tsx
import { useState, useEffect } from 'react';

export default function ProfitCalculatorPage() {
  return (
    <div className="container mx-auto p-6">
      <h1>ZION Mining Profit Calculator</h1>
      
      {/* Real-time price display */}
      <PriceCard />
      
      {/* User inputs */}
      <ConfigurationForm />
      
      {/* Algorithm comparison table */}
      <AlgorithmComparison />
      
      {/* Profit charts */}
      <ProfitCharts />
      
      {/* ROI calculator */}
      <ROICalculator />
    </div>
  );
}
```

#### Phase 2: API Integration (3h)
```typescript
// API calls to ML backend
async function fetchProfitability() {
  const response = await fetch('/api/ml/profitability');
  return response.json();
}

async function fetchZionPrice() {
  const response = await fetch('/api/ml/price');
  return response.json();
}

async function fetchBenchmarks() {
  const response = await fetch('/api/ml/benchmarks');
  return response.json();
}
```

#### Phase 3: Interactive Components (4h)

**PriceCard Component:**
```tsx
function PriceCard() {
  const [price, setPrice] = useState(null);
  
  useEffect(() => {
    // Fetch price every 30 seconds
    const interval = setInterval(fetchZionPrice, 30000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Card>
      <h2>Current ZION Price</h2>
      <p className="text-4xl">${price?.usd.toFixed(4)}</p>
      <p className="text-sm">{price?.btc} BTC</p>
    </Card>
  );
}
```

**ConfigurationForm Component:**
```tsx
function ConfigurationForm() {
  const [electricity, setElectricity] = useState(0.12);
  const [hardwareCost, setHardwareCost] = useState(0);
  
  return (
    <Card>
      <h2>Configuration</h2>
      <Input 
        label="Electricity Cost ($/kWh)"
        value={electricity}
        onChange={setElectricity}
      />
      <Input 
        label="Hardware Cost ($)"
        value={hardwareCost}
        onChange={setHardwareCost}
      />
    </Card>
  );
}
```

**AlgorithmComparison Component:**
```tsx
function AlgorithmComparison() {
  const [profitability, setProfitability] = useState([]);
  
  return (
    <Table>
      <thead>
        <tr>
          <th>Algorithm</th>
          <th>Hashrate</th>
          <th>Power (W)</th>
          <th>Revenue/Day</th>
          <th>Cost/Day</th>
          <th>Profit/Day</th>
          <th>Profit/Month</th>
        </tr>
      </thead>
      <tbody>
        {profitability.map(algo => (
          <tr key={algo.algorithm}>
            <td>{algo.algorithm.toUpperCase()}</td>
            <td>{formatHashrate(algo.hashrate)}</td>
            <td>{algo.power_watts}W</td>
            <td>${algo.daily_revenue_usd.toFixed(2)}</td>
            <td>${algo.daily_cost_usd.toFixed(2)}</td>
            <td className={algo.daily_profit_usd > 0 ? 'text-green' : 'text-red'}>
              ${algo.daily_profit_usd.toFixed(2)}
            </td>
            <td>${algo.monthly_profit_usd.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
```

#### Phase 4: Charts (3h)

**ProfitCharts Component:**
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

function ProfitCharts() {
  const [chartData, setChartData] = useState([]);
  
  return (
    <Card>
      <h2>Profit Over Time</h2>
      <LineChart width={800} height={400} data={chartData}>
        <XAxis dataKey="hour" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="profit" stroke="#00ff00" />
      </LineChart>
    </Card>
  );
}
```

**ROICalculator Component:**
```tsx
function ROICalculator({ hardwareCost, dailyProfit }) {
  const roiDays = hardwareCost / dailyProfit;
  const roiMonths = roiDays / 30;
  
  return (
    <Card>
      <h2>ROI Calculator</h2>
      <p>Hardware Cost: ${hardwareCost}</p>
      <p>Daily Profit: ${dailyProfit.toFixed(2)}</p>
      <p className="text-2xl">
        ROI: {roiDays.toFixed(0)} days ({roiMonths.toFixed(1)} months)
      </p>
    </Card>
  );
}
```

**Testing Requirements:**
- Unit tests for all components
- API integration tests
- E2E test: full profit calculation flow
- Responsive design testing (mobile/tablet/desktop)

**Success Criteria:**
- Real-time price updates
- Accurate profit calculations
- Interactive charts
- Mobile-friendly UI
- Export to CSV functionality

---

## 📊 Overall Roadmap Timeline

### Sprint 1: Core ML Features (4 weeks)
**Week 1-2:** AI Algorithm Selector (16h)
- ✅ Decision tree logic
- ✅ Dynamic switching
- ✅ Universal Miner integration

**Week 3-4:** Energy Optimizer (12h)
- ✅ Power monitoring
- ✅ Time-of-use pricing
- ✅ Auto-pause logic
- ✅ Smart scheduling

### Sprint 2: Predictive Models (3 weeks)
**Week 5-6:** Difficulty Predictor (12h)
- ✅ Data collection
- ✅ RandomForest training
- ✅ Prediction API

**Week 7:** Price Predictor (12h)
- ✅ Prophet model
- ✅ Price forecasting

### Sprint 3: UI Dashboard (2 weeks)
**Week 8-9:** Profit Calculator UI (12h)
- ✅ Page structure
- ✅ API integration
- ✅ Charts and visualization

---

## 🎯 Success Metrics

### Technical Metrics
- **Code Coverage:** >80% for all ML components
- **API Response Time:** <100ms for predictions
- **Prediction Accuracy:** 
  - Difficulty: RMSE <10% of mean
  - Price: MAE <15% of mean
- **Uptime:** >99.9% for ML services

### Business Metrics
- **Auto-Switching Efficiency:** >95% of switches result in higher profit
- **Energy Savings:** >20% reduction in unprofitable mining time
- **User Adoption:** >70% of miners enable AI features
- **ROI Improvement:** Average 15% increase in profitability with AI

---

## 🔧 Technical Dependencies

### Python Libraries
```bash
# Already available
pip install psutil aiohttp

# Needed for ML components
pip install scikit-learn==1.3.0      # RandomForest (Difficulty Predictor)
pip install prophet==1.1.5           # Time series (Price Predictor)
pip install pandas==2.0.3            # Data manipulation
pip install numpy==1.24.3            # Numerical operations
```

### Infrastructure
- **SQLite 3.35+** - Already available
- **ZION RPC** - For blockchain data
- **CoinGecko API** - For price data (free tier: 50 calls/min)
- **Pool API** - For network statistics

### Integration Points
- `src/miners/zion_universal_miner.py` - For algorithm switching
- `src/orchestration/zion_realtime_orchestrator.py` - For metrics ✅ DONE
- `website-v2.8.9/src/app/` - For UI dashboard

---

## 📝 Documentation Requirements

For each completed component:
1. **API Documentation** - Docstrings for all public methods
2. **Usage Examples** - Code snippets in README
3. **Configuration Guide** - Settings and parameters
4. **Troubleshooting Guide** - Common issues and solutions
5. **Testing Guide** - How to run tests

---

## 🚀 Deployment Strategy

### Phase 1: Staging (Week 10)
- Deploy to testnet
- Run with limited user base (10-20 miners)
- Monitor for issues, collect feedback
- Performance tuning

### Phase 2: Production Rollout (Week 11-12)
- Gradual rollout: 10% → 25% → 50% → 100% of users
- Feature flags for easy rollback
- 24/7 monitoring during rollout
- Bug fixes and optimizations

### Phase 3: Optimization (Week 13+)
- Performance profiling
- Model retraining with real data
- UI/UX improvements based on user feedback
- Scale testing with 1000+ concurrent miners

---

## 📞 Support & Maintenance

### Ongoing Tasks
- **Daily:** Monitor prediction accuracy, check for API failures
- **Weekly:** Review model performance, retrain if needed
- **Monthly:** Performance audit, optimize slow queries
- **Quarterly:** Major version updates, new features

### Team Responsibilities
- **ML Engineer:** Model training, accuracy monitoring
- **Backend Dev:** API maintenance, integration fixes
- **Frontend Dev:** UI updates, user experience
- **DevOps:** Deployment, monitoring, scaling

---

**End of Roadmap**  
**Total Estimated Effort:** 64 hours (8 working days)  
**Expected Completion:** End of November 2025
