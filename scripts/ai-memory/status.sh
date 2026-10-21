#!/usr/bin/env bash
# scripts/ai-memory/status.sh
#
# Check ai-memory connectivity and project scope.
# Run at the start of any session to confirm the memory layer is available.
#
# Usage:
#   bash scripts/ai-memory/status.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "══════════════════════════════════════════"
echo "  StudyKarle — ai-memory status check"
echo "══════════════════════════════════════════"
echo ""

# ── CLI installed? ────────────────────────────────────────────────────────────

echo "── CLI ──────────────────────────────────"
if command -v ai-memory &>/dev/null; then
  version="$(ai-memory --version 2>/dev/null || echo 'unknown')"
  echo "  ✅ CLI installed: ${version}"
else
  echo "  ❌ ai-memory CLI not found."
  echo "     Run: bash scripts/ai-memory/bootstrap.sh"
  exit 1
fi

# ── .ai-memory.toml marker ────────────────────────────────────────────────────

echo ""
echo "── Marker file ──────────────────────────"
MARKER="${REPO_ROOT}/.ai-memory.toml"
if [[ -f "$MARKER" ]]; then
  echo "  ✅ .ai-memory.toml found"
  workspace="$(grep 'workspace' "$MARKER" | head -1 | tr -d ' ' | cut -d= -f2 | tr -d '"')"
  project="$(grep 'project' "$MARKER" | head -1 | tr -d ' ' | cut -d= -f2 | tr -d '"')"
  echo "     workspace = ${workspace}"
  echo "     project   = ${project}"
else
  echo "  ❌ .ai-memory.toml not found at repo root"
fi

# ── Remote server ─────────────────────────────────────────────────────────────

echo ""
echo "── Remote server ────────────────────────"
if ai-memory status 2>/dev/null; then
  echo "  ✅ Remote server reachable"
else
  echo "  ⚠️  Remote server not reachable (or not configured)"
  echo "     Layer A (repository memory files) is still available."
  echo ""
  echo "     To configure: see docs/ai-memory/SETUP.md"
  echo "     Quick check: AI_MEMORY_SERVICE_URL and AI_MEMORY_AUTH_TOKEN set?"
fi

# ── Server profiles ───────────────────────────────────────────────────────────

echo ""
echo "── Server profiles ──────────────────────"
if ai-memory server list 2>/dev/null; then
  : # output from command
else
  echo "  (no server profiles registered)"
fi

# ── MCP registration ──────────────────────────────────────────────────────────

echo ""
echo "── MCP registration ─────────────────────"
if command -v claude &>/dev/null; then
  if claude mcp list 2>/dev/null | grep -q "ai-memory"; then
    echo "  ✅ Claude Code: ai-memory MCP server registered"
  else
    echo "  ⚠️  Claude Code: ai-memory MCP server NOT registered"
    echo "     Run: ai-memory install-mcp --client claude-code --apply"
  fi
else
  echo "  ⚠️  Claude Code CLI not in PATH"
fi

if command -v codex &>/dev/null; then
  if codex mcp list 2>/dev/null | grep -q "ai-memory" 2>/dev/null; then
    echo "  ✅ Codex: ai-memory MCP server registered"
  else
    echo "  ⚠️  Codex: ai-memory MCP server NOT registered"
    echo "     Run: ai-memory install-mcp --client codex --apply"
  fi
else
  echo "  ⚠️  Codex CLI not in PATH"
fi

# ── Layer A fallback ──────────────────────────────────────────────────────────

echo ""
echo "── Layer A (repository memory) ──────────"
layer_a_ok=1
for f in docs/ai-memory/HANDOFF.md docs/ai-memory/PROJECT_CONTEXT.md docs/ai-memory/KNOWN_ISSUES.md; do
  if [[ -f "${REPO_ROOT}/${f}" ]]; then
    echo "  ✅ ${f}"
  else
    echo "  ❌ ${f} MISSING"
    layer_a_ok=0
  fi
done

if [[ $layer_a_ok -eq 1 ]]; then
  echo "  Layer A is available as a fallback regardless of remote connectivity."
fi

echo ""
echo "══════════════════════════════════════════"
echo "  Done."
echo ""
echo "  Next: read docs/ai-memory/HANDOFF.md for current task state."
echo "  Then: run 'git log --oneline -5' to verify the last known SHA."
echo "══════════════════════════════════════════"
