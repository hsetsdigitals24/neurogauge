#!/usr/bin/env bash
# Static/SEO/security-surface audit for Neurogauge public pages.
# Usage: bash e2e/scripts/prod-audit.sh [base_url]   (default: https://www.neurogauge.africa)
# Read-only: only GET/HEAD requests; the results probe uses a fabricated email.
set -u
BASE="${1:-https://www.neurogauge.africa}"
UA="Mozilla/5.0 (compatible; NeurogaugeQA/1.0)"

fetch() { curl -sL -A "$UA" --max-time 30 "$1"; }

section() { printf '\n=== %s ===\n' "$1"; }

PAGES=("/" "/auth/login" "/auth/signup" "/results")

section "1. Per-page <title> and meta description (QA Issue 1: duplicate metadata)"
for p in "${PAGES[@]}"; do
  html=$(fetch "$BASE$p")
  title=$(printf '%s' "$html" | grep -oE '<title>[^<]*</title>' | head -1)
  desc=$(printf '%s' "$html" | grep -oE '<meta name="description" content="[^"]*"' | head -1)
  og=$(printf '%s' "$html" | grep -cE 'property="og:')
  printf '%-14s title=%s\n%-14s desc=%s\n%-14s og_tags=%s\n' "$p" "${title:-<none>}" "" "${desc:-<none>}" "" "$og"
done

section "2. Double-space in title (QA Issue 2)"
for p in "${PAGES[@]}"; do
  if fetch "$BASE$p" | grep -qE '<title>[^<]*  [^<]*</title>'; then
    echo "$p: DOUBLE SPACE PRESENT"
  else
    echo "$p: ok"
  fi
done

section "3. No-JS rendering of forms (QA Issue 3: client-side rendering)"
for p in "/auth/login" "/auth/signup" "/results"; do
  html=$(fetch "$BASE$p")
  forms=$(printf '%s' "$html" | grep -c '<form')
  inputs=$(printf '%s' "$html" | grep -c '<input')
  echo "$p: <form> count=$forms, <input> count=$inputs (0 = fully client-rendered)"
done

section "4. Duplicate logo links (QA Issue 4)"
for p in "/auth/login" "/auth/signup" "/results"; do
  html=$(fetch "$BASE$p")
  logos=$(printf '%s' "$html" | grep -oE 'alt="Logo"' | wc -l)
  echo "$p: img[alt=Logo] count=$logos (expected 1: header only; footer logo counts too if present)"
done

section "5. Privacy/Terms links (QA Issue 5)"
html=$(fetch "$BASE/")
for path in privacy terms; do
  if printf '%s' "$html" | grep -qiE "href=\"/$path\""; then
    echo "/$path link: PRESENT"
    code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$BASE/$path")
    echo "/$path page: HTTP $code"
  else
    echo "/$path link: MISSING"
  fi
done

section "6. HTTPS + canonical redirects"
if [[ "$BASE" == *neurogauge.africa* ]]; then
  for u in "http://neurogauge.africa" "https://neurogauge.africa" "http://www.neurogauge.africa"; do
    out=$(curl -sI -o /dev/null -w '%{http_code} -> %{redirect_url}' --max-time 30 "$u")
    echo "$u: $out"
  done
else
  echo "(skipped: not the production domain)"
fi

section "7. robots.txt / sitemap.xml"
for f in robots.txt sitemap.xml; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$BASE/$f")
  echo "/$f: HTTP $code"
done

section "8. Results lookup enumeration probe (read-only, fabricated email)"
probe_email="qa-nonexistent-$(date +%s)@example.invalid"
resp=$(curl -s -w '\nHTTP_CODE=%{http_code}' -A "$UA" "$BASE/api/results?email=$probe_email")
echo "GET /api/results?email=$probe_email"
echo "$resp"
echo "(HTTP 200 with a JSON array = endpoint is public and unverified; any known email would return that participant's full session data)"

section "Done: $BASE"
