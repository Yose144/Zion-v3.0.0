# Open Source Mining Pools - Multi-Algo Solution Research

## Hlavní projekty:
1. **mining-pool** (GitHub) - Multi-algo support
2. **stratum-mining** - Stratum v1/v2 reference
3. **open-pool** - XMrig compatible
4. **nodejs-pool** - Universal pool
5. **solo-pool** - Lightweight option

## Klíčové problémy při multi-algo:
- Client handshake timing
- Buffer management
- Async I/O handling
- Algorithm detection
- Share validation

## Řešení v open source:
- **Timeout handling** - Set timeouts na socket
- **Buffer pooling** - Reuse buffers
- **Non-blocking I/O** - Epoll/Kqueue
- **Algorithm routing** - Pre-connect detection
- **Keep-alive** - Periodic heartbeat
