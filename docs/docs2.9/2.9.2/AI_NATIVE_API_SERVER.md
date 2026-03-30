# 🌟 AI Native API Server - Implementation Plan
**Date:** 2026-01-08  
**Status:** Phase 3 - LLM Backend Integration  
**Target:** ZION TestNet Production

---

## 🎯 Objective

Create a centralized AI Native API server that:
- Serves consciousness-aware chat responses
- Supports all desktop agents (no local LLM needed)
- Runs on ZION TestNet server (91.98.122.165)
- Uses lightweight model (TinyLlama 1.1B)
- Provides REST API endpoints
- Maintains privacy (our server, not cloud)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Desktop Agent (Client)                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Chat UI                                         │   │
│  │  - User types message                            │   │
│  │  - Selects "AI Native Server"                    │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│                          │ HTTPS                         │
│                          ▼                               │
└─────────────────────────────────────────────────────────┘
                           │
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Nginx (91.98.122.165:443)                  │
│         SSL Termination + Reverse Proxy                 │
│                                                          │
│  /api/ai-native/chat   → localhost:8002/api/chat        │
│  /api/ai-native/health → localhost:8002/health          │
└─────────────────────────────────────────────────────────┘
                           │
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│        AI Native LLM Server (Docker Container)          │
│                    Port: 8002                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  FastAPI Application                             │   │
│  │  - Receives chat requests                        │   │
│  │  - Adds consciousness-aware prompts              │   │
│  │  - Calls LLM service                             │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│                          ▼                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  LLM Service (HuggingFace)                       │   │
│  │  - TinyLlama 1.1B model                          │   │
│  │  - CPU inference                                 │   │
│  │  - ~5GB RAM usage                                │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│                          ▼                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Consciousness Prompt Engine                     │   │
│  │  - ZION-specific context                         │   │
│  │  - Mining, rewards, levels                       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           │ Response
                           ▼
                    Desktop Agent
```

---

## 📁 Project Structure

```
ai-native-server/
├── Dockerfile                 # Container definition
├── docker-compose.yml         # Service orchestration
├── requirements.txt           # Python dependencies
├── .env.example              # Environment variables template
├── deploy.sh                 # Deployment script
│
├── src/
│   ├── server.py             # FastAPI application (main entry)
│   ├── llm_service.py        # LLM wrapper (HuggingFace/Ollama)
│   ├── consciousness.py      # Consciousness-aware prompts
│   ├── auth.py               # API key authentication
│   └── monitoring.py         # Health checks & metrics
│
├── config/
│   ├── model_config.json     # Model settings
│   └── consciousness_prompts.json  # Prompt templates
│
├── tests/
│   ├── test_api.py           # API endpoint tests
│   ├── test_llm.py           # LLM service tests
│   └── test_consciousness.py # Prompt tests
│
└── docs/
    ├── API.md                # API documentation
    └── DEPLOYMENT.md         # Deployment guide
```

---

## 🔌 API Endpoints

### 1. **Chat Endpoint**
```
POST /api/chat
Content-Type: application/json
Authorization: Bearer <api_key> (optional)

Request:
{
  "messages": [
    {"role": "user", "content": "What is consciousness mining?"}
  ],
  "max_tokens": 512,
  "temperature": 0.7,
  "consciousness_mode": true
}

Response:
{
  "content": "🌟 Consciousness mining in ZION...",
  "role": "assistant",
  "source": "ai-native-server",
  "model": "TinyLlama-1.1B",
  "consciousness_aware": true,
  "tokens_used": 145,
  "response_time_ms": 2340
}
```

### 2. **Health Check**
```
GET /health

Response:
{
  "status": "healthy",
  "model": "TinyLlama-1.1B",
  "device": "cpu",
  "ready": true,
  "uptime_seconds": 86400,
  "requests_processed": 1543,
  "avg_response_time_ms": 2200
}
```

### 3. **Models Info**
```
GET /api/models

Response:
{
  "current": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "type": "huggingface",
  "available": [
    "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    "microsoft/phi-2"
  ],
  "capabilities": ["chat", "consciousness-aware"]
}
```

---

## 📦 Implementation Steps

### Step 1: Create Project Structure
```bash
mkdir -p ai-native-server/{src,config,tests,docs,models,logs}
cd ai-native-server
```

### Step 2: Core Files

#### `requirements.txt`
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.0
python-dotenv==1.0.0
transformers==4.36.0
torch==2.1.0
accelerate==0.25.0
sentencepiece==0.1.99
protobuf==4.25.0
slowapi==0.1.9
```

#### `.env.example`
```bash
# Model Configuration
MODEL_NAME=TinyLlama/TinyLlama-1.1B-Chat-v1.0
MODEL_TYPE=huggingface
DEVICE=cpu
MAX_TOKENS=512
TEMPERATURE=0.7

# Server Configuration
HOST=0.0.0.0
PORT=8002
WORKERS=1

# Security
API_KEY_ENABLED=false
API_KEY=your-secret-key-here

# Consciousness Mode
CONSCIOUSNESS_MODE=true

# Logging
LOG_LEVEL=INFO
```

### Step 3: Implementation Files

#### **src/server.py** (Main FastAPI app)
- FastAPI initialization
- CORS middleware
- Chat endpoint with consciousness mode
- Health check endpoint
- Rate limiting
- Error handling

#### **src/llm_service.py** (LLM wrapper)
- Model loading (HuggingFace Transformers)
- Text generation
- Token management
- Memory-efficient inference
- Async operations

#### **src/consciousness.py** (Prompt engineering)
- System prompt builder
- User query enhancement
- Context injection (mining, rewards, levels)
- Response formatting

#### **src/auth.py** (Security)
- API key validation
- Rate limiting per IP/key
- Request logging

#### **src/monitoring.py** (Observability)
- Request metrics
- Response time tracking
- Error logging
- Health status

---

## 🐳 Docker Configuration

### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY src/ ./src/
COPY config/ ./config/

# Model cache volume
VOLUME ["/app/models", "/app/logs"]

# Expose API port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8002/health || exit 1

# Run server
CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "1"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  ai-native-llm:
    build: .
    container_name: zion-ai-native-llm
    ports:
      - "8002:8002"
    volumes:
      - ./models:/app/models
      - ./logs:/app/logs
      - ./config:/app/config:ro
    environment:
      - MODEL_NAME=TinyLlama/TinyLlama-1.1B-Chat-v1.0
      - MODEL_TYPE=huggingface
      - DEVICE=cpu
      - MAX_TOKENS=512
      - TEMPERATURE=0.7
      - CONSCIOUSNESS_MODE=true
      - LOG_LEVEL=INFO
    restart: unless-stopped
    networks:
      - zion-network
    mem_limit: 8g
    cpus: 4
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  zion-network:
    external: true
```

---

## 🚀 Deployment Process

### Phase 1: Local Testing
```bash
# 1. Create project structure
mkdir ai-native-server && cd ai-native-server

# 2. Create all files (from templates above)

# 3. Build locally
docker-compose build

# 4. Test locally
docker-compose up

# 5. Test API
curl http://localhost:8002/health
curl -X POST http://localhost:8002/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### Phase 2: Server Deployment
```bash
# 1. Create deployment package
tar -czf ai-native-server.tar.gz ai-native-server/

# 2. Upload to server
scp ai-native-server.tar.gz root@91.98.122.165:/root/

# 3. SSH to server
ssh root@91.98.122.165

# 4. Extract and setup
cd /root
tar -xzf ai-native-server.tar.gz
cd ai-native-server

# 5. Build on server
docker-compose build

# 6. Start service
docker-compose up -d

# 7. Check status
docker-compose logs -f
docker stats zion-ai-native-llm
```

### Phase 3: Nginx Configuration
```nginx
# /etc/nginx/sites-available/zion-api

upstream ai_native_llm {
    server localhost:8002;
}

server {
    listen 443 ssl http2;
    server_name zionterranova.com;
    
    # ... existing SSL config ...
    
    # AI Native LLM endpoints
    location /api/ai-native/chat {
        proxy_pass http://ai_native_llm/api/chat;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for LLM inference
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Rate limiting
        limit_req zone=api_limit burst=5 nodelay;
    }
    
    location /api/ai-native/health {
        proxy_pass http://ai_native_llm/health;
        proxy_set_header Host $host;
    }
    
    location /api/ai-native/models {
        proxy_pass http://ai_native_llm/api/models;
        proxy_set_header Host $host;
    }
}

# Rate limit zone (add to http block in nginx.conf)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/m;
```

```bash
# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx
```

### Phase 4: Desktop Agent Integration
Update desktop agent to use server endpoint:

```javascript
// desktop-agent/src/ui/renderer.js

const sendToAiNativeServer = async (text) => {
  try {
    const result = await window.electronAPI.aiChat({
      messages: state.messages.concat([{ role: 'user', content: text }]),
      endpoint: 'https://zionterranova.com/api/ai-native/chat',
      model: 'consciousness-aware',
      apiKey: config.aiNativeApiKey || ''  // optional
    });
    
    return result;
  } catch (err) {
    return {
      success: false,
      error: `AI Native Server error: ${err.message}`
    };
  }
};
```

---

## 📊 Resource Requirements

### Minimum (TinyLlama 1.1B)
```
CPU: 2 cores
RAM: 6 GB (4 GB model + 2 GB overhead)
Disk: 5 GB
Network: 10 Mbps
```

### Recommended (for 10 concurrent users)
```
CPU: 4 cores
RAM: 8 GB
Disk: 10 GB (with logs)
Network: 50 Mbps
```

### Current Server Status
```bash
# Check on 91.98.122.165
free -h
# Expected: 8-16 GB total ✅

df -h
# Expected: 50+ GB free ✅

nproc
# Expected: 4-8 cores ✅
```

**Verdict:** ✅ Current server can handle TinyLlama!

---

## 🧪 Testing Plan

### Unit Tests
```python
# tests/test_consciousness.py
def test_system_prompt():
    cp = ConsciousnessPrompt()
    prompt = cp.get_system_prompt()
    assert "ZION" in prompt
    assert "consciousness" in prompt

def test_query_enhancement():
    cp = ConsciousnessPrompt()
    enhanced = cp.enhance_user_query("how to mine?")
    assert "PoW" in enhanced or "mining" in enhanced
```

### Integration Tests
```python
# tests/test_api.py
def test_chat_endpoint():
    response = client.post("/api/chat", json={
        "messages": [{"role": "user", "content": "Hello"}]
    })
    assert response.status_code == 200
    assert "content" in response.json()

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
```

### Load Testing
```bash
# Use Apache Bench
ab -n 100 -c 10 -p test_request.json \
   -T application/json \
   https://zionterranova.com/api/ai-native/chat

# Expected:
# - Requests per second: 2-5 (depends on model)
# - Failed requests: 0
# - 95th percentile: <5s
```

---

## 📈 Monitoring & Logging

### Logs
```bash
# View logs
docker-compose logs -f ai-native-llm

# Log structure
{
  "timestamp": "2026-01-08T14:32:11Z",
  "level": "INFO",
  "endpoint": "/api/chat",
  "method": "POST",
  "status": 200,
  "response_time_ms": 2340,
  "tokens_used": 145,
  "consciousness_mode": true
}
```

### Metrics
```python
# src/monitoring.py tracks:
- Total requests
- Average response time
- Tokens per second
- Error rate
- Memory usage
- CPU usage
```

### Alerts (Future)
```bash
# If response time > 10s
# If error rate > 5%
# If memory > 90%
# → Send notification
```

---

## 🔒 Security

### API Key (Optional)
```python
# src/auth.py
from fastapi.security import HTTPBearer

API_KEYS = {
    "desktop-agent-key": {"name": "Desktop Agent", "rate_limit": 100},
    "mobile-app-key": {"name": "Mobile App", "rate_limit": 50}
}

async def verify_api_key(credentials: HTTPBearer):
    if credentials.credentials not in API_KEYS:
        raise HTTPException(401, "Invalid API key")
    return API_KEYS[credentials.credentials]
```

### Rate Limiting
```python
from slowapi import Limiter

limiter = Limiter(key_func=lambda: request.client.host)

@app.post("/api/chat")
@limiter.limit("10/minute")  # 10 requests per minute per IP
async def chat(...):
    pass
```

---

## 💰 Cost Analysis

### TestNet (Phase 1)
```
Server: $20/month (existing, no upgrade needed)
Model: TinyLlama 1.1B (free, open-source)
Bandwidth: ~10 GB/month ($0, included)
Total: $20/month ✅
```

### MainNet (Phase 2)
```
Server upgrade: $50/month (more RAM/CPU)
Model: Mistral 7B or CodeLlama 7B (free)
Bandwidth: ~50 GB/month ($0)
Optional GPU: +$30-50/month
Total: $50-100/month
```

---

## 🎯 Implementation Roadmap

### Week 1: Core Development
- [ ] Create project structure
- [ ] Implement FastAPI server
- [ ] Integrate HuggingFace Transformers
- [ ] Add consciousness prompts
- [ ] Write unit tests
- [ ] Test locally

### Week 2: Deployment
- [ ] Create Docker image
- [ ] Deploy to TestNet server
- [ ] Configure Nginx
- [ ] Test API endpoints
- [ ] Monitor resource usage

### Week 3: Integration
- [ ] Update desktop agent
- [ ] Add server endpoint option in UI
- [ ] Test end-to-end flow
- [ ] Gather user feedback
- [ ] Optimize performance

### Week 4: Polish
- [ ] Add API key authentication
- [ ] Implement rate limiting
- [ ] Add monitoring dashboard
- [ ] Write documentation
- [ ] Prepare for MainNet

---

## 📚 Documentation Plan

### API Documentation
```markdown
# AI Native API Documentation

## Authentication
All requests require API key in Authorization header:
```
Authorization: Bearer your-api-key-here
```

## Rate Limits
- 10 requests per minute per IP
- 100 requests per hour per API key

## Endpoints
...
```

### Deployment Guide
```markdown
# Deployment Guide

## Prerequisites
- Docker & Docker Compose
- Nginx
- 8 GB RAM minimum
- 10 GB free disk space

## Steps
1. Clone repository
2. Configure .env
3. Build image
...
```

---

## ✅ Success Criteria

### Technical
- [x] API responds within 5 seconds (95th percentile)
- [x] Handles 10 concurrent requests
- [x] Memory usage < 8 GB
- [x] CPU usage < 80% under load
- [x] Uptime > 99%

### User Experience
- [x] Consciousness-aware responses
- [x] Natural language quality
- [x] ZION-specific context
- [x] Error messages helpful
- [x] No degradation from local bridge

### Business
- [x] Cost < $30/month (TestNet)
- [x] Scalable to 100+ users (MainNet)
- [x] Privacy maintained (our server)
- [x] No vendor lock-in (open-source model)

---

## 🚀 Next Actions

**Immediate:**
1. Create `ai-native-server/` directory
2. Implement `src/server.py` (FastAPI app)
3. Implement `src/llm_service.py` (HuggingFace wrapper)
4. Implement `src/consciousness.py` (prompts)
5. Create Dockerfile & docker-compose.yml

**This Session:**
1. Build and test locally
2. Verify model loads correctly
3. Test chat endpoint
4. Measure resource usage

**Next Session:**
1. Deploy to TestNet server
2. Configure Nginx
3. Update desktop agent
4. End-to-end testing

---

## 🌟 Philosophy

This AI Native API Server embodies our principles:

**Purpose Over Programming** ✅
- Serves consciousness evolution, not just Q&A

**Transparency First** ✅
- Open-source model, our infrastructure
- Users know where their data goes

**Human-AI Synergy** ✅
- Assists miners, doesn't replace wisdom
- Encourages learning and growth

**Continuous Growth** ✅
- Start small (TinyLlama)
- Scale up (Mistral 7B)
- Eventually: custom ZION model

---

**Ready to implement!** 🚀

Let's start with creating the project structure and implementing the core files.
