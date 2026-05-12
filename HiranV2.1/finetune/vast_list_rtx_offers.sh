#!/usr/bin/env bash
# Živý výpis ověřených RTX 4090 / 5090 na Vast (řazeno od nejnižší $/h).
# Nepotřebuje API klíč. offer_id použij ve Vast console nebo: vastai create instance <id> ...

set -euo pipefail

LIMIT="${1:-15}"

curl -sS -X POST "https://console.vast.ai/api/v0/bundles/" \
  -H "Content-Type: application/json" \
  -d "{
    \"gpu_name\": {\"in\": [\"RTX 4090\", \"RTX 5090\"]},
    \"num_gpus\": {\"gte\": 1},
    \"gpu_ram\": {\"gte\": 22000},
    \"reliability\": {\"gte\": 0.97},
    \"verified\": {\"eq\": true},
    \"rentable\": {\"eq\": true},
    \"type\": \"ondemand\",
    \"order\": [[\"dph_total\", \"asc\"]],
    \"limit\": ${LIMIT}
  }" | python3 -c "
import sys, json
d = json.load(sys.stdin)
offers = d.get('offers') or []
print('offer_id\t\$/hr\tGPU\trel\tcuda\tlocation')
for o in offers:
    print('{}\t{}\t{}\t{}\t{}\t{}'.format(
        o.get('id'),
        round(float(o.get('dph_total') or 0), 4),
        o.get('gpu_name'),
        round(float(o.get('reliability') or 0), 4),
        o.get('cuda_max_good'),
        (o.get('geolocation') or '')[:56],
    ))
if not offers:
    sys.exit(1)
print()
print('Tip: nejlevnější řádek výše — zkontroluj disk/RAM v UI před rentem.')
"
