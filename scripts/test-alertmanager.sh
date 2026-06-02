#!/usr/bin/env bash
# ZION V3 — Alertmanager Test Script
# Sends a test alert to the local Alertmanager instance.
#
# Usage:
#   ./scripts/test-alertmanager.sh [critical|warning]
#
# Requires:
#   - Alertmanager running (docker compose --profile monitoring up -d)
#   - curl

set -euo pipefail

SEVERITY="${1:-critical}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"

echo "Sending test alert (severity: $SEVERITY) to $ALERTMANAGER_URL ..."

curl -s -X POST "$ALERTMANAGER_URL/api/v1/alerts" \
  -H 'Content-Type: application/json' \
  -d "[{
    \"labels\": {
      \"alertname\": \"TestAlert\",
      \"severity\": \"$SEVERITY\",
      \"instance\": \"test-host\"
    },
    \"annotations\": {
      \"summary\": \"ZION V3 test alert ($SEVERITY)\",
      \"description\": \"This is a manual test of the Alertmanager pipeline. If you see this in your notification channel, routing works.\"
    }
  }]"

echo ""
echo "Test alert sent. Check:"
echo "  - Local webhook log: logs/alertmanager-webhook.log"
echo "  - Discord/Slack/Email channel (if configured)"
echo "  - Alertmanager UI: $ALERTMANAGER_URL"
