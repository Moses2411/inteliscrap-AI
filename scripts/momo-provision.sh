#!/usr/bin/env bash
set -euo pipefail

SUB_KEY="${MOMO_SUBSCRIPTION_KEY:-${1:-}}"
BASE_URL="${MOMO_BASE_URL:-https://sandbox.momodeveloper.mtn.com}"
CB="${MOMO_CALLBACK_HOST:-}"

if [ -z "$SUB_KEY" ]; then
  echo "MOMO_SUBSCRIPTION_KEY is required" >&2
  exit 2
fi

if [ -z "$CB" ]; then
  CB="${MOMO_CALLBACK_BASE_URL:-}"
  if [ -n "$CB" ]; then
    # extract host
    CB=$(echo "$CB" | sed -E 's|^https?://([^/:]+).*|\1|')
  fi
  [ -z "$CB" ] && CB="inteliscrap.example.com"
fi

API_USER=$(python3 -c "import uuid; print(uuid.uuid4())")
BASE_URL_CLEAN=$(echo "$BASE_URL" | sed 's|/$||')

# Create API user
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL_CLEAN/v1_0/apiuser" \
  -H "Ocp-Apim-Subscription-Key: $SUB_KEY" \
  -H "X-Reference-Id: $API_USER" \
  -H "Content-Type: application/json" \
  -d "{\"providerCallbackHost\":\"$CB\"}")
if [ "$CODE" != "201" ]; then
  echo "POST /v1_0/apiuser failed ($CODE)" >&2
  exit 1
fi

# Create API key
RESP=$(curl -s -X POST "$BASE_URL_CLEAN/v1_0/apiuser/$API_USER/apikey" \
  -H "Ocp-Apim-Subscription-Key: $SUB_KEY")
CODE2=$(echo "$RESP" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get('apiKey',''))
except: sys.exit(1)
")
if [ -z "$CODE2" ]; then
  echo "MoMo did not return apiKey: $RESP" >&2
  exit 1
fi

echo "=== MTN MoMo Sandbox Provisioning ==="
echo "MOMO_BASE_URL=$BASE_URL_CLEAN"
echo "MOMO_API_USER=$API_USER"
echo "MOMO_API_KEY=$CODE2"
echo "=== Copy these into .env / Render env vars ==="
echo "Also set: MOMO_ENABLED=true, MOMO_SUBSCRIPTION_KEY=$SUB_KEY, MOMO_TARGET_ENVIRONMENT=sandbox, MOMO_CURRENCY=EUR"
