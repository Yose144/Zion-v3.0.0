// Agent sub-accounts — scoped, budget-capped, expiring bearer credentials
// for non-human actors (design: docs/3.2/ZIS_AGENT_SUBACCOUNTS_DESIGN.md).
//
// Bearer format `zag_<48 hex>` — cheap to classify at verify time by prefix,
// distinct from `zis_` full-account keys. `wallet:withdraw` is never
// issuable: withdrawals stay session+step-up (threat model F-1).

import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export const AGENT_KEY_PREFIX = 'zag_';
export const AGENT_KEY_PREFIX_LEN = 10; // "zag_" + 6 hex chars, display only

/** Scopes an agent credential may carry. `wallet:withdraw` is absent on purpose. */
export const AGENT_SCOPES = ['read', 'trade', 'mining', 'oasis:act'] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

export const AGENT_BUDGET_PERIODS = ['daily', 'weekly', 'total'] as const;
export type AgentBudgetPeriod = (typeof AGENT_BUDGET_PERIODS)[number];

/** CRUD routes stay dark until UI + step-up flow lands (design §7 gate 1). */
export function agentsEnabled(): boolean {
  return process.env.ZIS_AGENTS_ENABLED === '1' || process.env.ZIS_AGENTS_ENABLED === 'true';
}

export function generateAgentKey(): { raw: string; keyHash: string; keyPrefix: string } {
  const raw = `${AGENT_KEY_PREFIX}${randomBytes(24).toString('hex')}`; // zag_ + 48 hex
  return {
    raw,
    keyHash: createHash('sha256').update(raw).digest('hex'),
    keyPrefix: raw.slice(0, AGENT_KEY_PREFIX_LEN),
  };
}

export function isAgentKey(raw: string): boolean {
  return raw.startsWith(AGENT_KEY_PREFIX);
}

export function agentKeyHash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function assertValidScopes(scopes: string[]): scopes is AgentScope[] {
  return scopes.length > 0 && scopes.every((s) => (AGENT_SCOPES as readonly string[]).includes(s));
}

export class BudgetExceededError extends Error {
  constructor(public readonly currency: string) {
    super(`agent budget exceeded for ${currency}`);
    this.name = 'BudgetExceededError';
  }
}

const WINDOW_MS: Record<Exclude<AgentBudgetPeriod, 'total'>, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Atomically charge `amount` (smallest currency unit) against an agent's
 * budget. One conditional UPDATE — no read-modify-write race:
 *
 *  - fresh window (`periodStart` within the period): allowed only when
 *    `spentUnits + amount <= limitUnits`;
 *  - stale window: lazy rollover — `spentUnits` resets to `amount` and
 *    `periodStart` to now() in the same statement;
 *  - `total` never rolls over.
 *
 * Returns true when the charge succeeded; false = hard deny (caller audits).
 */
export async function chargeAgentBudget(
  prisma: PrismaClient,
  agentId: string,
  currency: string,
  period: AgentBudgetPeriod,
  amount: bigint,
): Promise<boolean> {
  if (amount <= 0n) return true;
  const windowMs = period === 'total' ? null : WINDOW_MS[period];
  const staleBefore = windowMs === null ? null : new Date(Date.now() - windowMs);

  // $queryRaw: single statement, conditional — the row updates only when
  // headroom remains (fresh window) or the window has rolled (stale).
  const updated = await prisma.$executeRaw`
    UPDATE "AgentBudget"
    SET "spentUnits" = CASE
          WHEN "periodStart" < ${staleBefore}::timestamp THEN ${amount}::bigint
          ELSE "spentUnits" + ${amount}::bigint
        END,
        "periodStart" = CASE
          WHEN "periodStart" < ${staleBefore}::timestamp THEN now()
          ELSE "periodStart"
        END,
        "updatedAt" = now()
    WHERE "agentId" = ${agentId}
      AND "currency" = ${currency}
      AND "period" = ${period}
      AND (
        (${staleBefore}::timestamp IS NOT NULL AND "periodStart" < ${staleBefore}::timestamp)
        OR "spentUnits" + ${amount}::bigint <= "limitUnits"
      )
  `;
  return updated === 1;
}
