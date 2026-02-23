#!/bin/bash
set -e

TOKEN=$(curl -s -X POST http://localhost:4449/tequilapi/auth/authenticate \
  -H "Content-Type: application/json" \
  -d '{"username":"myst","password":"mystberry"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

echo "Token len=${#TOKEN}"
IDENTITY=0xbf85983bf3ecc65791b2884e30a9c0e1636b757b

echo ""
echo "=== REGISTER ==="
RESULT=$(curl -s -X POST "http://localhost:4449/tequilapi/identities/$IDENTITY/register" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stake":0}')
echo "$RESULT"

echo ""
echo "=== STATUS ==="
curl -s -X GET "http://localhost:4449/tequilapi/identities/$IDENTITY" \
  -H "Authorization: Bearer $TOKEN"
