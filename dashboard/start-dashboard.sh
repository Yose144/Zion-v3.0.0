#!/bin/bash
# ZION V3 — Mainnet Launch Dashboard Launcher (Linux)
# Opens the built-in Python HTTP dashboard in the background and provides access info.
# Zero dependencies: uses only Python stdlib (http.server).

set -e

DASHBOARD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$(dirname "$DASHBOARD_DIR")/logs"
PORT=${1:-8766}

# Ensure logs directory exists
mkdir -p "$LOG_DIR"
echo "Created/verified logs directory: $LOG_DIR"

# Clean up orphaned python dashboard processes
echo "Cleaning up orphaned dashboard processes..."
pkill -f "dashboard/app.py" || true

echo "Starting ZION Mainnet Launch Dashboard on port $PORT ..."
echo "Log directory: $LOG_DIR"
echo "Dashboard directory: $DASHBOARD_DIR"

# Check Python availability
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 not found in PATH. Please install Python 3.10+ and try again."
    exit 1
fi

# Start dashboard server in background
cd "$DASHBOARD_DIR"
python3 app.py &
DASHBOARD_PID=$!

echo "Dashboard PID: $DASHBOARD_PID"

# Wait for dashboard to start
echo "Waiting for dashboard to start..."
sleep 3

# Verify port is open
if ! curl -s "http://127.0.0.1:$PORT/" > /dev/null 2>&1; then
    echo "Warning: Dashboard did not start on port $PORT. Check Python availability or port conflicts."
    echo "Process status:"
    ps -p $DASHBOARD_PID || true
    kill $DASHBOARD_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "✅ Dashboard running at http://127.0.0.1:$PORT"
echo "📊 Open your browser and navigate to: http://127.0.0.1:$Port"
echo ""
echo "Press Ctrl+C to stop the dashboard server."
echo ""

# Wait for interrupt signal
trap "echo 'Stopping dashboard...'; kill $DASHBOARD_PID 2>/dev/null; echo 'Dashboard stopped.'; exit 0" INT TERM

# Keep script running
wait $DASHBOARD_PID