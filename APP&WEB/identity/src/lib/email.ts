// E-mail verification for ZIS.
//
// Flow:
//   POST /api/auth/email/verify/request {email}  (auth) → creates a
//     VerificationToken row (SHA-256 of the raw token) and sends a mail
//     with a https://auth.zionterranova.com/api/auth/email/verify?token=
//     link via the local sendmail binary (postfix on Edge).
//   GET /api/auth/email/verify?token= → validates, sets user.email +
//     user.emailVerifiedAt, then 302-redirects back to the app.
//
// Enabled only when ZIS_EMAIL_ENABLED=1 — the route returns 503
// otherwise (mirrors the NFT-bind gating pattern).

import nodemailer, { type Transporter } from 'nodemailer';
import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 h
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 min between requests per user

export interface EmailConfig {
  enabled: boolean;
  from: string;
  sendmailPath: string;
  verifyBaseUrl: string;
  redirectUrl: string;
}

export function getEmailConfig(): EmailConfig {
  return {
    enabled: process.env.ZIS_EMAIL_ENABLED === '1',
    from: process.env.EMAIL_FROM ?? 'ZIS <no-reply@zionterranova.com>',
    sendmailPath: process.env.SENDMAIL_PATH ?? '/usr/sbin/sendmail',
    verifyBaseUrl:
      process.env.ZIS_PUBLIC_URL ?? 'https://auth.zionterranova.com',
    redirectUrl:
      process.env.EMAIL_VERIFY_REDIRECT ?? 'https://app.zionterranova.com/account',
  };
}

let transporter: Transporter | null = null;

function getTransporter(cfg: EmailConfig): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: cfg.sendmailPath,
    });
  }
  return transporter;
}

/** Injectable mail sender for tests. */
let sendMailFn: ((opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) => Promise<unknown>) | null = null;

export function setMailSender(
  fn: typeof sendMailFn,
): void {
  sendMailFn = fn;
}

export class EmailError extends Error {
  constructor(
    public code:
      | 'DISABLED'
      | 'COOLDOWN'
      | 'SEND_FAILED'
      | 'TOKEN_INVALID',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Issue a verification token for `email` and send the mail.
 * Throws EmailError(DISABLED|COOLDOWN|SEND_FAILED).
 */
export async function requestEmailVerification(
  prisma: PrismaClient,
  userId: string,
  email: string,
): Promise<void> {
  const cfg = getEmailConfig();
  if (!cfg.enabled) {
    throw new EmailError('DISABLED', 'E-mail verification is not enabled');
  }

  const recent = await prisma.verificationToken.findFirst({
    where: {
      userId,
      kind: 'email_verify',
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
  });
  if (recent) {
    throw new EmailError('COOLDOWN', 'Verification e-mail was just sent — wait a minute');
  }

  const raw = `zisv_${randomBytes(24).toString('hex')}`;
  const tokenHash = createHash('sha256').update(raw).digest('hex');
  await prisma.verificationToken.create({
    data: {
      token: tokenHash,
      userId,
      kind: 'email_verify',
      payload: email,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const link = `${cfg.verifyBaseUrl}/api/auth/email/verify?token=${raw}`;
  const send = sendMailFn ?? ((opts) => getTransporter(cfg).sendMail({ from: cfg.from, ...opts }));
  try {
    await send({
      to: email,
      subject: 'Verify your e-mail — ZION Identity',
      text: [
        'Hello,',
        '',
        'confirm this e-mail address for your ZION Identity account by opening:',
        '',
        link,
        '',
        'The link expires in 1 hour. If you did not request this, ignore the message.',
      ].join('\n'),
      html: [
        '<p>Hello,</p>',
        '<p>confirm this e-mail address for your <b>ZION Identity</b> account:</p>',
        `<p><a href="${link}">${link}</a></p>`,
        '<p>The link expires in 1 hour. If you did not request this, ignore the message.</p>',
      ].join('\n'),
    });
  } catch (err) {
    // do not leave an unusable token around
    await prisma.verificationToken.deleteMany({ where: { token: tokenHash } }).catch(() => {});
    throw new EmailError('SEND_FAILED', `Could not send e-mail: ${(err as Error).message}`);
  }
}

/**
 * Consume a raw verify token. On success returns { userId, email } and
 * marks the user e-mail as verified. Throws EmailError(TOKEN_INVALID).
 */
export async function consumeEmailVerification(
  prisma: PrismaClient,
  rawToken: string,
): Promise<{ userId: string; email: string }> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const row = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
  if (!row || row.kind !== 'email_verify' || row.expiresAt < new Date() || !row.payload) {
    throw new EmailError('TOKEN_INVALID', 'Verification link is invalid or expired');
  }
  await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
  const email = row.payload;
  await prisma.user.update({
    where: { id: row.userId },
    data: { email, emailVerifiedAt: new Date() },
  });
  return { userId: row.userId, email };
}

/** Delete expired verification tokens — called by the prune job. */
export async function pruneVerificationTokens(prisma: PrismaClient): Promise<number> {
  const res = await prisma.verificationToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}
