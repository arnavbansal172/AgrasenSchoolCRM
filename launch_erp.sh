#!/usr/bin/env bash
# ── Shri Agrasen Vidya Mandir ERP Launcher ────────────────────────────────────
# Starts the entire ERP stack:
# 1. Node.js API Server with PostgreSQL (Port 3002)
# 2. Vite Frontend Server (Port 5173)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Source nvm so node/npm/npx are available ──────────────────────────────────
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Fallback: direct path if nvm is not set up
if ! command -v node &>/dev/null; then
  export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"
fi

echo ""
echo "🏫  SAVM ERP – BOOTING SYSTEM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. CLEANUP: Kill stale processes and clear ports ───────────────────────────
echo "  ▸ Clearing ports and stale services..."
fuser -k 3002/tcp 5173/tcp 2>/dev/null || true
pkill -f "node backend/index.js" 2>/dev/null || true
pkill -f "vite"                  2>/dev/null || true
sleep 1
echo "  ✓ Environment Purged."

# ── 2. BACKEND: Start the PostgreSQL API Server ────────────────────────────────
echo "  ▸ Starting Core Sync Server (Port 3002)..."
node backend/index.js &
NODE_PID=$!
sleep 3

# Verify backend is still running
if ! kill -0 $NODE_PID 2>/dev/null; then
  echo "  ✗ ERROR: Core Sync Server failed to start."
  echo "  → Check that PostgreSQL is running: systemctl status postgresql"
  exit 1
fi
echo "  ✓ Sync Server Online (PID: $NODE_PID)"

# ── 3. FRONTEND: Start Vite Interface ─────────────────────────────────────────
echo "  ▸ Starting User Interface (Port 5173)..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DEVICE ACCESS  : http://localhost:5173"
echo "  PHONE/LAN LINK : http://$(hostname -I | awk '{print $1}'):5173"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Trap Ctrl+C to clean up backend on exit
trap "echo ''; echo '🛑 Stopping SAVM ERP...'; kill $NODE_PID 2>/dev/null; exit 0" INT TERM

npx vite --host --port 5173
