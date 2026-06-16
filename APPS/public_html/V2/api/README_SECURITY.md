# ZION eShop Security Update (2025-12-29)

## Authentication System
The admin dashboard and related API endpoints have been secured with a new authentication system.

### Key Changes
1.  **Bcrypt Hashing**: The admin password is no longer stored in plain text or weak MD5. It is hashed using Bcrypt.
2.  **Session Management**: Authentication uses PHP sessions instead of passing tokens in URL parameters.
3.  **CSRF Protection**: Login forms are protected against CSRF attacks.
4.  **Centralized Auth**: All admin endpoints use `auth.php` for verification.

### Configuration
The admin password hash is stored in `.env`:
```dotenv
ADMIN_PASSWORD_HASH=$2b$12$...
```

To change the password:
1.  Generate a new Bcrypt hash (using Python or PHP).
2.  Update `ADMIN_PASSWORD_HASH` in `.env`.

### Secured Endpoints
- `admin-dashboard.php`
- `admin-dashboard-v2.php`
- `orders-dashboard.php`
- `admin-orders.php`
- `accounting-invoices.php`
- `mainnet-payout-system.php`
- `presale-stats.php`
- `wallet-ledger.php`

### Usage
Access any of the dashboards. If not logged in, you will be redirected to `admin-login.php`.
After logging in, you will have access to all secured areas for the duration of the session.
