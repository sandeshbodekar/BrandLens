#!/usr/bin/env bash
# BrandLens pre-submission check. Run from anywhere inside the repo (Git Bash, macOS or Linux):
#
#   bash scripts/release-check.sh                       # repo checks and unit tests
#   bash scripts/release-check.sh https://your-api.onrender.com   # also pings the live API
#
# It only READS: it changes nothing. FAIL means fix it before you submit; WARN means look at it.

cd "$(git rev-parse --show-toplevel)" || exit 1
fails=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; fails=$((fails + 1)); }
warn() { echo "WARN  $1"; }

# 1. No real .env file is tracked (.env.example is fine).
tracked_env=$(git ls-files | grep -E '(^|/)\.env(\..*)?$' | grep -v '\.env\.example$')
if [ -n "$tracked_env" ]; then fail "env file is tracked by git: $tracked_env"; else pass "no .env file is tracked"; fi

# 2. No leftover merge-conflict markers.
conflicts=$(git grep -nE '^(<<<<<<<|>>>>>>>) ' -- . ':!scripts/release-check.sh' | head -5)
if [ -n "$conflicts" ]; then fail "merge conflict markers found:"; echo "$conflicts"; else pass "no merge conflict markers"; fi

# 3. No secrets in the current files (test files are skipped: they contain fake values).
secrets=$(git grep -nIE 'AIza[0-9A-Za-z_-]{35}|(JWT_SECRET|LLM_API_KEY)=[^[:space:]]+' -- . ':!*.test.js' ':!*.example' ':!scripts/release-check.sh' | head -5)
if [ -n "$secrets" ]; then fail "possible secret in tracked files:"; echo "$secrets"; else pass "no API key or secret pattern in tracked files"; fi

# 4. No secrets anywhere in the git history. A hit means: rotate that key, then review the commit.
hist=$(git log --all --oneline -G'AIza[0-9A-Za-z_-]{35}' 2>/dev/null | head -5)
if [ -n "$hist" ]; then warn "a Google API key pattern appears in history. Rotate the key, then check:"; echo "$hist"; else pass "no Google API key pattern in git history"; fi

# 5. Stray files that should not be in the repo.
stray=$(git ls-files | grep -E '(^|/)(brandlens-code.*\.txt|brandlens-drafts\.json|.*\.zip|.*\.log)$')
if [ -n "$stray" ]; then fail "stray files are tracked (remove with git rm): $stray"; else pass "no stray exports or archives tracked"; fi

# 6. Every image the README shows exists and is tracked.
missing=""
for img in $(grep -oE '\]\((docs/[^)]+)\)' README.md | sed -E 's/^\]\((.*)\)$/\1/'); do
  git ls-files --error-unmatch "$img" >/dev/null 2>&1 || missing="$missing $img"
done
if [ -n "$missing" ]; then fail "README images missing or not committed:$missing"; else pass "all README images exist and are committed"; fi

# 7. Working tree is clean.
if [ -n "$(git status --porcelain)" ]; then warn "uncommitted changes:"; git status --short; else pass "working tree is clean"; fi

# 8. Unit tests.
if [ -d server ]; then
  summary=$(cd server && npm test 2>&1 | grep -E '^# (tests|pass|fail)' | tr '\n' ' ')
  case "$summary" in *"# fail 0"*) pass "unit tests: $summary" ;; *) fail "unit tests: ${summary:-did not run (run npm install in server/)}" ;; esac
fi

# 9. Live API (optional argument).
if [ -n "$1" ]; then
  api="${1%/}"
  code=$(curl -s -o /tmp/brandlens_health.json -w '%{http_code}' --max-time 70 "$api/api/health")
  if [ "$code" = "200" ] && grep -q '"ok":true' /tmp/brandlens_health.json; then pass "live API health check: $api"; else fail "live API health check failed (HTTP $code). A sleeping free server can need a second try."; fi
fi

# 10. Tag status.
if git rev-parse -q --verify "refs/tags/v1.0-round2" >/dev/null; then pass "tag v1.0-round2 exists"; else warn "tag v1.0-round2 not created yet"; fi

echo
if [ "$fails" -eq 0 ]; then echo "No failures. Review any WARN lines, then tag and submit."; else echo "$fails failure(s). Fix them before submitting."; exit 1; fi
