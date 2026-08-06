import { prisma } from './db';

export interface TokenDistribution {
  status: 'pending' | 'distributed';
  tokens: number;
  txHash?: string;
  distributedAt?: string;
  customerEmail?: string;
}

export function tokenSettingKey(orderId: string): string {
  return `tokens:${orderId}`;
}

export async function getTokenDistribution(orderId: string): Promise<TokenDistribution | null> {
  const setting = await prisma.shopSetting.findUnique({
    where: { key: tokenSettingKey(orderId) },
  });
  if (!setting) return null;
  try {
    return JSON.parse(setting.value) as TokenDistribution;
  } catch {
    return null;
  }
}

export async function recordTokenDistribution(
  orderId: string,
  tokens: number,
  customerEmail: string,
  txHash?: string
): Promise<TokenDistribution> {
  const distribution: TokenDistribution = {
    status: 'distributed',
    tokens,
    txHash: txHash?.trim() || 'pending',
    distributedAt: new Date().toISOString(),
    customerEmail,
  };

  await prisma.shopSetting.upsert({
    where: { key: tokenSettingKey(orderId) },
    update: { value: JSON.stringify(distribution) },
    create: { key: tokenSettingKey(orderId), value: JSON.stringify(distribution) },
  });

  return distribution;
}

export async function isTokenDistributed(orderId: string): Promise<boolean> {
  const dist = await getTokenDistribution(orderId);
  return dist?.status === 'distributed';
}
