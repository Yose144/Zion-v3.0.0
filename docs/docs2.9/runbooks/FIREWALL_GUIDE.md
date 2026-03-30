# ZION Firewall Guide (Linux, Windows, Cloud)

Harden inbound/outbound traffic to only what’s necessary.

## Ports Reference
- Zion P2P: 18080 (public optional)
- Zion RPC: 18081 (internal only)
- Walletd RPC: 8070 (internal only)
- RPC Shim: 18089 (internal only)
- Pool Stratum: 3333 (public if running a public pool)
- LND P2P: 9735 (public)
- LND REST: 8080 (internal)
- LND gRPC: 10009 (internal)

## Linux (UFW)
```bash
# Default deny
ufw default deny incoming
ufw default allow outgoing

# Allow public services as needed
ufw allow 18080/tcp    # Zion P2P (optional)
ufw allow 3333/tcp     # Pool (optional)
ufw allow 9735/tcp     # LND P2P (optional)

# Internal services - allow only from internal subnet/VPN
ufw allow from 172.20.0.0/16 to any port 18081 proto tcp  # Zion RPC
ufw allow from 172.20.0.0/16 to any port 8070  proto tcp  # walletd RPC
ufw allow from 172.20.0.0/16 to any port 18089 proto tcp  # RPC shim
ufw allow from 172.20.0.0/16 to any port 8080  proto tcp  # LND REST
ufw allow from 172.20.0.0/16 to any port 10009 proto tcp  # LND gRPC

ufw enable
ufw status verbose
```

## Windows (PowerShell)
```powershell
# Default inbound block remains; open only what’s needed
New-NetFirewallRule -DisplayName "Zion P2P" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 18080
New-NetFirewallRule -DisplayName "Pool Stratum" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3333
New-NetFirewallRule -DisplayName "LND P2P" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 9735

# Internal-only example (replace with your internal subnet)
New-NetFirewallRule -DisplayName "Zion RPC Internal" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 18081 -RemoteAddress 172.20.0.0/16
```

## Cloud Security Groups (AWS/Azure/GCP)
- Allow 18080/9735/3333 from 0.0.0.0/0 only if public services required
- Restrict RPC ports to VPC/VNet subnets or VPN CIDRs
- Consider WAF or reverse proxy for any exposed APIs
