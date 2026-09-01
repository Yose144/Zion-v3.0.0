// Wallet routes — proxies wallet operations to the L2 multichain API and
// caches results in the ZIS database (Prisma).
//
// All routes (except /quote) require authentication via requireAuth.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';

const L2_API_URL = process.env.L2_MULTICHAIN_URL || 'http://127.0.0.1:8454';

// ── Schemas ────────────────────────────────────────────────────────────

const DeriveSchema = z.object({
  chain: z.string().min(1), // "base" | "bitcoin" | "zion-l1" | ...
  chainId: z.string().optional(),
  purpose: z.enum(['deposit', 'withdraw', 'linked']).default('deposit'),
});

const SwapSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.string().min(1),
  minAmountOut: z.string().optional(),
  recipient: z.string().optional(),
});

const WithdrawSchema = z.object({
  asset: z.string().min(1),
  amount: z.string().min(1),
  recipient: z.string().min(1),
});

const QuoteQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.string().min(1),
});

// ── Plugin ─────────────────────────────────────────────────────────────

export async function walletRoutes(app: FastifyInstance): Promise<void> {
  // All wallet routes require authentication. The /quote route opts out
  // below by not using the preHandler (it's public for API consistency).
  app.addHook('preHandler', requireAuth);

  // ── GET /me — full wallet snapshot ──────────────────────────────────
  app.get('/me', async (req, reply) => {
    const payload = req.user as { sub: string; addr: string };
    const token = extractToken(req);

    let l2Snapshot: any = null;
    try {
      l2Snapshot = await l2Request('GET', '/v1/wallet/me', undefined, token);
    } catch (err) {
      app.log.warn({ err }, 'L2 /v1/wallet/me failed');
    }

    // Cache balances from the snapshot if present.
    if (l2Snapshot?.balances && Array.isArray(l2Snapshot.balances)) {
      await cacheBalances(app, payload.sub, l2Snapshot.balances);
    }

    // Return the cached DB state alongside the live L2 snapshot.
    const [account, addresses, balances, orders] = await Promise.all([
      app.prisma.multichainWalletAccount.findUnique({ where: { userId: payload.sub } }),
      app.prisma.multichainWalletAddress.findMany({ where: { userId: payload.sub } }),
      app.prisma.multichainBalance.findMany({ where: { userId: payload.sub } }),
      app.prisma.multichainOrder.findMany({
        where: { userId: payload.sub },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      account,
      addresses,
      balances: balances.map((b) => ({ ...b, amount: b.amount.toString() })),
      orders: orders.map((o) => ({
        ...o,
        amountIn: o.amountIn.toString(),
        amountOut: o.amountOut?.toString() ?? null,
      })),
      l2: l2Snapshot,
    };
  });

  // ── POST /derive — derive deposit address for a chain ──────────────
  app.post('/derive', async (req, reply) => {
    const parsed = DeriveSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const payload = req.user as { sub: string };
    const token = extractToken(req);
    const { chain, chainId, purpose } = parsed.data;

    let derived: any;
    try {
      derived = await l2Request('POST', '/v1/wallet/derive', { chain, chainId }, token);
    } catch (err) {
      return reply.code(502).send(l2Error(err));
    }

    const address = derived.address ?? derived.addresses?.[0];
    if (!address) {
      return reply.code(502).send({ error: 'L2_NO_ADDRESS', message: 'L2 did not return an address' });
    }

    // Store the derived address in the DB (upsert on the unique tuple).
    const stored = await app.prisma.multichainWalletAddress.upsert({
      where: {
        userId_chain_chainId_purpose: {
          userId: payload.sub,
          chain,
          chainId: chainId ?? '',
          purpose,
        },
      },
      update: {
        address,
        publicKey: derived.publicKey ?? null,
        derivationPath: derived.derivationPath ?? null,
        isExternal: false,
        verifiedAt: new Date(),
      },
      create: {
        userId: payload.sub,
        chain,
        chainId: chainId ?? null,
        address,
        purpose,
        publicKey: derived.publicKey ?? null,
        derivationPath: derived.derivationPath ?? null,
        isExternal: false,
      },
    });

    return { address: stored, l2: derived };
  });

  // ── GET /balances — all balances ───────────────────────────────────
  app.get('/balances', async (req, reply) => {
    const payload = req.user as { sub: string };
    const token = extractToken(req);

    let l2Balances: any = null;
    try {
      l2Balances = await l2Request('POST', '/v1/wallet/balance', { all: true }, token);
    } catch (err) {
      app.log.warn({ err }, 'L2 /v1/wallet/balance failed');
    }

    if (l2Balances?.balances && Array.isArray(l2Balances.balances)) {
      await cacheBalances(app, payload.sub, l2Balances.balances);
    }

    const balances = await app.prisma.multichainBalance.findMany({
      where: { userId: payload.sub },
    });

    return {
      balances: balances.map((b) => ({ ...b, amount: b.amount.toString() })),
      l2: l2Balances,
    };
  });

  // ── POST /swap — execute DEX swap ──────────────────────────────────
  app.post('/swap', async (req, reply) => {
    const parsed = SwapSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const payload = req.user as { sub: string };
    const token = extractToken(req);
    const { from, to, amount, minAmountOut, recipient } = parsed.data;

    let result: any;
    try {
      result = await l2Request('POST', '/v1/swap/execute-v2', {
        from,
        to,
        amount,
        ...(minAmountOut ? { minAmountOut } : {}),
        ...(recipient ? { recipient } : {}),
      }, token);
    } catch (err) {
      return reply.code(502).send(l2Error(err));
    }

    // Cache the order in the DB.
    const orderId = result.orderId ?? result.order_id ?? result.id ?? result.txHash ?? `unknown-${Date.now()}`;
    const order = await app.prisma.multichainOrder.upsert({
      where: { orderId: String(orderId) },
      update: {
        fromAsset: from,
        toAsset: to,
        amountIn: BigInt(amount),
        amountOut: result.amountOut ? BigInt(result.amountOut) : null,
        status: result.status ?? 'pending',
        txHash: result.txHash ?? null,
        executedAt: result.status === 'executed' || result.status === 'confirmed' ? new Date() : null,
      },
      create: {
        userId: payload.sub,
        orderId: String(orderId),
        fromAsset: from,
        toAsset: to,
        amountIn: BigInt(amount),
        amountOut: result.amountOut ? BigInt(result.amountOut) : null,
        status: result.status ?? 'pending',
        txHash: result.txHash ?? null,
        executedAt: result.status === 'executed' || result.status === 'confirmed' ? new Date() : null,
      },
    });

    return { order, l2: result };
  });

  // ── GET /orders — order history ────────────────────────────────────
  app.get('/orders', async (req, reply) => {
    const payload = req.user as { sub: string };
    const token = extractToken(req);

    let l2Orders: any = null;
    try {
      l2Orders = await l2Request('GET', '/v1/wallet/orders', undefined, token);
    } catch (err) {
      app.log.warn({ err }, 'L2 /v1/wallet/orders failed');
    }

    // Optionally cache orders from L2.
    if (l2Orders?.orders && Array.isArray(l2Orders.orders)) {
      for (const o of l2Orders.orders) {
        const orderId = o.orderId ?? o.order_id ?? o.id;
        if (!orderId) continue;
        try {
          await app.prisma.multichainOrder.upsert({
            where: { orderId: String(orderId) },
            update: {
              fromAsset: o.fromAsset ?? o.from_asset ?? o.from ?? '',
              toAsset: o.toAsset ?? o.to_asset ?? o.to ?? '',
              amountIn: BigInt(o.amountIn ?? o.amount_in ?? 0),
              amountOut: o.amountOut != null ? BigInt(o.amountOut) : null,
              status: o.status ?? 'pending',
              txHash: o.txHash ?? o.tx_hash ?? null,
              executedAt: o.executedAt ? new Date(o.executedAt) : null,
            },
            create: {
              userId: payload.sub,
              orderId: String(orderId),
              fromAsset: o.fromAsset ?? o.from_asset ?? o.from ?? '',
              toAsset: o.toAsset ?? o.to_asset ?? o.to ?? '',
              amountIn: BigInt(o.amountIn ?? o.amount_in ?? 0),
              amountOut: o.amountOut != null ? BigInt(o.amountOut) : null,
              status: o.status ?? 'pending',
              txHash: o.txHash ?? o.tx_hash ?? null,
              executedAt: o.executedAt ? new Date(o.executedAt) : null,
            },
          });
        } catch {
          // skip individual order cache failures
        }
      }
    }

    const orders = await app.prisma.multichainOrder.findMany({
      where: { userId: payload.sub },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      orders: orders.map((o) => ({
        ...o,
        amountIn: o.amountIn.toString(),
        amountOut: o.amountOut?.toString() ?? null,
      })),
      l2: l2Orders,
    };
  });

  // ── POST /withdraw — execute withdrawal ────────────────────────────
  app.post('/withdraw', async (req, reply) => {
    const parsed = WithdrawSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const token = extractToken(req);
    const { asset, amount, recipient } = parsed.data;

    let result: any;
    try {
      result = await l2Request('POST', '/v1/wallet/withdraw', { asset, amount, recipient }, token);
    } catch (err) {
      return reply.code(502).send(l2Error(err));
    }

    return { l2: result };
  });

  // ── GET /deposits — deposit history ────────────────────────────────
  app.get('/deposits', async (req, reply) => {
    const token = extractToken(req);
    let result: any;
    try {
      result = await l2Request('GET', '/v1/wallet/deposits', undefined, token);
    } catch (err) {
      return reply.code(502).send(l2Error(err));
    }
    return { l2: result };
  });

  // ── GET /withdrawals — withdrawal history ──────────────────────────
  app.get('/withdrawals', async (req, reply) => {
    const token = extractToken(req);
    let result: any;
    try {
      result = await l2Request('GET', '/v1/wallet/withdrawals', undefined, token);
    } catch (err) {
      return reply.code(502).send(l2Error(err));
    }
    return { l2: result };
  });

  // ── GET /quote — DEX quote (public, no auth) ───────────────────────
  // Registered without the preHandler auth hook by clearing it for this route.
  app.get('/quote', { preHandler: [] }, async (req, reply) => {
    const parsed = QuoteQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { from, to, amount } = parsed.data;

    const qs = new URLSearchParams({ from, to, amount });
    let result: any;
    try {
      result = await l2Request('GET', `/v1/swap/quote?${qs.toString()}`, undefined, '');
    } catch (err) {
      return reply.code(502).send(l2Error(err));
    }
    return { l2: result };
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Extract the raw JWT token from the request (cookie or Authorization header). */
function extractToken(req: FastifyRequest): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // The signed cookie is decoded by @fastify/jwt during verification; we
  // forward the raw cookie value so L2 can re-verify if needed.
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(/zion_session=([^;]+)/);
  return match ? match[1] : '';
}

/** Make an authenticated request to the L2 multichain API. */
async function l2Request(
  method: string,
  path: string,
  body: unknown,
  userToken: string,
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userToken) {
    headers.Authorization = `Bearer ${userToken}`;
  }

  const res = await fetch(`${L2_API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'L2 request failed' }));
    throw err;
  }
  return res.json();
}

/** Normalize an L2 error into a Fastify response body. */
function l2Error(err: unknown): { error: string; message: string } {
  if (err && typeof err === 'object' && 'error' in err) {
    const e = err as { error: string; message?: string };
    return { error: e.error, message: e.message ?? 'L2 request failed' };
  }
  return { error: 'L2_ERROR', message: err instanceof Error ? err.message : 'L2 request failed' };
}

/** Cache an array of L2 balance entries into the MultichainBalance table. */
async function cacheBalances(app: FastifyInstance, userId: string, balances: any[]): Promise<void> {
  for (const b of balances) {
    const assetKey = b.assetKey ?? b.asset_key ?? b.key;
    const amount = b.amount ?? b.balance ?? '0';
    if (!assetKey) continue;
    try {
      await app.prisma.multichainBalance.upsert({
        where: { userId_assetKey: { userId, assetKey: String(assetKey) } },
        update: { amount: BigInt(amount) },
        create: { userId, assetKey: String(assetKey), amount: BigInt(amount) },
      });
    } catch {
      // skip individual balance cache failures
    }
  }
}
