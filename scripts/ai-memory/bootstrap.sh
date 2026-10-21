#!/usr/bin/env bash
# scripts/ai-memory/bootstrap.sh
#
# Idempotent bootstrap for the ai-memory CLI in any cloud coding environment.
# Run at the start of a Claude Code or Codex session if the CLI is not already installed.
#
# Usage:
#   bash scripts/ai-memory/bootstrap.sh
#
# Required environment variables (set in your hosting platform's secret store):
#   AI_MEMORY_SERVICE_URL   - Full HTTPS URL of the remote ai-memory service
#   AI_MEMORY_AUTH_TOKEN    - Bearer token for authentication
#
# Optional:
#   AI_MEMORY_VERSION       - Override the pinned version (default: 2.0.2)
#   FORCE_REINSTALL         - Set to "1" to reinstall even if already installed

set -euo pipefail

PINNED_VERSION="${AI_MEMORY_VERSION:-2.0.2}"
INSTALL_DIR="${HOME}/.local/bin"
BINARY="${INSTALL_DIR}/ai-memory"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# ── Helpers ───────────────────────────────────────────────────────────────────

info()  { echo "[bootstrap] $*"; }
warn()  { echo "[bootstrap] WARNING: $*" >&2; }
error() { echo "[bootstrap] ERROR: $*" >&2; exit 1; }

check_env() {
  local missing=0
  for var in AI_MEMORY_SERVICE_URL AI_MEMORY_AUTH_TOKEN; do
    if [[ -z "${!var:-}" ]]; then
      warn "Environment variable $var is not set."
      missing=1
    fi
  done
  if [[ $missing -eq 1 ]]; then
    warn "Remote server connection will not be configured."
    warn "Set the above variables and re-run, or configure manually."
  fi
}

is_installed() {
  [[ -x "$BINARY" ]] && \
  "$BINARY" --version 2>/dev/null | grep -qF "$PINNED_VERSION"
}

install_cli() {
  info "Installing ai-memory v${PINNED_VERSION}..."

  local arch
  arch="$(uname -m)"
  local os_name
  os_name="$(uname -s | tr '[:upper:]' '[:lower:]')"

  case "${arch}" in
    x86_64|amd64) arch="x86_64" ;;
    aarch64|arm64) arch="aarch64" ;;
    *) error "Unsupported architecture: ${arch}" ;;
  esac

  case "${os_name}" in
    linux)  ;;
    darwin) os_name="macos" ;;
    *)      error "Unsupported OS: ${os_name}" ;;
  esac

  local base_url="https://github.com/akitaonrails/ai-memory/releases/download/v${PINNED_VERSION}"
  local tarball="ai-memory-${os_name}-${arch}.tar.gz"
  local sha_file="${tarball}.sha256"

  # Prefer the managed wrapper (includes Docker relay logic)
  local wrapper_url="${base_url}/ai-memory-wrapper"
  local wrapper_sha_url="${base_url}/ai-memory-wrapper.sha256"

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT

  info "Downloading wrapper from ${wrapper_url}..."
  curl -fsSL "$wrapper_url" -o "${tmp_dir}/ai-memory-wrapper"
  curl -fsSL "$wrapper_sha_url" -o "${tmp_dir}/ai-memory-wrapper.sha256"

  info "Verifying SHA-256..."
  local expected actual
  expected="$(awk 'NR==1{print $1}' "${tmp_dir}/ai-memory-wrapper.sha256")"

  if command -v sha256sum &>/dev/null; then
    actual="$(sha256sum "${tmp_dir}/ai-memory-wrapper" | awk '{print $1}')"
  elif command -v shasum &>/dev/null; then
    actual="$(shasum -a 256 "${tmp_dir}/ai-memory-wrapper" | awk '{print $1}')"
  else
    error "No sha256sum or shasum found. Cannot verify download integrity."
  fi

  if [[ "$expected" != "$actual" ]]; then
    error "SHA-256 mismatch! Expected: ${expected}, Got: ${actual}. Aborting."
  fi

  mkdir -p "$INSTALL_DIR"
  install -m 0755 "${tmp_dir}/ai-memory-wrapper" "$BINARY"
  info "Installed to ${BINARY}"
}

configure_server_profile() {
  local url="${AI_MEMORY_SERVICE_URL:-}"
  local token="${AI_MEMORY_AUTH_TOKEN:-}"

  if [[ -z "$url" || -z "$token" ]]; then
    warn "Skipping server profile registration (missing AI_MEMORY_SERVICE_URL or AI_MEMORY_AUTH_TOKEN)."
    return
  fi

  # Check if the profile is already registered
  if ai-memory server list 2>/dev/null | grep -q "studykarle-memory"; then
    info "Server profile 'studykarle-memory' already registered."
    return
  fi

  info "Registering remote server profile 'studykarle-memory'..."
  echo "$token" | ai-memory server add studykarle-memory \
    --url "$url" \
    --root "$REPO_ROOT" \
    --auth-token-stdin
  info "Server profile registered."
}

install_claude_code_integration() {
  if ! command -v claude &>/dev/null; then
    warn "Claude Code CLI not found; skipping MCP and hook installation."
    return
  fi

  info "Installing Claude Code MCP server..."
  ai-memory install-mcp --client claude-code --apply || warn "MCP install failed (may already be installed)."

  info "Installing Claude Code lifecycle hooks..."
  ai-memory install-hooks --agent claude-code --apply || warn "Hook install failed (may already be installed)."
}

install_codex_integration() {
  if ! command -v codex &>/dev/null; then
    warn "Codex CLI not found; skipping MCP and hook installation."
    return
  fi

  info "Installing Codex MCP server..."
  ai-memory install-mcp --client codex --apply || warn "MCP install failed (may already be installed)."

  info "Installing Codex lifecycle hooks..."
  ai-memory install-hooks --agent codex --apply || warn "Hook install failed (may already be installed)."
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  info "ai-memory bootstrap starting (version target: ${PINNED_VERSION})"
  info "Repository root: ${REPO_ROOT}"

  check_env

  if [[ "${FORCE_REINSTALL:-0}" != "1" ]] && is_installed; then
    info "ai-memory ${PINNED_VERSION} already installed at ${BINARY}. Skipping download."
  else
    install_cli
  fi

  configure_server_profile
  install_claude_code_integration
  install_codex_integration

  info ""
  info "Bootstrap complete. Run 'bash scripts/ai-memory/status.sh' to verify connectivity."
}

main "$@"
