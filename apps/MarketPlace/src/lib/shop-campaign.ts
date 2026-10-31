import { prisma } from './db';

/**
 * Time-boxed ZION token campaigns — an overlay on top of the catalog's
 * base `tokens` value, stored in ShopSetting so a promo expires
 * automatically without reverting any product data.
 *
 * Storage: ShopSetting key `campaign:<externalId>`
 * Value:   {"tokens":144000,"endsAt":"2026-12-24T23:59:59+01:00","label":"🛡️ Genesis Guardian"}
 *
 * While now <= endsAt the campaign tokens replace product.tokens for
 * order computation AND product display; after expiry the catalog's
 * base value applies again with zero ops work.
 */

export const TOKEN_CAMPAIGN_PREFIX = 'campaign:';

export interface TokenCampaign {
  tokens: number;
  endsAt: string;
  label?: string;
}

export function parseTokenCampaign(value: string): TokenCampaign | null {
  try {
    const c = JSON.parse(value) as Partial<TokenCampaign>;
    if (!Number.isFinite(c.tokens) || typeof c.endsAt !== 'string') return null;
    if (Number.isNaN(Date.parse(c.endsAt))) return null;
    return { tokens: Math.round(c.tokens as number), endsAt: c.endsAt, label: c.label };
  } catch {
    return null;
  }
}

/** Map of externalId -> active campaign token bonus (one DB round-trip). */
export async function getActiveTokenCampaigns(now = new Date()): Promise<Record<string, number>> {
  const rows = await prisma.shopSetting.findMany({
    where: { key: { startsWith: TOKEN_CAMPAIGN_PREFIX } },
    select: { key: true, value: true },
  });
  const active: Record<string, number> = {};
  for (const row of rows) {
    const c = parseTokenCampaign(row.value);
    if (c && Date.parse(c.endsAt) > now.getTime()) {
      active[row.key.slice(TOKEN_CAMPAIGN_PREFIX.length)] = c.tokens;
    }
  }
  return active;
}

/** Effective token bonus for a product inside an active campaign. */
export function campaignTokens(
  campaigns: Record<string, number>,
  externalId: string,
  baseTokens: number,
): number {
  return campaigns[externalId] ?? baseTokens;
}
