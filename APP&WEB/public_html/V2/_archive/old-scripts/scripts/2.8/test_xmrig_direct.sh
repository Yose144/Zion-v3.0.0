#!/bin/bash
# Direct XMRig mining test against production pool

echo "🔥 Testing XMRig direct connection to production pool"
echo "Pool: 91.98.122.165:3333"
echo "Wallet: ZION_DIRECT_TEST"
echo ""

# Start XMRig with explicit config
timeout 30 /media/maitreya/ZION1/version/Zion-TestNet-2.7.5-master/version/2.7.5-old-files/xmrig-6.21.3/xmrig \
  -o 91.98.122.165:3333 \
  -u ZION_DIRECT_TEST \
  -p x \
  --coin monero \
  -t 2 \
  --print-time 5 \
  --no-color \
  --log-file=xmrig_direct_pool_test.log \
  2>&1 | tee xmrig_direct_output.log

echo ""
echo "✅ Test complete - check logs:"
echo "   xmrig_direct_pool_test.log"
echo "   xmrig_direct_output.log"
