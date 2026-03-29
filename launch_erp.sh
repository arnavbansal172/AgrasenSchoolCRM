#!/usr/bin/env bash
# ── Shri Agrasen Vidya Mandir ERP Launcher ────────────────────────────────────
# Starts the entire ERP stack: 
# 1. Node.js Sync Server (Port 3002)
# 2. Vite Frontend Server (Port 5173)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "🏫  SAVM ERP – BOOTING SYSTEM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. CLEANUP: Clear any stale or zombie processes ──────────────────────────
echo "  ▸ Clearing ports and stale services..."

# Aggressive port clearing (3001 is old backend, 3002 is new, 5173 is Vite)
fuser -k 3001/tcp 3002/tcp 5173/tcp 2>/dev/null || true

# Backup: kill processes by command name
pkill -f "node backend/index.js" 2>/dev/null || true
pkill -f "vite"                  2>/dev/null || true

sleep 2
echo "  ✓ Environment Purged."

# ── 2. BACKEND: Start the Universal Sync Server ──────────────────────────────
echo "  ▸ Starting Core Sync Server (Port 3002)..."
node backend/index.js &
NODE_PID=$!
sleep 2

# Verify backend health before proceeding
if ! kill -0 $NODE_PID 2>/dev/null; then
  echo "  ✗ ERROR: Core Sync Server failed to start."
  exit 1
fi
echo "  ✓ Sync Server Online (PID: $NODE_PID)"

# ── 3. FRONTEND: Start Vite Interface ────────────────────────────────────────
# This runs in the foreground so Ctrl+C shuts down the whole launcher.
echo "  ▸ Starting User Interface (Port 5173)..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DEVICE ACCESS  : http://localhost:5173"
echo "  PHONE/LAN LINK : http://$(hostname -I | awk '{print $1}'):5173"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Trap Ctrl+C to clean up the background Node server on exit
trap "echo ''; echo '🛑 Stopping SAVM ERP...'; kill $NODE_PID 2>/dev/null; exit 0" INT TERM

npx vite --host --port 5173
