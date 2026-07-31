#!/bin/bash
# ZION Edge — real-time security monitor
# Runs as root via cron or systemd timer every 60s.
# Emits JSON security warnings to /var/log/zion-security.log

set -u

STATE_DIR="/var/lib/zion/security"
ALERT_LOG="/var/log/zion-security.log"
mkdir -p "$STATE_DIR"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

warning() {
  local level="$1" msg="$2" details="${3:-}"
  local line
  if [ -n "$details" ]; then
    line=$(jq -n -c --arg ts "$(timestamp)" --arg lvl "$level" --arg msg "$msg" --argjson det "$details" '{ts:$ts,level:$lvl,message:$msg,details:$det}')
  else
    line=$(jq -n -c --arg ts "$(timestamp)" --arg lvl "$level" --arg msg "$msg" '{ts:$ts,level:$lvl,message:$msg}')
  fi
  echo "$line" >> "$ALERT_LOG"
  logger -t zion-secmon "$level: $msg"
}

# 1. SSH brute-force / failed logins in the last 5 minutes
AUTH_LINE=""
if [ -f /var/log/auth.log ]; then
  AUTH_LINE=$(tail -n 1000 /var/log/auth.log | grep -E "sshd.*Failed password|sshd.*Invalid user|sshd.*authentication failure" | awk -v d="$(date -u -d '5 minutes ago' +%b' '%d' '%H:%M)" '$0 >= d')
fi

if [ -n "$AUTH_LINE" ]; then
  attackers=$(echo "$AUTH_LINE" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | sort | uniq -c | sort -rn)
  if [ -n "$attackers" ]; then
    detail=$(echo "$attackers" | jq -R -s -c 'split("\n") | map(select(length>0)) | map({ip: capture("(?<count>[0-9]+) +(?<ip>[0-9.]+)$") | .ip, count: (capture("(?<count>[0-9]+) +(?<ip>[0-9.]+)$") | .count | tonumber)})')
    warning "WARNING" "SSH brute-force / failed logins detected" "$detail"
  fi
fi

# 2. Newly accepted SSH keys (publickey auth) in the last 5 minutes
if [ -f /var/log/auth.log ]; then
  accepted=$(tail -n 500 /var/log/auth.log | grep -E "sshd.*Accepted publickey" | awk -v d="$(date -u -d '5 minutes ago' +%b' '%d' '%H:%M)" '$0 >= d')
  if [ -n "$accepted" ]; then
    detail=$(echo "$accepted" | jq -R -s -c 'split("\n") | map(select(length>0)) | map({line: .})')
    warning "INFO" "Successful SSH key login" "$detail"
  fi
fi

# 3. Check authorized_keys for root and all users with home dirs
AUTH_KEYS_ALERTS="[]"
for home in /root /home/*; do
  [ -d "$home/.ssh" ] || continue
  f="$home/.ssh/authorized_keys"
  if [ -f "$f" ]; then
    count=$(grep -cE '^(ssh-|ecdsa-|sk-)' "$f" 2>/dev/null || echo 0)
    user=$(basename "$home")
    AUTH_KEYS_ALERTS=$(echo "$AUTH_KEYS_ALERTS" | jq -c --arg u "$user" --arg f "$f" --arg c "$count" '. + [{user:$u,file:$f,count:($c | tonumber)}]')
  fi
done

if [ -f "$STATE_DIR/authorized_keys.json" ]; then
  prev=$(cat "$STATE_DIR/authorized_keys.json")
  if [ "$prev" != "$AUTH_KEYS_ALERTS" ]; then
    warning "CRITICAL" "authorized_keys changed" "$AUTH_KEYS_ALERTS"
  fi
fi
echo "$AUTH_KEYS_ALERTS" > "$STATE_DIR/authorized_keys.json"

# 4. Check for new users or group changes
if [ -f "$STATE_DIR/passwd" ]; then
  if ! diff -q "$STATE_DIR/passwd" /etc/passwd >/dev/null 2>&1; then
    diff_out=$(diff "$STATE_DIR/passwd" /etc/passwd | head -50 | jq -R -s -c 'split("\n") | map(select(length>0))')
    warning "CRITICAL" "/etc/passwd changed" "$diff_out"
  fi
fi
cp /etc/passwd "$STATE_DIR/passwd"

if [ -f "$STATE_DIR/shadow" ]; then
  if ! diff -q "$STATE_DIR/shadow" /etc/shadow >/dev/null 2>&1; then
    warning "CRITICAL" "/etc/shadow changed" "{}"
  fi
fi
cp /etc/shadow "$STATE_DIR/shadow"

# 5. Check UFW / firewall is active
ufw_status=$(ufw status 2>/dev/null | head -1)
if ! echo "$ufw_status" | grep -qi "Status: active"; then
  warning "CRITICAL" "UFW firewall is not active" "{}"
fi

# 6. Check for suspicious running processes (reverse shells, common malware names)
suspicious=$(ps aux | grep -Ei 'nc -e|/dev/tcp|bash -i|reverse|meterpreter|cryptominer|xmrig|minerd' | grep -v grep | head -10)
if [ -n "$suspicious" ]; then
  detail=$(echo "$suspicious" | jq -R -s -c 'split("\n") | map(select(length>0))')
  warning "CRITICAL" "Suspicious process detected" "$detail"
fi

# 7. Check for established SSH connections from unexpected countries / non-ignored IPs
# Ignore local / known operator IPs. Add your own to /etc/zion/allowed-ssh-ips.txt if needed.
ALLOWED_IPS_FILE="/etc/zion/allowed-ssh-ips.txt"
IGNORE_IPS="127.0.0.1 ::1"
if [ -f "$ALLOWED_IPS_FILE" ]; then
  IGNORE_IPS="$IGNORE_IPS $(grep -v '^#' "$ALLOWED_IPS_FILE" | tr '\n' ' ')"
fi

ssh_conns=$(ss -tnp | grep 'sshd' | grep ESTAB | awk '{print $5}' | cut -d: -f1 | sort -u)
for ip in $ssh_conns; do
  skip=0
  for ignore in $IGNORE_IPS; do
    if [ "$ip" = "$ignore" ]; then
      skip=1
      break
    fi
  done
  if [ "$skip" -eq 0 ]; then
    # If IP is not in a few known operator prefixes, alert
    if ! echo "$ip" | grep -qE '^(109\.81\.|82\.66\.|91\.98\.|2a00:102b:4000:)'; then
      detail=$(jq -n -c --arg ip "$ip" '{ip:$ip,service:"sshd"}')
      warning "WARNING" "Unexpected active SSH connection" "$detail"
    fi
  fi
done

# 8. Disk usage > 90%
disk_usage=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$disk_usage" -gt 90 ]; then
  warning "WARNING" "Root disk usage high" "{\"percent\":$disk_usage}"
fi

# 9. Check that zion services are running (cron has no DBus; set the bus address)
export DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/dbus/system_bus_socket}
for svc in zion-edge-pool zion-edge-node1 zion-edge-node2; do
  if ! systemctl is-active --quiet "$svc"; then
    warning "CRITICAL" "ZION service not running" "{\"service\":\"$svc\"}"
  fi
done

# 10. Network listeners — alert if unexpected public port is open
ss -tlnp | awk '$4 !~ /127\.0\.0\.|\[::1\]/ && $4 !~ /:2222|:80|:443|:8333|:8334|:8443|:8444|:8453|:8454|:8455|:8460|:8461|:9090|:9100|:8766|:3000/' > "$STATE_DIR/listeners.new"
if [ -f "$STATE_DIR/listeners.prev" ]; then
  new_listeners=$(diff "$STATE_DIR/listeners.prev" "$STATE_DIR/listeners.new" | grep '^>' | head -20)
  if [ -n "$new_listeners" ]; then
    detail=$(echo "$new_listeners" | jq -R -s -c 'split("\n") | map(select(length>0))')
    warning "WARNING" "Unexpected listening port detected" "$detail"
  fi
fi
cp "$STATE_DIR/listeners.new" "$STATE_DIR/listeners.prev"
