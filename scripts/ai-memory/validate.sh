#!/usr/bin/env bash
# scripts/ai-memory/validate.sh
#
# Validates ai-memory configuration and checks for security issues.
# Run before committing, after changing configuration, or after a deployment.
#
# Usage:
#   bash scripts/ai-memory/validate.sh
#
# Exit code 0 = all checks passed
# Exit code 1 = one or more checks failed

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PASS=0; FAIL=0; WARN=0

# ── Helpers ───────────────────────────────────────────────────────────────────

pass() { echo "  ✅ PASS: $*"; PASS=$((PASS+1)); }
fail() { echo "  ❌ FAIL: $*" >&2; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  WARN: $*"; WARN=$((WARN+1)); }
section() { echo ""; echo "── $* ──────────────────────────"; }

# ── Security: no credentials in tracked files ─────────────────────────────────

section "Credential scan (tracked files)"

check_no_secret_patterns() {
  local patterns=(
    "AI_MEMORY_AUTH_TOKEN=['\"]?[a-zA-Z0-9+/=]{20,}"
    "ANTHROPIC_API_KEY=sk-ant-[a-zA-Z0-9]"
    "OPENAI_API_KEY=sk-[a-zA-Z0-9]"
    "DATABASE_URL=postgres://[^$]"
    "-----BEGIN.*PRIVATE KEY-----"
    'password\s*=\s*['"'"'"][^${'"'"'"}{]'
  )

  local found=0
  for pattern in "${patterns[@]}"; do
    if git -C "$REPO_ROOT" grep -rn --include="*.toml" --include="*.yml" \
         --include="*.yaml" --include="*.json" --include="*.md" \
         --include="*.env*" --include="*.sh" \
         -E "$pattern" -- . \
         ':!*.example' ':!.env.example' ':!docs/ai-memory/SETUP.md' \
         2>/dev/null | grep -v "^Binary\|REPLACE_WITH\|YOUR_TOKEN\|<your\|placeholder" | head -5; then
      found=1
    fi
  done

  if [[ $found -eq 0 ]]; then
    pass "No credential patterns found in tracked files"
  else
    fail "Potential credentials found — review the output above and remove or rotate"
  fi
}

check_no_secret_patterns

# ── .ai-memory.toml validation ────────────────────────────────────────────────

section ".ai-memory.toml marker"

MARKER="${REPO_ROOT}/.ai-memory.toml"

if [[ -f "$MARKER" ]]; then
  pass ".ai-memory.toml exists"
else
  fail ".ai-memory.toml not found at repo root"
fi

if [[ -f "$MARKER" ]]; then
  if grep -q 'workspace\s*=\s*"nitishdotdev"' "$MARKER"; then
    pass "workspace = \"nitishdotdev\" set correctly"
  else
    fail "workspace field missing or incorrect in .ai-memory.toml"
  fi

  if grep -q 'project\s*=\s*"StudyKarle"' "$MARKER"; then
    pass "project = \"StudyKarle\" set correctly"
  else
    fail "project field missing or incorrect in .ai-memory.toml"
  fi

  if grep -qE 'url\s*=|token\s*=|password\s*=' "$MARKER"; then
    fail ".ai-memory.toml appears to contain a URL, token, or password — remove it"
  else
    pass ".ai-memory.toml contains no credentials"
  fi
fi

# ── .gitignore validation ─────────────────────────────────────────────────────

section ".gitignore coverage"

GITIGNORE="${REPO_ROOT}/.gitignore"

check_gitignore() {
  local pattern="$1"
  local label="$2"
  if [[ -f "$GITIGNORE" ]] && grep -qF "$pattern" "$GITIGNORE" 2>/dev/null; then
    pass ".gitignore covers $label"
  else
    warn ".gitignore may not cover $label (pattern: $pattern)"
  fi
}

check_gitignore ".env"             ".env files"
check_gitignore "deploy/ai-memory/data" "ai-memory data directory"
check_gitignore ".claude/mcp.json"  ".claude/mcp.json (may contain server URL)"

# ── Required files present ────────────────────────────────────────────────────

section "Required memory files"

required_files=(
  "docs/ai-memory/README.md"
  "docs/ai-memory/PROJECT_CONTEXT.md"
  "docs/ai-memory/DECISIONS.md"
  "docs/ai-memory/HANDOFF.md"
  "docs/ai-memory/KNOWN_ISSUES.md"
  "docs/ai-memory/OPERATIONS.md"
  "docs/ai-memory/SETUP.md"
  "deploy/ai-memory/docker-compose.yml"
  "deploy/ai-memory/.env.example"
  "deploy/ai-memory/nginx.conf"
  "CLAUDE.md"
  "AGENTS.md"
)

for f in "${required_files[@]}"; do
  if [[ -f "${REPO_ROOT}/${f}" ]]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done

# ── ai-memory routing block present ───────────────────────────────────────────

section "Agent instruction routing blocks"

if grep -q "ai-memory:start" "${REPO_ROOT}/CLAUDE.md" 2>/dev/null; then
  pass "CLAUDE.md contains ai-memory routing block"
else
  fail "CLAUDE.md is missing the ai-memory routing block"
fi

if grep -q "memory_handoff_list\|memory_briefing" "${REPO_ROOT}/AGENTS.md" 2>/dev/null; then
  pass "AGENTS.md references ai-memory MCP tools"
else
  fail "AGENTS.md does not reference ai-memory MCP tools"
fi

# ── Docker Compose validation ─────────────────────────────────────────────────

section "Docker Compose"

COMPOSE="${REPO_ROOT}/deploy/ai-memory/docker-compose.yml"

if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  if docker compose -f "$COMPOSE" config --quiet 2>/dev/null; then
    pass "docker-compose.yml parses correctly"
  else
    fail "docker-compose.yml has errors (run: docker compose -f $COMPOSE config)"
  fi
else
  warn "docker or 'docker compose' not available — skipping Compose validation"
fi

if grep -q "akitaonrails/ai-memory:2.0.2" "$COMPOSE" 2>/dev/null; then
  pass "Docker image is pinned to 2.0.2"
elif grep -q "ai-memory:latest" "$COMPOSE" 2>/dev/null; then
  fail "Docker image uses :latest — pin to an explicit version"
else
  warn "Could not verify Docker image pin in Compose file"
fi

# ── ai-memory CLI ─────────────────────────────────────────────────────────────

section "ai-memory CLI"

if command -v ai-memory &>/dev/null; then
  pass "ai-memory CLI is installed ($(ai-memory --version 2>/dev/null || echo 'version unknown'))"

  if ai-memory status &>/dev/null 2>&1; then
    pass "ai-memory status reports OK"
  else
    warn "ai-memory status returned an error (remote service may not be deployed yet)"
  fi
else
  warn "ai-memory CLI not installed in this environment"
  warn "Run: bash scripts/ai-memory/bootstrap.sh"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
echo "  Validation summary"
echo "  PASS: $PASS  FAIL: $FAIL  WARN: $WARN"
echo "════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "One or more checks FAILED. Fix the issues above before committing."
  exit 1
fi

if [[ $WARN -gt 0 ]]; then
  echo ""
  echo "Checks passed with warnings. Review warnings above."
fi

echo ""
echo "All required checks passed."
