# ZION Presale API Documentation

Version: 2.9.0  
Author: ZION Team  
Created: 2025-01-18

## Overview

Complete Python-based presale backend for ZION cryptocurrency presale campaign. Migrated from PHP to FastAPI with improved security, type safety, and integration with ZION blockchain.

**Total Presale Allocation:** 500,000,000 ZION (3.1% of max supply)

## Architecture

### Components

1. **presale_config.py** - Phase configuration, pricing, unlock schedule
2. **presale_db.py** - SQLite database schema and migrations
3. **presale_wallet.py** - Wallet generation, encryption (AES-256-GCM), QR codes
4. **presale_endpoints.py** - FastAPI REST API endpoints
5. **test_presale_flow.py** - Complete flow integration tests

### Database Schema

**Tables:**
- `presale_phases` - Phase configuration (3 phases)
- `presale_orders` - Customer orders with payment tracking
- `presale_wallets` - Generated wallets with encrypted private keys
- `presale_payments` - Payment event log (Stripe webhooks)
- `presale_distributions` - MainNet distribution tracking (Dec 31, 2026)
- `presale_analytics` - Real-time statistics
- `presale_metadata` - Schema version and config

## Presale Phases

### Phase 1: Early Bird Phase
- **Price:** €0.008 per ZION
- **Allocation:** 150,000,000 ZION
- **Bonus:** 50%
- **Period:** Q1 2025 (Jan - Mar 2025)

### Phase 2: Builder Phase
- **Price:** €0.010 per ZION
- **Allocation:** 200,000,000 ZION
- **Bonus:** 25%
- **Period:** Q2 2025 (Apr - Jun 2025)

### Phase 3: Final Phase
- **Price:** €0.012 per ZION
- **Allocation:** 150,000,000 ZION
- **Bonus:** 10%
- **Period:** Q3 2025 (Jul - Sep 2025)

**Launch Price (DEX/CEX):** €0.015 (Dec 31, 2026)

## Token Unlock Schedule

Tokens are distributed in 4 phases after MainNet launch:

1. **MainNet Launch (Dec 31, 2026):** 40% of purchased tokens
2. **Q1 2027 (Mar 31, 2027):** +20% of purchased tokens
3. **Q2 2027 (Jun 30, 2027):** +20% of purchased tokens
4. **Q3 2027 (Sep 30, 2027):** +20% of purchased tokens (final)

## API Endpoints

Base URL: `https://api.terranova.one` (production)  
Base URL: `http://localhost:8000` (development)

### 1. Get Presale Status

**GET** `/presale/status`

Returns current presale statistics, active phase, and unlock schedule.

**Response:**
```json
{
  "success": true,
  "presale": {
    "total_allocation": 500000000,
    "total_sold": 0,
    "total_remaining": 500000000,
    "sold_percentage": 0.0,
    "current_phase": 1,
    "current_phase_name": "Early Bird Phase",
    "current_price_eur": "0.008",
    "current_bonus": 50,
    "launch_price_eur": "0.015",
    "phases": [
      {
        "phase": 1,
        "name": "Early Bird Phase",
        "price_eur": "0.008",
        "allocation": 150000000,
        "sold": 0,
        "remaining": 150000000,
        "bonus_percent": 50,
        "is_active": true,
        "sold_percentage": 0.0
      }
    ]
  },
  "current_phase": {
    "phase_number": 1,
    "name": "Early Bird Phase",
    "price_eur": "0.008",
    "bonus_percent": 50,
    "allocation": 150000000,
    "sold": 0,
    "remaining": 150000000,
    "sold_percentage": 0.0,
    "is_active": true,
    "start_date": null,
    "end_date": "2026-03-31T00:00:00"
  },
  "unlock_schedule": [
    {
      "name": "mainnet_launch",
      "percentage": 40,
      "unlock_date": "2026-12-31T00:00:00",
      "description": "MainNet Launch - Initial unlock (40%)"
    }
  ]
}
```

---

### 2. Initialize Purchase

**POST** `/presale/purchase/init`

Creates new presale order and Stripe checkout session.

**Request Body:**
```json
{
  "email": "buyer@example.com",
  "amount_eur": 1000.00,
  "phase_number": 1  // Optional, auto-detects current phase
}
```

**Validation:**
- Email must be valid (RFC 5322)
- Amount must be €50 - €100,000
- Phase must be active

**Response:**
```json
{
  "success": true,
  "order_id": "PRESALE-20250118123456-a1b2c3d4",
  "stripe_session_id": "cs_test_...",
  "stripe_url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "tokens_allocated": {
    "base": 125000,
    "bonus": 62500,
    "total": 187500
  },
  "phase": {
    "number": 1,
    "name": "Early Bird Phase",
    "price_eur": "0.008",
    "bonus_percent": 50
  }
}
```

**Error Responses:**
- `400` - Invalid email, amount, or inactive phase
- `500` - Server error (database, Stripe API)

---

### 3. Stripe Webhook

**POST** `/presale/webhook/stripe`

Handles Stripe payment confirmation webhooks. **CRITICAL:** Must verify signature.

**Headers:**
- `Stripe-Signature` - Webhook signature (verified against `STRIPE_WEBHOOK_SECRET`)

**Events Handled:**
- `checkout.session.completed` - Payment successful
- `payment_intent.succeeded` - Payment confirmed
- `payment_intent.payment_failed` - Payment failed

**Response:**
```json
{
  "received": true,
  "order_id": "PRESALE-20250118123456-a1b2c3d4",
  "status": "paid"
}
```

**Security:**
1. Signature verification using `stripe.Webhook.construct_event()`
2. Returns `400` on invalid signature
3. Always returns `200` to Stripe (prevents retries)

---

### 4. Get Order Status

**GET** `/presale/order/{order_id}`

Retrieves order details, wallet info, and payment status.

**Path Parameters:**
- `order_id` - Order ID (format: `PRESALE-YYYYMMDDHHMMSS-xxxxx`)

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "PRESALE-20250118123456-a1b2c3d4",
    "customer_email": "buyer@example.com",
    "phase_name": "Early Bird Phase",
    "price_eur": 1000.0,
    "base_tokens": 125000,
    "bonus_tokens": 62500,
    "total_tokens": 187500,
    "payment_status": "paid",
    "distribution_status": "ready",
    "created_at": "2025-01-18T12:34:56"
  },
  "wallet": {
    "wallet_id": "WALLET-A1B2C3D4E5F6G7H8",
    "public_address": "ZION_1abc2def3...",
    "qr_image_path": "data/presale_qr_codes/PRESALE-20250118123456-a1b2c3d4.png",
    "allocated_tokens": 187500,
    "status": "active",
    "activated_at": "2025-01-18T12:35:30",
    "expires_at": "2025-02-17T12:34:56"
  },
  "payment": {
    "payment_provider": "stripe",
    "transaction_id": "pi_abc123...",
    "amount": 1000.0,
    "status": "completed",
    "webhook_received_at": "2025-01-18T12:35:20",
    "created_at": "2025-01-18T12:35:20"
  }
}
```

**Error Responses:**
- `404` - Order not found
- `500` - Database error

---

### 5. Admin Statistics

**GET** `/presale/stats/admin`

Returns detailed presale analytics for admin dashboard.

**Response:**
```json
{
  "success": true,
  "analytics": {
    "total_orders": 42,
    "total_revenue_eur": 125000,
    "total_tokens_sold": 18750000,
    "active_wallets": 42,
    "pending_distributions": 42
  },
  "recent_orders": [
    {
      "order_id": "PRESALE-20250118123456-a1b2c3d4",
      "customer_email": "buyer@example.com",
      "total_tokens": 187500,
      "price_eur": 1000.0,
      "payment_status": "paid",
      "created_at": "2025-01-18T12:34:56"
    }
  ],
  "phase_stats": [
    {
      "phase_number": 1,
      "name": "Early Bird Phase",
      "allocation": 150000000,
      "sold": 18750000,
      "sold_percentage": 12.5
    }
  ]
}
```

## Security

### Wallet Encryption

Private keys encrypted using **AES-256-GCM**:
- Random 96-bit nonce per encryption
- Master key stored in `data/presale_encryption_key.bin`
- **CRITICAL:** Backup master key file!

### Stripe Integration

1. **Webhook Signature Verification:**
   ```python
   event = stripe.Webhook.construct_event(
       payload, sig_header, STRIPE_WEBHOOK_SECRET
   )
   ```

2. **Environment Variables:**
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_SUCCESS_URL=https://terranova.one/presale/success
   STRIPE_CANCEL_URL=https://terranova.one/presale/cancel
   ```

### Rate Limiting

- **Recommended:** 10 requests/minute per IP for `/purchase/init`
- **Recommended:** No limit for `/webhook/stripe` (Stripe retries)

## Testing

### Run Complete Flow Test

```bash
python tests/test_presale_flow.py
```

**Test Coverage:**
1. ✅ Presale configuration validation
2. ✅ Database creation (7 tables)
3. ✅ Order creation (pending → paid)
4. ✅ Payment confirmation (Stripe webhook simulation)
5. ✅ Wallet generation (encryption + QR code)
6. ✅ Unlock schedule calculation
7. ✅ Order query with wallet details

### Manual Testing with cURL

```bash
# Get presale status
curl -X GET http://localhost:8000/presale/status

# Initialize purchase
curl -X POST http://localhost:8000/presale/purchase/init \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "amount_eur": 1000,
    "phase_number": 1
  }'

# Get order status
curl -X GET http://localhost:8000/presale/order/PRESALE-20250118123456-a1b2c3d4
```

## Deployment

### Environment Setup

```bash
# Create .env file
cat > .env << EOF
PRESALE_DB_PATH=data/presale.db
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_SUCCESS_URL=https://terranova.one/presale/success
STRIPE_CANCEL_URL=https://terranova.one/presale/cancel
EOF
```

### Database Initialization

```python
from core.presale_db import init_presale_db

# Initialize database with schema
db = init_presale_db("data/presale.db")
```

### FastAPI Integration

```python
from fastapi import FastAPI
from api.presale_endpoints import get_presale_router

app = FastAPI(title="ZION API")

# Add presale router
app.include_router(get_presale_router())

# Run server
# uvicorn main:app --host 0.0.0.0 --port 8000
```

### Stripe Webhook Configuration

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.terranova.one/presale/webhook/stripe`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook secret → `STRIPE_WEBHOOK_SECRET`

## Migration from PHP

Replaced PHP presale system (`api/presale/` folder) with Python implementation:

**PHP Components Migrated:**
- ✅ `stripe-webhook.php` → `presale_endpoints.py::stripe_webhook()`
- ✅ `create-order.php` → `presale_endpoints.py::init_purchase()`
- ✅ `wallet-qr.php` → `presale_wallet.py::generate_qr_code()`
- ✅ `schema.sql` (MySQL) → `presale_db.py` (SQLite)
- ✅ Encryption → Upgraded from AES-256-CBC to AES-256-GCM

**Benefits:**
- Type safety (Pydantic models)
- Better error handling (HTTPException)
- Integrated testing (pytest)
- Blockchain integration ready

## Troubleshooting

### "No active presale phase"

**Cause:** Current date outside phase date ranges.

**Solution:** Update `presale_config.py` phase dates:
```python
PRESALE_PHASES = [
    PresalePhase(
        phase_number=1,
        start_date=None,  # Active immediately
        end_date=datetime(2026, 3, 31)
    )
]
```

### "Insufficient tokens in Phase X"

**Cause:** Phase sold out or purchase exceeds remaining allocation.

**Solution:** Check phase stats with `/presale/status`, reduce purchase amount, or wait for next phase.

### Stripe webhook signature verification failed

**Cause:** Invalid `STRIPE_WEBHOOK_SECRET` or modified payload.

**Solution:**
1. Verify webhook secret from Stripe Dashboard
2. Use raw request body (no JSON parsing before verification)
3. Check Stripe API version compatibility

### Wallet encryption key missing

**Cause:** `data/presale_encryption_key.bin` deleted or not backed up.

**Solution:**
1. If testing: Delete `data/presale.db` and regenerate
2. If production: **RESTORE FROM BACKUP IMMEDIATELY**
3. Without key: encrypted private keys are **permanently lost**

## Maintenance

### Backup Checklist

**Daily:**
- ✅ `data/presale.db` (SQLite database)
- ✅ `data/presale_encryption_key.bin` (CRITICAL!)
- ✅ `data/presale_qr_codes/` (QR code images)

**Before MainNet Distribution (Dec 31, 2026):**
- ✅ Export all orders: `SELECT * FROM presale_orders WHERE payment_status='paid'`
- ✅ Export all wallets: `SELECT * FROM presale_wallets WHERE status='active'`
- ✅ Verify total tokens sold matches blockchain allocation

### Analytics Queries

```sql
-- Total revenue
SELECT SUM(price_eur) FROM presale_orders WHERE payment_status='paid';

-- Tokens sold by phase
SELECT p.name, SUM(o.total_tokens) 
FROM presale_orders o 
JOIN presale_phases p ON o.phase_id = p.id 
WHERE o.payment_status='paid'
GROUP BY p.name;

-- Top buyers
SELECT customer_email, SUM(total_tokens) as tokens, SUM(price_eur) as spent
FROM presale_orders 
WHERE payment_status='paid'
GROUP BY customer_email
ORDER BY tokens DESC
LIMIT 10;
```

## Support

**Documentation:** `docs/PRESALE_API.md` (this file)  
**Tests:** `tests/test_presale_flow.py`  
**Issues:** GitHub Issues or contact dev team  

---

**Last Updated:** 2025-01-18  
**Version:** 2.9.0  
**Status:** ✅ Production Ready
