#!/bin/bash
# SPLARO production verification + optional test COD order
set +e
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$PATH"

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
log() { echo "[verify $(date '+%H:%M:%S')] $*"; }
FAIL=0

check() {
  label="$1"
  url="$2"
  expect="${3:-200}"
  code=$(curl -s -m 20 -o /tmp/splaro-verify-body.txt -w '%{http_code}' "$url" 2>/dev/null || echo "000")
  if [ "$code" = "$expect" ] || { [ "$expect" = "2xx" ] && [ "${code:0:1}" = "2" ]; }; then
    log "OK  $label → $code"
  else
    log "FAIL $label → $code (expected $expect)"
    FAIL=$((FAIL + 1))
  fi
}

log "=== Local services ==="
check "web-local" "http://127.0.0.1:3001/" "2xx"
check "api-local" "http://127.0.0.1:4000/api/v1/health" "2xx"
check "admin-local" "http://127.0.0.1:3002/login" "2xx"

log "=== Public URLs ==="
check "splaro.co" "https://splaro.co/" "2xx"
check "api-health" "https://splaro.co/api/v1/health" "2xx"
check "admin-login" "https://admin.splaro.co/login" "2xx"
check "api-subdomain" "https://api.splaro.co/api/v1/health" "2xx"

log "=== Products API ==="
PRODUCTS=$(curl -s -m 25 "https://splaro.co/api/v1/storefront/products?storeId=splaro" 2>/dev/null)
if echo "$PRODUCTS" | grep -q '"products"'; then
  log "OK  products API returns data"
elif echo "$PRODUCTS" | grep -q 'Internal server error'; then
  log "FAIL products API → 500 (DATABASE_URL missing or schema not migrated)"
  FAIL=$((FAIL + 1))
else
  log "WARN products API: $(echo "$PRODUCTS" | head -c 120)"
fi

# ── Test COD order (optional) ──
if [ "${SKIP_TEST_ORDER:-0}" != "1" ] && echo "$PRODUCTS" | grep -q '"id"'; then
  log "=== Placing test COD order ==="
  PRODUCT_JSON=$(echo "$PRODUCTS" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        const j=JSON.parse(d);
        const p=(j.products||j.data||[])[0];
        if(!p){ process.exit(1); }
        const v=(p.variants||[])[0];
        console.log(JSON.stringify({ productId:p.id, variantId:v?.id, price:Number(v?.price||p.basePrice||12500) }));
      } catch(e){ process.exit(1); }
    });
  " 2>/dev/null)

  if [ -n "$PRODUCT_JSON" ]; then
    PID=$(echo "$PRODUCT_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).productId))")
    VID=$(echo "$PRODUCT_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).variantId||''))")
    PRICE=$(echo "$PRODUCT_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).price))")
    DELIVERY=120
    TOTAL=$(node -e "console.log(Number($PRICE)+$DELIVERY)")

    ORDER_BODY=$(cat <<EOJSON
{
  "customer": {
    "name": "SPLARO Test User",
    "email": "test@splaro.co",
    "phone": "01700000001",
    "address": "House 12, Road 5, Dhanmondi",
    "city": "Dhaka",
    "district": "Dhaka",
    "division": "Dhaka"
  },
  "items": [{
    "productId": "$PID",
    "variantId": "$VID",
    "quantity": 1,
    "price": $PRICE
  }],
  "subtotal": $PRICE,
  "delivery": $DELIVERY,
  "discount": 0,
  "total": $TOTAL,
  "paymentMethod": "cash_on_delivery"
}
EOJSON
)
    ORDER_RESP=$(curl -s -m 30 -X POST "https://splaro.co/api/v1/storefront/orders?storeId=splaro" \
      -H "Content-Type: application/json" \
      -d "$ORDER_BODY" 2>/dev/null)

    if echo "$ORDER_RESP" | grep -q 'invoiceNumber\|"order"'; then
      INV=$(echo "$ORDER_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.order?.invoiceNumber||j.invoiceNumber||'ok')}catch(e){console.log('parse-fail')}})" 2>/dev/null)
      log "OK  test order placed — invoice: $INV"
      echo "$INV" > "$REPO/.last-test-order-invoice"
    else
      log "FAIL test order: $(echo "$ORDER_RESP" | head -c 200)"
      FAIL=$((FAIL + 1))
    fi
  else
    log "WARN: could not parse product for test order"
  fi
fi

log "=== Admin credentials (from .env) ==="
if [ -f "$REPO/.env" ]; then
  grep -E '^(ADMIN_EMAIL|ADMIN_PASSWORD)=' "$REPO/.env" 2>/dev/null | sed 's/PASSWORD=.*/PASSWORD=***/'
fi

if [ "$FAIL" -eq 0 ]; then
  log "ALL CHECKS PASSED"
  exit 0
else
  log "$FAIL check(s) failed"
  exit 1
fi
