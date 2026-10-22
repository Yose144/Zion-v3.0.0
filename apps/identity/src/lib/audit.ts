// AuthEvent audit log — security-relevant events written to Postgres.
//
// Writes are fire-and-forget safe: audit failure must never break the
// auth flow, so callers `await audit(...).catch(() => {})` or use the
// non-blocking `auditBg` variant.

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export type AuditKind =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'link'
  | 'unlink'
  | 'primary_change'
  | 'session_revoke'
  | 'apikey_create'
  | 'apikey_revoke'
  | 'apikey_verify'
  | 'passkey_add'
  | 'passkey_remove'
  | 'account_delete'
  | 'email_verify_request'
  | 'email_verify'
  | 'admin_role_change'
  | 'admin_user_delete'
  | 'notification_push';

export interface AuditInput {
  kind: AuditKind;
  userId?: string | null;
  address?: string | null;
  chainType?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}

export async function audit(
  prisma: PrismaClient,
  input: AuditInput,
): Promise<void> {
  await prisma.authEvent.create({
    data: {
      kind: input.kind,
      userId: input.userId ?? null,
      address: input.address ?? null,
      chainType: input.chainType ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      meta: (input.meta ?? undefined) as never,
    },
  });
}

/** Audit with request context (ip + user-agent) filled in. */
export function auditReq(
  app: FastifyInstance,
  req: FastifyRequest,
  input: Omit<AuditInput, 'ip' | 'userAgent'>,
): Promise<void> {
  return audit(app.prisma, {
    ...input,
    ip: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
  });
}

/** Fire-and-forget variant — logs failures through the app logger. */
export function auditBg(
  app: FastifyInstance,
  req: FastifyRequest | null,
  input: Omit<AuditInput, 'ip' | 'userAgent'>,
): void {
  const p = req
    ? auditReq(app, req, input)
    : audit(app.prisma, input);
  p.catch((err) => app.log.warn({ err }, 'audit write failed'));
}

/** Delete audit events older than `days` — called by the prune job. */
export async function pruneAuthEvents(prisma: PrismaClient, days = 180): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await prisma.authEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return res.count;
}
