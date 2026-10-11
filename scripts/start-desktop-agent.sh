#!/bin/bash
# Start the ZION desktop agent (Electron). Used by zion-desktop-agent.service
# (graphical-session.target) — also still callable manually / from .desktop.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd "/home/zionserver/2.9.6-main/APP&WEB/desktop-agent" || exit 1

# If we were started outside the session (e.g. linger, early boot), pull the
# display env out of the live gnome-shell process so Electron can connect.
if [ -z "${DISPLAY:-}" ]; then
  SESH_PID=$(pgrep -u "$USER" -x gnome-shell | head -1)
  if [ -n "$SESH_PID" ]; then
    eval "$(tr '\0' '\n' < "/proc/$SESH_PID/environ" | grep -E '^(DISPLAY|WAYLAND_DISPLAY|XAUTHORITY|XDG_RUNTIME_DIR|DBUS_SESSION_BUS_ADDRESS)=' | sed 's/^/export /')"
  fi
fi

# gnome-shell can move the Electron process out of our service cgroup into an
# app-*.scope — then systemd can't kill it and a new instance just loses the
# single-instance lock and exits 0. Kill any leftover first (pattern matches
# the electron binary path only, never this script or the node launcher).
for i in $(seq 1 10); do
  pkill -u "$USER" -f "electron/dist/electron .*desktop-agent" 2>/dev/null || break
  sleep 1
done

LOG="$HOME/.config/zion-desktop-agent/agent-autostart.log"
mkdir -p "$(dirname "$LOG")"
exec node scripts/launch-electron.js >> "$LOG" 2>&1
