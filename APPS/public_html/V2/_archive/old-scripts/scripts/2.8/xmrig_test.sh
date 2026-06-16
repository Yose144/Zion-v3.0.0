#!/bin/bash
echo "🚀 Starting XMRig test against SSH pool (91.98.122.165:3333)"
xmrig -o 91.98.122.165:3333 -u "XMRIG_SSH_$(date +%s)" -p x -a randomx --threads 4 --print-time 20 2>&1
