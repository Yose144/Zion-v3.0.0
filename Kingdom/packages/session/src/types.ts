/**
 * Typy ZIS — jediná definice toho, co ZION Identity Service vrací.
 *
 * Zdroj pravdy: `apps/identity/src/routes/*.ts`. Když se změní odpověď,
 * změní se tady a TypeScript to rozbije všude, kde se čte.
 */

export type ZisChainType = 'zion-l1' | 'evm' | 'quantus' | 'pearl' | 'solana';

export interface ZisChallenge {
  challenge: string;
  chainType: ZisChainType;
  expiresInMs: number;
}

export interface ZisLinkedAddress {
  id: string;
  address: string;
  chainType: ZisChainType;
  primary?: boolean;
}

export interface ZisOasisPlayer {
  id: string;
  address: string;
  displayName?: string | null;
}

export interface ZisUser {
  id: string;
  displayName?: string | null;
  email?: string | null;
  emailVerifiedAt?: string | null;
  avatar?: string | null;
  primaryAddress?: string | null;
  linkedAddresses?: ZisLinkedAddress[];
  oasisPlayer?: ZisOasisPlayer | null;
  createdAt?: string;
}

export interface ZisSession {
  token: string;
  user: {
    id: string;
    primaryAddress: string;
    displayName?: string | null;
  };
  expiresAt: string;
}

export interface ZisActiveSession {
  id: string;
  jwtJti: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  current?: boolean;
}

/** Výsledek ověření Ed25519 podpisu v prohlížeči. */
export interface ZisSignature {
  address: string;
  publicKey: string;
  signature: string;
}
