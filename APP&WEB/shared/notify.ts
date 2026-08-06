/**
 * ZION Cross-App Notification Dispatcher
 *
 * Central notification system that any ZION app can call to create
 * notifications for users. Notifications are stored in the shared
 * PostgreSQL database and can be retrieved by any app via the ZIS API.
 *
 * Notification types:
 *   - oasis_achievement   — OASIS game achievement unlocked
 *   - market_sale         — Marketplace item sold
 *   - market_listing      — New listing on your artifact
 *   - mining_payout       — Mining pool payout received
 *   - dao_vote            — DAO proposal you voted on has ended
 *   - bridge_complete     — Bridge transfer completed
 *   - dex_swap            — DEX swap executed
 *   - system              — System-wide announcement
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export type NotificationType =
  | 'oasis_achievement'
  | 'market_sale'
  | 'market_listing'
  | 'mining_payout'
  | 'dao_vote'
  | 'bridge_complete'
  | 'dex_swap'
  | 'system';

/**
 * Create a notification for a user.
 */
export async function notify(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data ?? undefined,
    },
  });
}

/**
 * Create notifications for multiple users (broadcast).
 */
export async function notifyMany(userIds: string[], params: Omit<CreateNotificationParams, 'userId'>) {
  const results = await Promise.allSettled(
    userIds.map((userId) => notify({ ...params, userId })),
  );
  return results.filter((r) => r.status === 'fulfilled').length;
}

/**
 * Get unread notifications for a user.
 */
export async function getUnread(userId: string) {
  return prisma.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/**
 * Mark a notification as read.
 */
export async function markRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

// ── Convenience helpers for specific notification types ───────────────

export async function notifyOasisAchievement(userId: string, achievement: string, milestone: number) {
  return notify({
    userId,
    type: 'oasis_achievement',
    title: `Achievement Unlocked: ${achievement}`,
    body: `You reached ${achievement} milestone ${milestone}! View your achievement in OASIS.`,
    data: { achievement, milestone },
  });
}

export async function notifyMarketSale(userId: string, artifactName: string, price: string, buyer: string) {
  return notify({
    userId,
    type: 'market_sale',
    title: `Item Sold: ${artifactName}`,
    body: `Your artifact "${artifactName}" was sold for ${price} to ${buyer.slice(0, 8)}...`,
    data: { artifactName, price, buyer },
  });
}

export async function notifyMiningPayout(userId: string, amount: string, txHash?: string) {
  return notify({
    userId,
    type: 'mining_payout',
    title: `Mining Payout: ${amount} ZION`,
    body: `You received a mining payout of ${amount} ZION.${txHash ? ` TX: ${txHash.slice(0, 16)}...` : ''}`,
    data: { amount, txHash },
  });
}

export async function notifyDaoVote(userId: string, proposalTitle: string, result: string) {
  return notify({
    userId,
    type: 'dao_vote',
    title: `DAO Proposal Ended: ${proposalTitle}`,
    body: `The proposal "${proposalTitle}" has ended. Result: ${result}.`,
    data: { proposalTitle, result },
  });
}

export async function notifyBridgeComplete(userId: string, amount: string, fromChain: string, toChain: string) {
  return notify({
    userId,
    type: 'bridge_complete',
    title: `Bridge Transfer Complete`,
    body: `Your ${amount} transfer from ${fromChain} to ${toChain} is complete.`,
    data: { amount, fromChain, toChain },
  });
}
