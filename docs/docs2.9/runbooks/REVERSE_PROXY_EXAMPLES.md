# Reverse Proxy Examples (Nginx, Caddy)

Securely expose internal services (wallet-adapter, LND REST) with TLS and allowlists.

## Nginx (TLS, allowlist, auth header)
```nginx
server {
  listen 443 ssl http2;
  server_name adapter.example.com;
  ssl_certificate     /etc/letsencrypt/live/adapter.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/adapter.example.com/privkey.pem;

  # Allowlist example
  allow 1.2.3.4/32;    # office
  allow 5.6.7.0/24;    # VPN subnet
  deny all;

  location / {
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
    # Inject API key header so clients don’t see it
    proxy_set_header X-API-KEY $ADAPTER_API_KEY;
    proxy_pass http://zion-wallet-adapter:18099;
  }
}
```

## Caddy (automatic TLS)
```caddy
adapter.example.com {
  encode zstd gzip
  @allow {
    remote_ip 1.2.3.4/32
    remote_ip 5.6.7.0/24
  }
  respond "Forbidden" 403 {
    not @allow
  }
  reverse_proxy zion-wallet-adapter:18099 {
    header_up X-API-KEY {env.ADAPTER_API_KEY}
  }
}
```

Notes:
- Keep API keys in the proxy environment, not in the client/browser
- Consider basic auth, mTLS, or OAuth-aware proxy for additional protection
