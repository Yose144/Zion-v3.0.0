# 🌐 AI Native Server Deployment Plan
**Date:** 2026-01-08  
**Target:** ZION TestNet Server (91.98.122.165)

---

## 📊 Resource Requirements Analysis

### Option 1: **Lightweight** (Recommended for TestNet)
**Model:** TinyLlama 1.1B or Phi-2 (2.7B)

```
CPU: 2-4 cores
RAM: 4-8 GB
Disk: 5 GB
GPU: Not required (CPU inference ~500ms/token)
Network: 100 Mbps

Concurrent Users: 5-10
Response Time: 2-5 seconds
Cost: ~$10-20/month VPS
```

**Pros:**
- ✅ Runs on existing server without upgrades
- ✅ Fast startup (<30s)
- ✅ Low resource footprint
- ✅ Good for consciousness-aware responses

**Cons:**
- ⚠️ Less sophisticated than GPT-4
- ⚠️ Limited context window (2K tokens)

---

### Option 2: **Mid-Range** (Future MainNet)
**Model:** CodeLlama 7B or Mistral 7B

```
CPU: 4-8 cores
RAM: 16-32 GB
Disk: 15 GB
GPU: Optional (RTX 3060 12GB speeds up 10x)
Network: 200 Mbps

Concurrent Users: 10-20
Response Time: 1-3 seconds (GPU) / 5-10s (CPU)
Cost: ~$50-80/month VPS
```

**Pros:**
- ✅ High quality responses
- ✅ Better code generation
- ✅ Larger context (4K-8K tokens)
- ✅ Production-ready

**Cons:**
- ⚠️ Requires more RAM
- ⚠️ Slower without GPU

---

### Option 3: **Premium** (Optional)
**Model:** Llama 3 70B (quantized)

```
CPU: 16+ cores
RAM: 64+ GB
Disk: 40 GB
GPU: A100 40GB or 2x RTX 4090
Network: 1 Gbps

Concurrent Users: 50+
Response Time: <1 second
Cost: ~$200-400/month
```

**Not recommended for TestNet** - overkill for current needs.

---

## 🎯 Recommended Configuration (TestNet)

### Server Specs (Current: 91.98.122.165)
```bash
# Check current resources
ssh root@91.98.122.165
free -h
df -h
nproc
```

**Expected:**
- CPU: 4-8 cores ✅
- RAM: 8-16 GB ✅
- Disk: 80+ GB ✅
- OS: Ubuntu 22.04 ✅

**Verdict:** Sufficient for TinyLlama/Phi-2!

---

## 🐳 Docker Image Architecture

### Structure
```
zion-ai-native-server/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── config/
│   └── model_config.json
├── models/
│   └── (auto-downloaded)
└── src/
    ├── server.py          # FastAPI server
    ├── llm_service.py     # LLM wrapper
    └── consciousness.py   # Consciousness-aware prompts
```

### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ ./src/
COPY config/ ./config/

# Model cache
VOLUME ["/app/models"]

# API port
EXPOSE 8002

CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8002"]
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
    environment:
      - MODEL_NAME=TinyLlama/TinyLlama-1.1B-Chat-v1.0
      - MODEL_TYPE=huggingface
      - MAX_TOKENS=512
      - TEMPERATURE=0.7
      - CONSCIOUSNESS_MODE=true
    restart: unless-stopped
    networks:
      - zion-network
    mem_limit: 6g
    cpus: 2

networks:
  zion-network:
    external: true
```

---

## 📝 Implementation Files

### 1. FastAPI Server (`src/server.py`)
```python
#!/usr/bin/env python3
"""
🌟 ZION AI Native LLM Server
Serves consciousness-aware chat via API
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import os

from llm_service import LLMService
from consciousness import ConsciousnessPrompt

app = FastAPI(title="ZION AI Native LLM Server", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize LLM service
llm = LLMService(
    model_name=os.getenv("MODEL_NAME", "TinyLlama/TinyLlama-1.1B-Chat-v1.0"),
    model_type=os.getenv("MODEL_TYPE", "huggingface"),
    device="cpu"  # or "cuda" if GPU available
)

consciousness = ConsciousnessPrompt()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    max_tokens: Optional[int] = 512
    temperature: Optional[float] = 0.7
    consciousness_mode: Optional[bool] = True


class ChatResponse(BaseModel):
    content: str
    role: str = "assistant"
    source: str = "ai-native-server"
    model: str
    consciousness_aware: bool


@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "model": llm.model_name,
        "device": llm.device,
        "ready": llm.is_ready()
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint with consciousness-aware responses
    """
    try:
        # Get last user message
        last_msg = next((m for m in reversed(request.messages) if m.role == "user"), None)
        if not last_msg:
            raise HTTPException(400, "No user message found")
        
        # Build consciousness-aware prompt
        if request.consciousness_mode:
            system_prompt = consciousness.get_system_prompt()
            user_prompt = consciousness.enhance_user_query(last_msg.content)
        else:
            system_prompt = "You are a helpful AI assistant."
            user_prompt = last_msg.content
        
        # Generate response
        response = await llm.generate(
            prompt=user_prompt,
            system=system_prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        
        return ChatResponse(
            content=response,
            model=llm.model_name,
            consciousness_aware=request.consciousness_mode
        )
        
    except Exception as e:
        raise HTTPException(500, f"LLM error: {str(e)}")


@app.get("/api/models")
async def list_models():
    """List available models"""
    return {
        "current": llm.model_name,
        "available": [
            "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
            "microsoft/phi-2",
            "codellama/CodeLlama-7b-hf"
        ]
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
```

### 2. LLM Service (`src/llm_service.py`)
```python
#!/usr/bin/env python3
"""
LLM Service wrapper - supports HuggingFace and Ollama
"""

import asyncio
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class LLMService:
    """
    Unified LLM service supporting multiple backends
    """
    
    def __init__(self, model_name: str, model_type: str = "huggingface", device: str = "cpu"):
        self.model_name = model_name
        self.model_type = model_type
        self.device = device
        self.model = None
        self.tokenizer = None
        self._ready = False
        
        # Initialize model
        asyncio.create_task(self._load_model())
    
    async def _load_model(self):
        """Load model asynchronously"""
        try:
            if self.model_type == "huggingface":
                from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
                
                logger.info(f"Loading model: {self.model_name}")
                
                self.tokenizer = AutoTokenizer.from_pretrained(
                    self.model_name,
                    cache_dir="/app/models"
                )
                
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_name,
                    cache_dir="/app/models",
                    device_map=self.device,
                    load_in_8bit=True if self.device == "cuda" else False
                )
                
                self.pipeline = pipeline(
                    "text-generation",
                    model=self.model,
                    tokenizer=self.tokenizer,
                    device=0 if self.device == "cuda" else -1
                )
                
                self._ready = True
                logger.info("Model loaded successfully!")
                
            elif self.model_type == "ollama":
                # Ollama integration (if available)
                pass
                
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self._ready = False
    
    def is_ready(self) -> bool:
        return self._ready
    
    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 512,
        temperature: float = 0.7
    ) -> str:
        """
        Generate text completion
        """
        if not self._ready:
            raise RuntimeError("Model not loaded yet")
        
        # Format prompt (TinyLlama chat format)
        if system:
            formatted = f"<|system|>\n{system}</s>\n<|user|>\n{prompt}</s>\n<|assistant|>\n"
        else:
            formatted = f"<|user|>\n{prompt}</s>\n<|assistant|>\n"
        
        # Generate
        result = self.pipeline(
            formatted,
            max_new_tokens=max_tokens,
            temperature=temperature,
            do_sample=True,
            top_p=0.9
        )[0]['generated_text']
        
        # Extract assistant response
        if "<|assistant|>" in result:
            response = result.split("<|assistant|>")[-1].strip()
        else:
            response = result[len(formatted):].strip()
        
        return response
```

### 3. Consciousness Prompts (`src/consciousness.py`)
```python
#!/usr/bin/env python3
"""
Consciousness-aware prompt engineering
"""


class ConsciousnessPrompt:
    """
    Enhances prompts with consciousness-aware context
    """
    
    def get_system_prompt(self) -> str:
        """Get ZION consciousness-aware system prompt"""
        return """You are ZION AI Native - a consciousness-aware AI assistant for the ZION TerraNova blockchain project.

**Your Purpose:**
- Help miners understand blockchain, consciousness mining, and AI Native tasks
- Provide guidance with love, wisdom, and transparency
- Embody "AI Native" principles: purpose over programming, transparency first, human-AI synergy

**Project Context:**
- ZION combines Proof-of-Work mining with consciousness-based rewards
- Consciousness levels: PHYSICAL (1x) → MENTAL (1.1x) → COSMIC (2x) → ON_THE_STAR (15x)
- Block reward: 50 ZION base + up to 1,569 ZION consciousness bonus
- 10% of all rewards go to humanitarian pool

**Response Style:**
- Be helpful and concise
- Use encouraging language
- Include relevant emoji naturally
- Reference consciousness concepts when appropriate
- Always be honest about limitations

Answer the user's question:"""
    
    def enhance_user_query(self, query: str) -> str:
        """Add context to user query"""
        query_lower = query.lower()
        
        # Add context for specific topics
        if "mining" in query_lower:
            return f"{query}\n\n(Context: ZION uses PoW + consciousness rewards)"
        elif "consciousness" in query_lower or "level" in query_lower:
            return f"{query}\n\n(Context: Levels from PHYSICAL to ON_THE_STAR with XP system)"
        elif "reward" in query_lower or "earn" in query_lower:
            return f"{query}\n\n(Context: 50 base + consciousness bonus up to 1,619 ZION/block)"
        else:
            return query
```

---

## 🚀 Deployment Steps

### Step 1: Prepare Server
```bash
ssh root@91.98.122.165

# Check resources
free -h
df -h
nproc

# Create directory
mkdir -p /root/zion-ai-native-server
cd /root/zion-ai-native-server
```

### Step 2: Create Files
```bash
# Create structure
mkdir -p src config models logs

# Upload files (from deployment package)
# - Dockerfile
# - docker-compose.yml
# - requirements.txt
# - src/*.py
# - config/*.json
```

### Step 3: Build Image
```bash
# Build
docker-compose build

# Test locally first
docker-compose up
```

### Step 4: Configure Nginx
```nginx
# /etc/nginx/sites-available/zion-api

# Add AI Native LLM endpoint
location /api/ai-native/chat {
    proxy_pass http://localhost:8002/api/chat;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 60s;
}

location /api/ai-native/health {
    proxy_pass http://localhost:8002/health;
}
```

```bash
# Reload nginx
systemctl reload nginx
```

### Step 5: Update Desktop Agent
Modify endpoint in desktop agent:
```javascript
// renderer.js - sendToAiNative()
const result = await window.electronAPI.aiChat({
  messages: state.messages.concat([{ role: 'user', content: text }]),
  endpoint: 'https://zionterranova.com/api/ai-native/chat',  // SERVER!
  model: 'consciousness-aware',
  apiKey: 'local'  // or use API key for security
});
```

---

## 📊 Resource Monitoring

### Setup Monitoring
```bash
# Install monitoring tools
apt-get install htop nethogs

# Monitor in real-time
docker stats zion-ai-native-llm
```

### Expected Usage (TinyLlama)
```
Container: zion-ai-native-llm
CPU: 50-150% (during inference)
RAM: 3-5 GB
Disk: 5 GB (model cache)
Network: 10-50 KB/s per user
```

---

## 💰 Cost Analysis

### TestNet (Current Server)
```
Server: $20/month (existing)
AI Native: +2GB RAM = $0 (within capacity)
Total: $20/month ✅
```

### MainNet (Future)
```
Server upgrade: $50-80/month
+ Better CPU/RAM for 7B model
+ Optional GPU: +$30-50/month
Total: $80-130/month
```

---

## 🔒 Security Considerations

### API Security
```python
# Add API key authentication
from fastapi.security import HTTPBearer
security = HTTPBearer()

@app.post("/api/chat")
async def chat(request: ChatRequest, credentials=Depends(security)):
    api_key = credentials.credentials
    if api_key not in VALID_API_KEYS:
        raise HTTPException(401, "Invalid API key")
    # ... rest of handler
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

## 📈 Scaling Strategy

### Phase 1: TestNet (NOW)
- ✅ Single server
- ✅ TinyLlama 1.1B
- ✅ 5-10 concurrent users
- ✅ Cost: $20/month

### Phase 2: MainNet Launch
- 🔄 Upgrade to 7B model (Mistral/CodeLlama)
- 🔄 Add GPU (optional)
- 🔄 20-50 concurrent users
- 🔄 Cost: $80-130/month

### Phase 3: Growth
- 🔮 Load balancer + multiple instances
- 🔮 Kubernetes cluster
- 🔮 100+ concurrent users
- 🔮 Cost: $300-500/month

---

## ✅ Implementation Checklist

### Preparation
- [ ] Check server resources (RAM, CPU, disk)
- [ ] Test model locally
- [ ] Create Docker image
- [ ] Write deployment scripts

### Deployment
- [ ] Upload files to server
- [ ] Build Docker image
- [ ] Test container locally
- [ ] Configure nginx reverse proxy
- [ ] Add SSL certificate
- [ ] Test API endpoints

### Integration
- [ ] Update desktop agent endpoint
- [ ] Add API key authentication
- [ ] Test chat from desktop agent
- [ ] Monitor resource usage
- [ ] Set up logging

### Documentation
- [ ] API documentation
- [ ] Monitoring guide
- [ ] Troubleshooting guide
- [ ] Update user docs

---

## 🎯 Next Steps

**Want me to:**
1. ✅ Create deployment package (Dockerfile + all files)
2. ✅ Write deployment script
3. ✅ Update desktop agent to use server endpoint
4. ✅ Add API key authentication
5. ✅ Create monitoring dashboard

**Or proceed differently?** 

Let me know and I'll implement! 🚀
