# ZIS Agent Sub-Accounts — design draft (N1, 3.B-series)

**Status:** design + migration draft (checklist 🤖 item) — not deployed.
**Date:** 2026-10-31
**Mitigates:** F-1 (withdraw without step-up), F-6 (API keys without
scope/expiry) from `ZIS_THREAT_MODEL_PRIVACY.md`.

## 1. Goal

Today every credential is all-powerful: `ApiKey` rows are just
`keyHash + label` — a leaked `zis_…` key is a **full account**
(read, trade, pool binding, anything a session can do). Agent
sub-accounts are scoped, budget-capped, expiring bearer credentials
for non-human actors (Hiran/NCL agents, desktop agent, trading bots,
miner ops scripts) acting *on behalf of* a user — never as the user.

Principles:

- **Narrowest scope** — an agent credential carries named scopes; no
  scope ⇒ denied. `wallet:withdraw` is **never** issuable to an agent
  (withdrawals stay session+step-up, per F-1).
- **Hard budgets** — spending caps enforced atomically in the DB, not
  by trusting the caller. Budget exhaustion = hard deny + audit event.
- **Bounded lifetime** — `expiresAt` mandatory; no permanent agent keys.
- **Full audit** — every create/use/revoke/budget-deny lands in
  `AuthEvent` (survives user deletion per existing convention).

## 2. Schema draft (`apps/shared/prisma/schema.prisma` — additive)

```prisma
model AgentSubAccount {
  id         String    @id @default(cuid())
  userId     String
  name       String    // "hiran-trader" | "desktop-agent" | "ops-bot"
  keyHash    String    @unique  // SHA256 of bearer `zag_<48 hex>`
  keyPrefix  String    // first 10 chars — display/identification only
  scopes     String[]  // "read" | "trade" | "mining" | "oasis:act" | …
  expiresAt  DateTime
  revokedAt  DateTime?
  lastUsedAt DateTime?
  lastUsedIp String?
  createdAt  DateTime  @default(now())

  user    User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  budgets AgentBudget[]

  @@index([userId])
  @@index([expiresAt])
}

// Per-currency, per-window caps. `spentUnits` resets when `periodStart`
// rolls past the window (daily/weekly) via the spend path itself —
// lazy rollover, no cron dependency.
model AgentBudget {
  id          String   @id @default(cuid())
  agentId     String
  currency    String   // "ZION" | "QTC" | "PRL" | "USD-EQ"
  period      String   // "daily" | "weekly" | "total"
  limitUnits  BigInt   // smallest currency unit
  spentUnits  BigInt   @default(0)
  periodStart DateTime @default(now())
  updatedAt   DateTime @updatedAt

  agent AgentSubAccount @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([agentId, currency, period])
}
```

`User` gains `agentSubAccounts AgentSubAccount[]` (back-relation only).

## 3. API draft

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/agents` | session (step-up: fresh challenge or passkey UV) | create agent → returns `zag_…` once, like `ApiKey` |
| `GET /api/agents` | session | list (prefix, scopes, budgets, usage, expiry) |
| `PATCH /api/agents/:id` | session | adjust budgets/scopes — **tightening only without step-up** |
| `DELETE /api/agents/:id` | session | revoke (sets `revokedAt`) |
| `POST /api/keys/verify` | service | extended response: `agent: {id, scopes, budgets}` when the bearer is `zag_…` — services enforce scope locally |

Bearer format `zag_` + 48 hex (distinct from `zis_` full keys — cheap
to classify at verify time by prefix).

## 4. Budget enforcement — atomic, race-free

Spend path (called by the spending service after verifying scope):

```ts
// Inside a transaction. Conditional update = no read-modify-write race:
// the row only increments when headroom remains.
const res = await prisma.agentBudget.updateMany({
  where: {
    agentId, currency, period,
    spentUnits: { lte: { decrement: amount } as never }, // see note
  },
  data: { spentUnits: { increment: amount } },
});
if (res.count === 0) throw new BudgetExceeded(); // hard deny + audit
```

Prisma can't express `spentUnits + amount <= limitUnits` in a `where`
clause directly — the honest formulation is raw SQL
(`UPDATE … SET spent = spent + $1 WHERE … AND spent + $1 <= cap`),
or a two-step `serializable` tx guarded by a re-read. The migration
draft below uses the SQL conditional — one round-trip, no locking.

Lazy rollover: when `periodStart` is older than the window, the same
`UPDATE` additionally sets `periodStart = now(), spentUnits = amount`.

## 5. Scope semantics (draft)

| Scope | Allows | Explicitly not |
|---|---|---|
| `read` | balances, orders, profile, mining stats | any write |
| `trade` | `POST /api/wallet/swap`, order create/cancel | withdraw, deposits addresses changes |
| `mining` | pool-bound miner ops (register payout binding *to already-proven addresses*), stats writes | new payout addresses |
| `oasis:act` | OASIS in-world actions | marketplace purchase (needs `trade`) |
| ~~`wallet:withdraw`~~ | — | **never issuable** (F-1) |

Service-side enforcement is mandatory — ZIS verifies the key and
*reports* scope; each service must check the required scope locally
(same trust model as today's `x-service-key`).

## 6. Migration draft

```sql
CREATE TABLE "AgentSubAccount" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL UNIQUE,
  "keyPrefix" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "lastUsedIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "AgentSubAccount_userId_idx" ON "AgentSubAccount"("userId");
CREATE INDEX "AgentSubAccount_expiresAt_idx" ON "AgentSubAccount"("expiresAt");

CREATE TABLE "AgentBudget" (
  "id" TEXT PRIMARY KEY,
  "agentId" TEXT NOT NULL REFERENCES "AgentSubAccount"("id") ON DELETE CASCADE,
  "currency" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "limitUnits" BIGINT NOT NULL,
  "spentUnits" BIGINT NOT NULL DEFAULT 0,
  "periodStart" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("agentId", "currency", "period")
);
```

Additive, zero-touch on existing rows — safe for `prisma db push`.

## 7. Rollout gates

1. Schema + routes behind `ZIS_AGENTS_ENABLED` (default off until UI).
2. `/api/keys/verify` extension is additive — old consumers ignore the
   `agent` field; new consumers must deny unknown scopes.
3. Wallet routes check `agent.scopes` before any mutation; `withdraw`
   rejects `zag_` tokens outright.
4. First agent: desktop-agent read+mining (dogfood), then Hiran.

## 8. Open questions (👤/design review)

- Per-agent linked-address pinning (agent may act only *for* a
  whitelisted address subset)?
- Budget denomination: per-currency only, or USD-EQ aggregate cap
  (needs an oracle — defer)?
- Do agents get OASIS player identity of their own (attribution in
  world) or always "user via agent"?
