#!/usr/bin/env bash
# scripts/ai-memory/handoff-prep.sh
#
# Prepares a cross-agent handoff at the end of a session.
# Updates HANDOFF.md with current Git state and prompts for a summary.
#
# Usage:
#   bash scripts/ai-memory/handoff-prep.sh
#
# Or with a pre-written summary:
#   HANDOFF_SUMMARY="Fixed Drive sync deduplication bug. See commit abc1234." \
#     bash scripts/ai-memory/handoff-prep.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HANDOFF_FILE="${REPO_ROOT}/docs/ai-memory/HANDOFF.md"

# ── Gather Git state ──────────────────────────────────────────────────────────

current_sha="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo 'NOT A GIT REPO')"
current_branch="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
dirty=""
if ! git -C "$REPO_ROOT" diff --quiet 2>/dev/null || ! git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
  dirty=" (UNCOMMITTED CHANGES PRESENT)"
fi

echo "Current SHA:    ${current_sha}${dirty}"
echo "Current branch: ${current_branch}"
echo ""

# ── Get handoff summary ───────────────────────────────────────────────────────

if [[ -n "${HANDOFF_SUMMARY:-}" ]]; then
  summary="$HANDOFF_SUMMARY"
else
  echo "Enter a brief handoff summary (what was done, what's next, any blockers)."
  echo "Press Enter twice when done:"
  summary=""
  while IFS= read -r line; do
    [[ -z "$line" && -n "$summary" ]] && break
    summary+="${line}"$'\n'
  done
  summary="${summary%$'\n'}"
fi

if [[ -z "$summary" ]]; then
  echo "No summary entered. Handoff not updated."
  exit 0
fi

# ── Write to remote memory (if available) ─────────────────────────────────────

if command -v ai-memory &>/dev/null && ai-memory status &>/dev/null 2>&1; then
  echo ""
  echo "Remote ai-memory reachable — creating remote handoff..."
  # The MCP tool memory_handoff_begin is called by the agent via MCP.
  # This script records state in the repository file as the reliable fallback.
  echo "Note: to create a full MCP handoff, call memory_handoff_begin via the agent's MCP tools."
else
  echo ""
  echo "Remote ai-memory not reachable — updating Layer A (repository) handoff only."
fi

# ── Update HANDOFF.md ─────────────────────────────────────────────────────────

timestamp="$(date -u +"%Y-%m-%d %H:%M UTC")"
agent="${USER:-$(whoami 2>/dev/null || echo 'agent')}"

# Build the header block
header="## Current session status

**Last updated**: ${timestamp}
**Updated by**: ${agent}
**Last verified commit SHA**: ${current_sha}${dirty}
**Branch**: ${current_branch}

---

## Summary

${summary}

---"

# Replace from the start of "## Current session status" to the first "---" separator
python3 - "$HANDOFF_FILE" "$header" <<'EOF'
import sys, re

path = sys.argv[1]
new_header = sys.argv[2]

with open(path, 'r') as f:
    content = f.read()

# Replace the existing header block (from ## Current session status to first --- after it)
pattern = r'## Current session status.*?---'
replacement = new_header
result = re.sub(pattern, replacement, content, count=1, flags=re.DOTALL)

with open(path, 'w') as f:
    f.write(result)
EOF

echo ""
echo "HANDOFF.md updated with SHA ${current_sha} on branch ${current_branch}."
echo ""
echo "Next steps:"
echo "  1. Review and extend HANDOFF.md manually for detailed next steps / blockers."
echo "  2. git add docs/ai-memory/HANDOFF.md && git commit -m 'chore: update handoff [skip ci]'"
echo "  3. If remote ai-memory is available, call memory_handoff_begin via MCP tools."
