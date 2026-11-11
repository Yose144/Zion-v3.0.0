import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import { getArchivePassForOrder } from '@/lib/archive-pass';
import { getTokenDistribution } from '@/lib/tokens';
import GiftReveal from '@/components/gift/GiftReveal';

type Params = Promise<{ token: string }>;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Váš dárek | ZION Market',
    robots: { index: false, follow: false },
  };
}

const BOOK_IDS = new Set(['book-001', 'gift-book']);

function bookUrlFromItems(items: unknown): string | null {
  if (!Array.isArray(items)) return null;
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const line = it as { externalId?: string; filesUrl?: string };
    if (line.externalId && BOOK_IDS.has(line.externalId) && line.filesUrl) {
      return line.filesUrl;
    }
  }
  return null;
}

export default async function GiftPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();

  const order = await prisma.shopOrder.findFirst({
    where: { giftClaimToken: token, payment: 'admin-gift' },
    select: {
      orderId: true,
      customerName: true,
      zionTokens: true,
      customerWalletAddress: true,
      customerWalletSeed: true,
      items: true,
    },
  });
  if (!order) notFound();

  let seed: string | null = null;
  if (order.customerWalletSeed) {
    try {
      seed = decryptSecret(order.customerWalletSeed);
    } catch {
      seed = null;
    }
  }

  const pass = getArchivePassForOrder(order.orderId);
  const dist = await getTokenDistribution(order.orderId);

  return (
    <GiftReveal
      data={{
        orderId: order.orderId,
        customerName: order.customerName,
        amountZion: order.zionTokens,
        walletAddress: order.customerWalletAddress,
        seed,
        passCode: pass?.code ?? null,
        bookUrl: bookUrlFromItems(order.items),
        bonusTxHash: dist?.txHash ?? null,
      }}
    />
  );
}
