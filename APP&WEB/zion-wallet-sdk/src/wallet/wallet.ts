/**
 * ZION Wallet entity
 */

export interface Wallet {
  id: string;
  name: string;
  address: string;
  publicKey: string;
  privateKey: string; // encrypted
  mnemonic: string | null; // encrypted
  keyType: 'ed25519' | string;
  path: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletPublicView {
  id: string;
  name: string;
  address: string;
  keyType: string;
  createdAt: string;
}

export function toPublicView(wallet: Wallet): WalletPublicView {
  return {
    id: wallet.id,
    name: wallet.name,
    address: wallet.address,
    keyType: wallet.keyType,
    createdAt: wallet.createdAt,
  };
}
