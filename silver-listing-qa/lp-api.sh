#!/usr/bin/env bash
#
# lp-api.sh — reusable API harness for Silver Listing (PR #237) QA on LedgerPort staging.
#
# WHAT IT DOES
#   Wraps the staging API with a browser User-Agent (Cloudflare bot-blocks the
#   default curl UA), auto-refreshes the access token, and provides one function
#   per remaining test case so you can verify backend state after the browser step.
#
# QUICK START
#   1) Log into https://app-staging.ledgerport.com in your browser and copy the
#      accessToken + refreshToken (DevTools > Application > Local Storage, or the
#      login response JSON).
#   2) export them and source this file:
#        export LP_ACCESS='eyJ...'      # accessToken  (~15 min life)
#        export LP_REFRESH='eyJ...'     # refreshToken (single-use, rotates)
#        source lp-api.sh
#   3) Run a check, e.g.:  sl_status   |   sl_t4_verify   |   sl_t2_initiate 210
#
#   NOTE: the API login endpoint is Turnstile(CAPTCHA)-gated, so tokens must come
#   from a real browser login — they can't be minted headlessly.
#
set -uo pipefail

LP_BASE="${LP_BASE:-https://api-staging.ledgerport.com}"
LP_DASH="${LP_DASH:-https://app-staging.ledgerport.com}"
LP_SHOPIFY_APP="${LP_SHOPIFY_APP:-https://staging-shopify-app.ledgerport.com}"
LP_UA="${LP_UA:-Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36}"

# ---- environment facts discovered during QA (staging) ----
LP_ACCOUNT_ID="${LP_ACCOUNT_ID:-202}"          # Silver Listing QA, Free plan
LP_BUSINESS_ID="${LP_BUSINESS_ID:-210}"        # Silver Listing Business
LP_QB_MAPPING_ID="${LP_QB_MAPPING_ID:-101}"    # QuickBooks accounting mapping (may change on reconnect)
LP_QB_REALM="${LP_QB_REALM:-9341457877789463}" # sandbox company "WordPress LedgerPort e4f7"
LP_SHOP="${LP_SHOP:-ledgerport-staging-qa.myshopify.com}"
# Free plan limits (GET /api/v1/plans): maxBusinesses=1, maxAccountingTools=1, maxConnections=1

LP_STATE_DIR="${LP_STATE_DIR:-$(mktemp -d)}"
[ -n "${LP_ACCESS:-}" ]  && printf '%s' "$LP_ACCESS"  > "$LP_STATE_DIR/access"  2>/dev/null || true
[ -n "${LP_REFRESH:-}" ] && printf '%s' "$LP_REFRESH" > "$LP_STATE_DIR/refresh" 2>/dev/null || true

_lp_access(){ cat "$LP_STATE_DIR/access" 2>/dev/null; }

# Refresh the access token using the (rotating) refresh token; persists both.
lp_refresh(){
  local rt; rt="$(cat "$LP_STATE_DIR/refresh" 2>/dev/null)"
  [ -z "$rt" ] && { echo "lp_refresh: no refresh token (set LP_REFRESH)"; return 1; }
  curl -sS --max-time 25 -A "$LP_UA" -H 'Content-Type: application/json' \
       -X POST "$LP_BASE/api/v1/auth/refresh" --data "{\"refreshToken\":\"$rt\"}" \
       -o "$LP_STATE_DIR/refresh_resp"
  python3 - "$LP_STATE_DIR" <<'PY'
import json,sys,os
sd=sys.argv[1]
d=json.load(open(os.path.join(sd,"refresh_resp")))
if not d.get("success"):
    print("lp_refresh FAILED:", d.get("error",{}).get("message")); raise SystemExit(1)
x=d["data"]; open(os.path.join(sd,"access"),"w").write(x["accessToken"])
if x.get("refreshToken"): open(os.path.join(sd,"refresh"),"w").write(x["refreshToken"])
print("lp_refresh OK")
PY
}

# Low-level fetch: writes raw body to $LP_STATE_DIR/body, echoes HTTP code only.
# Auto-refreshes once on 401. Usage: _lp_fetch GET /path [jsonbody]
_lp_fetch(){
  local method="$1" path="$2" body="${3:-}" tok code
  tok="$(_lp_access)"
  local args=(-sS --max-time 30 -A "$LP_UA" -H "Authorization: Bearer $tok" -X "$method")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' --data "$body")
  code="$(curl "${args[@]}" -o "$LP_STATE_DIR/body" -w '%{http_code}' "$LP_BASE$path")"
  if [ "$code" = "401" ]; then
    if lp_refresh >/dev/null 2>&1; then
      tok="$(_lp_access)"; args=(-sS --max-time 30 -A "$LP_UA" -H "Authorization: Bearer $tok" -X "$method")
      [ -n "$body" ] && args+=(-H 'Content-Type: application/json' --data "$body")
      code="$(curl "${args[@]}" -o "$LP_STATE_DIR/body" -w '%{http_code}' "$LP_BASE$path")"
    fi
  fi
  echo "$code"
}

# Core request helper: prints "HTTP <code> METHOD /path" then the pretty body.
lp_req(){
  local method="$1" path="$2" body="${3:-}" code
  code="$(_lp_fetch "$method" "$path" "$body")"
  echo "HTTP $code  $method $path"
  python3 -m json.tool "$LP_STATE_DIR/body" 2>/dev/null || cat "$LP_STATE_DIR/body"
  echo
}

# Convenience wrappers
lp_get(){ lp_req GET "$1"; }
lp_post(){ lp_req POST "$1" "${2:-}"; }
lp_delete(){ lp_req DELETE "$1"; }

# ============================================================================
# CASE HELPERS
# ============================================================================

# --- shared: current QuickBooks health + Resolution Center ---
sl_status(){
  local c
  c="$(_lp_fetch GET "/api/v1/businesses/$LP_BUSINESS_ID")"
  echo "### accounting mapping(s) on business $LP_BUSINESS_ID   [HTTP $c]"
  python3 - "$LP_STATE_DIR/body" <<'PY' 2>/dev/null || cat "$LP_STATE_DIR/body"
import sys,json
d=json.load(open(sys.argv[1])).get("data",{})
print(json.dumps(d.get("accounting"),indent=2))
PY
  c="$(_lp_fetch GET "/api/v1/analytics/overview")"
  echo "### Resolution Center (analytics/overview -> actionsRequired)   [HTTP $c]"
  python3 - "$LP_STATE_DIR/body" <<'PY' 2>/dev/null || cat "$LP_STATE_DIR/body"
import sys,json
d=json.load(open(sys.argv[1])).get("data",{})
print("actionsRequiredCount =", d.get("actionsRequiredCount"))
print(json.dumps(d.get("actionsRequired"),indent=2))
PY
}

# --- SL-S3-01 / QuickBooks connect: generate the Intuit authorize URL ---
# Usage: sl_qb_initiate [businessId] [redirectUrl]
sl_qb_initiate(){
  local biz="${1:-$LP_BUSINESS_ID}" redir="${2:-$LP_DASH/connections}" enc c
  enc="$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$redir")"
  c="$(_lp_fetch GET "/api/v1/oauth/quickbooks/initiate?businessId=$biz&redirectUrl=$enc")"
  echo "### QuickBooks initiate  business=$biz  redirect=$redir   [HTTP $c]"
  python3 - "$LP_STATE_DIR/body" <<'PY' 2>/dev/null || cat "$LP_STATE_DIR/body"
import sys,json
d=json.load(open(sys.argv[1]))
u=d.get("data",{}).get("authorizationUrl")
print("\nOPEN THIS IN YOUR INTUIT-LOGGED-IN BROWSER:\n"+u if u else json.dumps(d,indent=2))
PY
}

# --- SL-T4-01: after Intuit-side revoke, expect status=error + critical reauth item ---
sl_t4_verify(){
  echo "=== SL-T4-01 verify: expect accounting.status=error, lastError set, and a"
  echo "    critical 'Reauthorize QuickBooks' (type reauthorize_quickbooks) item ==="
  sl_status
}
# after clicking Reconnect: expect status=active, lastError null, no item
sl_t4_clear_verify(){ echo "=== SL-T4-01 clear: expect status=active, lastError=null, actionsRequired=[] ==="; sl_status; }

# --- SL-T1-03: local disconnect must still succeed after Intuit already revoked ---
# Usage: sl_t1_03_disconnect [mappingId]   (200 = disconnected locally; 404 = webhook already removed it — both PASS, note which)
sl_t1_03_disconnect(){
  local mid="${1:-$LP_QB_MAPPING_ID}"
  echo "=== SL-T1-03: DELETE accounting mapping $mid — PASS = HTTP 200 or HTTP 404 (mapping already removed by Intuit webhook) ==="
  lp_delete "/api/v1/businesses/$LP_BUSINESS_ID/accounting/$mid"
}

# --- SL-T1-01 (regression): normal app-side disconnect -> 200 ---
sl_t1_01_disconnect(){ local mid="${1:-$LP_QB_MAPPING_ID}"; echo "=== SL-T1-01: DELETE accounting mapping $mid — expect HTTP 200 ==="; lp_delete "/api/v1/businesses/$LP_BUSINESS_ID/accounting/$mid"; }

# --- SL-T2-01: plan-limit check at initiate ---
# Under limit -> 200 authorizationUrl; AT limit (needs biz already at max accounting tools) -> 403.
sl_t2_initiate(){
  local biz="${1:-$LP_BUSINESS_ID}"
  echo "=== SL-T2-01: initiate for business=$biz."
  echo "    PASS(under limit)=200 with authorizationUrl; PASS(at limit)=403"
  echo "    '{...Maximum accounting connections (N) reached...}' and NO 302 ==="
  sl_qb_initiate "$biz"
}

# --- SL-S3-05: prove the exchange code is single-use ---
# Usage: sl_s3_redeem <code>   (after the browser landed on /auth/callback?code=...)
sl_s3_redeem(){
  local code="${1:?usage: sl_s3_redeem <code>}"
  echo "=== SL-S3-05: redeem code — after the frontend already redeemed it, expect HTTP 401"
  echo "    'Invalid or expired exchange code' and NO accessToken/refreshToken in body ==="
  lp_post "/api/v1/auth/exchange-code/redeem" "{\"code\":\"$code\"}"
}

# --- SL-S3-02 / S3-03 / S3-01: redirect allow-list matrix (authenticated) ---
sl_redirect_matrix(){
  local biz="${1:-$LP_BUSINESS_ID}"
  echo "=== Redirect allow-list matrix (QuickBooks initiate) ==="
  for r in "$LP_DASH/connections" "$LP_SHOPIFY_APP/connections" \
           "https://evil.example.com/x" "https://app-staging.ledgerport.com.evil.com/x" \
           "https://evil-app-staging.ledgerport.com/x"; do
    echo "--- redirectUrl=$r  (dashboard/shopify-app => 200 authorizationUrl; others => 400) ---"
    local enc; enc="$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$r")"
    lp_get "/api/v1/oauth/quickbooks/initiate?businessId=$biz&redirectUrl=$enc" | head -c 260; echo; echo
  done
}

# --- SL-S1-01 (regression): Cache-Control on API responses ---
sl_s1_headers(){
  echo "=== SL-S1-01: expect 'Cache-Control: no-store, no-cache, must-revalidate' ==="
  local tok; tok="$(_lp_access)"
  curl -sS -D - -o /dev/null --max-time 25 -A "$LP_UA" -H "Authorization: Bearer $tok" \
    "$LP_BASE/api/v1/businesses/$LP_BUSINESS_ID/connections" | grep -i '^cache-control:'
}

# --- SL-S4-01 (regression): removed unauthenticated lookups -> 404 ---
sl_s4_removed(){
  echo "=== SL-S4-01: removed endpoints must all be 404 (route not found), no company data ==="
  local tok; tok="$(_lp_access)"
  for ep in "/api/v1/connections/shop/$LP_SHOP" \
            "/api/v1/connections/exists/$LP_BUSINESS_ID" \
            "/api/v1/connections/business/$LP_BUSINESS_ID/platform/shopify"; do
    echo "-- no auth:  $ep -> $(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 -A "$LP_UA" "$LP_BASE$ep")"
    echo "-- with tok: $ep -> $(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 -A "$LP_UA" -H "Authorization: Bearer $tok" "$LP_BASE$ep")"
  done
  echo "-- kept (should be 200): /api/v1/businesses/$LP_BUSINESS_ID/connections -> $(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 -A "$LP_UA" -H "Authorization: Bearer $tok" "$LP_BASE/api/v1/businesses/$LP_BUSINESS_ID/connections")"
}

echo "lp-api.sh loaded. State dir: $LP_STATE_DIR"
echo "Functions: sl_status  sl_qb_initiate  sl_t4_verify  sl_t4_clear_verify  sl_t1_03_disconnect"
echo "           sl_t1_01_disconnect  sl_t2_initiate  sl_s3_redeem  sl_redirect_matrix  sl_s1_headers  sl_s4_removed"
[ -z "${LP_ACCESS:-}" ] && echo "WARNING: LP_ACCESS not set — export a fresh accessToken before running checks."
