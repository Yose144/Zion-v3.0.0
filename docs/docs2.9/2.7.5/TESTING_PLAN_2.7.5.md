# ZION 2.7.5 - Testing Plan

**Version**: 2.7.5 "AI Orchestrator & Round Table"  
**Status**: Ready for Testing  
**Date**: October 15, 2025  
**Duration**: 1-2 days comprehensive testing

---

## 🎯 Testing Objectives

1. **Verify AI Orchestrator functionality** - All 13 AI systems operational
2. **Test Round Table Council** - Governance mechanisms working
3. **Frontend stability** - No errors, smooth UX
4. **Backend reliability** - API responses consistent
5. **Integration testing** - All components working together
6. **Performance baseline** - Establish metrics for optimization

---

## 📋 Test Checklist

### 1. Frontend Testing (Priority: HIGH)

#### Dashboard (http://localhost:3007)
- [ ] Homepage loads without errors
- [ ] Navigation menu displays correctly
- [ ] All links functional
- [ ] Responsive design on different screen sizes
- [ ] No console errors in browser DevTools

#### AI Orchestrator (http://localhost:3007/ai)
- [ ] Page loads successfully
- [ ] All 13 AI systems displayed
- [ ] System cards show correct icons and colors
- [ ] Metrics display properly
- [ ] Status indicators working (online/offline/processing)
- [ ] Category grouping correct (Core/Advanced/Specialized/Mining)
- [ ] Action buttons responsive:
  - [ ] "Start Orchestration" button
  - [ ] "Convene Council" button
  - [ ] "View Round Table" button

#### Round Table Council (http://localhost:3007/round-table)
- [ ] Council page loads
- [ ] 12 Knights displayed with correct info
- [ ] Maitreya Buddha (admin) displayed
- [ ] Council actions functional
- [ ] Knight status indicators working

#### Components
- [ ] `SubliminalLayer.tsx` - No hydration errors
- [ ] `NavigationMenu.tsx` - AI Orchestrator icon/label correct
- [ ] Animations smooth (Framer Motion)
- [ ] No TypeScript errors in console

---

### 2. Backend Testing (Priority: HIGH)

#### AI Orchestrator Backend (Port 8001)
```bash
# Start backend
python ai_orchestrator_backend.py
```

- [ ] Backend starts without errors
- [ ] Port 8001 accessible
- [ ] CORS configured correctly

#### API Endpoints
Test všechny endpointy:

```bash
# Test components endpoint
curl http://localhost:8001/api/orchestrator/components

# Test Round Table endpoint
curl http://localhost:8001/api/round-table/knights

# Test system status
curl http://localhost:8001/api/status
```

**Expected Results**:
- [ ] `/api/orchestrator/components` returns 13 AI systems
- [ ] Response includes `system_state` and `orchestrator_active`
- [ ] All system metadata correct (name, icon, category, etc.)
- [ ] Round Table endpoint returns 12 Knights + admin
- [ ] No 500 errors or crashes

---

### 3. AI Systems Testing (Priority: MEDIUM)

#### Individual AI System Checks

**Core Systems**:
- [ ] **Oracle AI** - Prediction endpoints responding
- [ ] **Cosmic Analyzer** - Pattern analysis working
- [ ] **AI Afterburner** - Performance optimization active

**Advanced Systems**:
- [ ] **Quantum AI** - Cryptography functions available
- [ ] **Gaming AI** - Consciousness Mining integration
- [ ] **Lightning AI** - Network optimization metrics

**Specialized Systems**:
- [ ] **Bio AI** - Biometric systems accessible
- [ ] **Music AI** - Harmonic frequency functions
- [ ] **Trading Bot** - Market data retrievable
- [ ] **Blockchain Analytics** - Chain analysis working
- [ ] **Security Monitor** - Threat detection active

**Mining Systems**:
- [ ] **Cosmic AI** - Universal mining functions
- [ ] **Universal Miner** - Multi-algorithm coordinator

---

### 4. Integration Testing (Priority: MEDIUM)

#### Full Stack Integration
- [ ] Frontend → Backend communication stable
- [ ] API route (`/api/orchestrator/route.ts`) proxying correctly
- [ ] Mock data fallback working when backend down
- [ ] Error handling graceful
- [ ] Loading states display properly

#### Round Table ↔ AI Orchestrator
- [ ] Council decisions affect AI systems
- [ ] AI recommendations reach council
- [ ] Integration endpoints functional
- [ ] Data synchronization working

---

### 5. Blockchain Core Testing (Priority: MEDIUM)

#### Main Blockchain
```bash
# Start blockchain node
python new_zion_blockchain.py --p2p-port 8333 --rpc-port 8332
```

- [ ] Node starts successfully
- [ ] P2P connections establish
- [ ] RPC server responding
- [ ] Block generation working
- [ ] Transaction processing functional

#### Mining Pool
```bash
# Start mining pool
python zion_universal_pool_v2.py --port 3333
```

- [ ] Pool starts on port 3333
- [ ] Stratum protocol working
- [ ] Workers can connect
- [ ] Shares being tracked
- [ ] Payouts calculated

---

### 6. Golden Egg & Sacred Trinity Testing (Priority: LOW)

#### Documentation Verification
- [ ] `docs/SACRED_TRINITY/` directory accessible
- [ ] README.md loads with all 45+ avatars listed
- [ ] Individual avatar files (00-45) readable
- [ ] Sacred Trinity profiles complete:
  - [ ] Rama (Genesis Creator)
  - [ ] Síta/Issobela (Guardian of Humanity)
  - [ ] Hanuman (Environmental Guardian)
  - [ ] Maitreya Buddha (DAO Admin)

#### Avatar Categories Check
- [ ] **Christ Consciousness** (Yeshua, Meriam, Panna Maria)
- [ ] **Krishna Lineage** (Radha, Subhadra, Sri Dattatreya, etc.)
- [ ] **Buddhist Masters** (Tara, Avalokiteshvara, Vajrasattva)
- [ ] **Ascended Masters** (8 masters documented)
- [ ] **Legendary Heroes** (King Arthur, Karel IV, Babaji)
- [ ] **Cosmic Entities** (Hiranyagarbha, Sri Kalki Avatar)

#### Quest Integration (Future)
- [ ] Avatar profiles link to consciousness levels
- [ ] Golden Egg quest mechanics documented
- [ ] 3 Master Keys (Mind, Heart, Dharma) defined
- [ ] 1 billion ZION prize pool mechanics clear

---

### 7. Performance Testing (Priority: LOW)

#### Metrics to Collect
- [ ] Frontend load time
- [ ] API response times
- [ ] Backend memory usage
- [ ] CPU utilization
- [ ] Network bandwidth

#### Performance Baseline
Document current performance for optimization:
```
Frontend Load Time: _____ ms
API Response Time: _____ ms
Backend Memory: _____ MB
CPU Usage: _____ %
```

---

### 7. Performance Testing (Priority: LOW)

#### Metrics to Collect
- [ ] Frontend load time
- [ ] API response times
- [ ] Backend memory usage
- [ ] CPU utilization
- [ ] Network bandwidth

#### Performance Baseline
Document current performance for optimization:
```
Frontend Load Time: _____ ms
API Response Time: _____ ms
Backend Memory: _____ MB
CPU Usage: _____ %
```

---

### 8. Security Testing (Priority: MEDIUM)

#### Basic Security Checks
- [ ] CORS only allows expected origins
- [ ] No sensitive data in client-side code
- [ ] API endpoints have rate limiting (planned)
- [ ] Input validation on all forms
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities

---

## 🐛 Bug Tracking

### Known Issues
1. Backend occasionally stops - requires restart
2. Port 8001 sometimes needs manual cleanup
3. (Add new issues as discovered)

### Bug Report Template
```
**Title**: Brief description
**Priority**: High/Medium/Low
**Component**: Frontend/Backend/AI System/Blockchain
**Steps to Reproduce**:
1. Step 1
2. Step 2
3. ...
**Expected Behavior**: What should happen
**Actual Behavior**: What actually happens
**Logs/Errors**: Any console errors or logs
**Fix Ideas**: Possible solutions
```

---

## 📊 Test Results Documentation

### Test Session Info
```
Date: _____________
Tester: ___________
Duration: _________
Environment: Local/Production
```

### Component Status
```
✅ Frontend Dashboard: PASS/FAIL
✅ AI Orchestrator: PASS/FAIL
✅ Round Table: PASS/FAIL
✅ Backend API: PASS/FAIL
✅ Blockchain Core: PASS/FAIL
✅ Mining Pool: PASS/FAIL
```

### Critical Issues Found
```
1. [Issue description]
   - Severity: Critical/High/Medium/Low
   - Status: Open/In Progress/Resolved

2. [Issue description]
   - Severity: Critical/High/Medium/Low
   - Status: Open/In Progress/Resolved
```

### Performance Results
```
Frontend: _____ / 10
Backend: _____ / 10
Integration: _____ / 10
Overall: _____ / 10
```

---

## ✅ Sign-Off Criteria

Before moving to production or v2.8:
- [ ] All HIGH priority tests pass
- [ ] No critical bugs remain
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] Security review passed
- [ ] Stability test (24h uptime) passed

---

## 🚀 After Testing

### If PASS (Ready for Production)
1. Create production deployment plan
2. Set up monitoring infrastructure
3. Prepare rollback strategy
4. Schedule deployment window
5. Update status to "Production Ready"

### If FAIL (Needs Work)
1. Document all issues
2. Prioritize bug fixes
3. Create fix branches
4. Re-test after fixes
5. Update version to 2.7.5.1 (patch)

### If PARTIAL PASS (Most features work)
1. Tag current version as "beta"
2. Continue using for development
3. Fix issues incrementally
4. Plan 2.7.6 with fixes
5. Consider 2.8 in parallel

---

## 📝 Testing Commands Quick Reference

```bash
# Start all services
python new_zion_blockchain.py --p2p-port 8333 --rpc-port 8332  # Terminal 1
python ai_orchestrator_backend.py                               # Terminal 2
cd frontend && npm run dev                                       # Terminal 3
python zion_universal_pool_v2.py --port 3333                    # Terminal 4 (optional)

# Test APIs
curl http://localhost:8001/api/orchestrator/components | jq
curl http://localhost:8001/api/round-table/knights | jq
curl http://localhost:3007/api/orchestrator | jq

# Check processes
lsof -i :8001  # Backend
lsof -i :3007  # Frontend
lsof -i :8333  # Blockchain P2P
lsof -i :8332  # Blockchain RPC

# Monitor logs
tail -f ai_orchestrator.log
tail -f blockchain.log
tail -f frontend/npm.log
```

---

**Připraveno pro testování zítra! 🎯**

> Comprehensive, systematic, ready to find and fix any issues.
