#!/bin/bash
# Hetzner API helper for Edge server management

HETZNER_API_KEY="rETfB9AQOUs3hbFkjZIkBZUnV1sqFc1ARSKMYuxl2qT7DCK7Oy0iCoVe7eLNQuvT"
EDGE_SERVER_ID=""

# List all servers
hetzner_list_servers() {
    curl -s -H "Authorization: Bearer $HETZNER_API_KEY" \
        "https://api.hetzner.cloud/v1/servers" | python3 -m json.tool
}

# Get server info by IP
hetzner_get_server_by_ip() {
    local IP=$1
    curl -s -H "Authorization: Bearer $HETZNER_API_KEY" \
        "https://api.hetzner.cloud/v1/servers" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for server in data['servers']:
    for ip in server['public_net']['ipv4']['ip']:
        if ip == '$IP':
            print(json.dumps(server, indent=2))
            sys.exit(0)
"
}

# Enable rescue mode
hetzner_enable_rescue() {
    local SERVER_ID=$1
    curl -s -X POST -H "Authorization: Bearer $HETZNER_API_KEY" \
        -d "type=linux64" \
        "https://api.hetzner.cloud/v1/servers/$SERVER_ID/actions/enable_rescue" | python3 -m json.tool
}

# Reboot server
hetzner_reboot() {
    local SERVER_ID=$1
    curl -s -X POST -H "Authorization: Bearer $HETZNER_API_KEY" \
        "https://api.hetzner.cloud/v1/servers/$SERVER_ID/actions/reboot" | python3 -m json.tool
}

# Reset root password
hetzner_reset_password() {
    local SERVER_ID=$1
    curl -s -X POST -H "Authorization: Bearer $HETZNER_API_KEY" \
        "https://api.hetzner.cloud/v1/servers/$SERVER_ID/actions/reset_password" | python3 -m json.tool
}

case "$1" in
    list)
        hetzner_list_servers
        ;;
    get-by-ip)
        hetzner_get_server_by_ip "$2"
        ;;
    rescue)
        hetzner_enable_rescue "$2"
        ;;
    reboot)
        hetzner_reboot "$2"
        ;;
    reset-password)
        hetzner_reset_password "$2"
        ;;
    *)
        echo "Usage: $0 {list|get-by-ip|rescue|reboot|reset-password}"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 get-by-ip 77.42.71.94"
        echo "  $0 rescue <server_id>"
        echo "  $0 reboot <server_id>"
        echo "  $0 reset-password <server_id>"
        exit 1
        ;;
esac
