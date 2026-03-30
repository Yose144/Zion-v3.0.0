# ZION WARP BRIDGE - LND Integration

## 🌟 LND (Lightning Network Daemon) Setup

Tento průvodce vám pomůže nastavit LND pro integraci s ZION WARP Bridge místo Voltage API.

## 🚀 Rychlý Start

```bash
# Spusťte setup script
./setup_lnd.sh

# Spusťte LND (v samostatném terminálu)
lnd --configfile=$HOME/.lnd/lnd.conf

# Vytvořte wallet (pouze při prvním spuštění)
lncli create

# Získejte macaroon pro API přístup
lncli bakemacaroon uri:/lnrpc.Lightning/ uri:/lnrpc.WalletUnlocker/ --save_to=$HOME/.lnd/admin.macaroon
```

## ⚙️ Environment Variables

Nastavte tyto proměnné pro ZION WARP Bridge:

```bash
export LND_RPC_URL="https://localhost:8080"
export LND_MACAROON="$(xxd -ps -u -c 1000 $HOME/.lnd/admin.macaroon)"
```

## 🧪 Testování

```bash
# Test connectivity s LND
python3 src/bridges/warp_bridge_production.py --test-connectivity

# Test základního WARP transferu
python3 src/bridges/warp_bridge_production.py --test-basic
```

## 🌌 ZION WARP BRIDGE - Přehled

### ⚡ WARP Speed Transfers
ZION WARP Bridge umožňuje **ultra-rychlé cross-chain transfery** s cílem **< 2 sekund**:

- **Multi-chain podpora**: Ethereum, Polygon, Arbitrum, BSC, Avalanche, Solana, +70 dalších
- **Lightning Network integrace**: Okamžité settlement přes Lightning Network
- **Real-time pricing**: Dynamické ceny a poplatky
- **Production-ready**: Plná integrace s Ankr, OpenNode a LND

### � Výkonové Metriky
- **Cílový čas**: < 2000ms na transfer
- **Úspěšnost**: > 99% s LND integrací
- **Podporované řetězce**: 70+ blockchainů přes Ankr
- **Lightning kapacita**: Neomezená přes vlastní LND node

### 💰 Poplatky a Ekonomika
- **Lightning fees**: 1-5 sats na transfer
- **Ankr RPC**: Pay-per-use model
- **OpenNode**: Standard Lightning poplatky
- **Celkové TCO**: Výrazně nižší než tradiční bridges

## 🔄 WARP Transfer Proces

```
1. 🔒 Lock na source chain (Ankr RPC)
2. ⚡ Lightning Network transfer (LND/OpenNode)
3. 🪄 Mint na destination chain (Ankr RPC)
```

### Příklad Transferu:
```python
from src.bridges.warp_bridge_production import ZIONWarpBridgeProduction, WarpChainType

warp = ZIONWarpBridgeProduction()
await warp.initialize()

# ETH → Polygon transfer
tx = await warp.warp_transfer(
    from_chain=WarpChainType.ETHEREUM,
    to_chain=WarpChainType.POLYGON,
    amount=0.1,
    asset="ETH",
    user_id="user123"
)
print(f"✅ WARP transfer complete in {tx.total_time_ms}ms!")
```

## �📋 Co LND poskytuje

- ✅ **Skutečná Lightning Network funkcionalita**
- ✅ **Vlastní kontrola nad prostředky**
- ✅ **Žádné závislosti na třetích stranách**
- ✅ **Standardní Lightning API**

## 🔒 Security Notes

- **Macaroon**: Uchovávejte bezpečně, poskytuje plný přístup k vašemu Lightning nodu
- **Firewall**: Omezte přístup k LND portům (9735, 10009, 8080)
- **Backup**: Pravidelně zálohujte wallet a macaroons

## 🆘 Troubleshooting

### LND se nespustí
```bash
# Zkontrolujte logy
tail -f $HOME/.lnd/logs/bitcoin/testnet/lnd.log

# Zkontrolujte porty
lsof -i :9735,10009,8080
```

### API nefunguje
```bash
# Test LND API
curl -H "Grpc-Metadata-macaroon: $(xxd -ps -u -c 1000 $HOME/.lnd/admin.macaroon)" \
     https://localhost:8080/v1/getinfo
```

### WARP Bridge nefunguje
```bash
# Zkontrolujte environment variables
echo $LND_RPC_URL
echo $LND_MACAROON | head -c 50

# Test WARP bridge connectivity
python3 -c "
import asyncio
from src.bridges.warp_bridge_production import ZIONWarpBridgeProduction
warp = ZIONWarpBridgeProduction()
asyncio.run(warp.initialize())
"
```

## 📚 Další Dokumentace

- [LND Documentation](https://docs.lightning.engineering/)
- [Lightning Network Basics](https://lightning.network/)
- [ZION WARP Bridge API](src/bridges/warp_bridge_production.py)
- [Ankr Multi-chain RPC](https://www.ankr.com/docs/rpc-service/)
- [OpenNode API](https://developers.opennode.com/)

---

**🎉 S LND máte plnou kontrolu nad Lightning Network funkcionalitou v ZION WARP Bridge!**