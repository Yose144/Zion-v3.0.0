/**
 * EVM Wallet
 * Thin wrapper around ethers v6 Wallet + JsonRpcProvider for EVM chains.
 */

import {
  Wallet,
  JsonRpcProvider,
  HDNodeWallet,
  Mnemonic,
  Contract,
  formatUnits,
  getAddress,
} from 'ethers';

// Minimal ERC-20 ABI (balanceOf + transfer).
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

export class EvmWallet {
  private wallet: Wallet;

  private constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  /** Derive an EVM wallet from a BIP39 mnemonic and a derivation path. */
  static fromMnemonic(mnemonic: string, path: string, rpcUrl: string): EvmWallet {
    const provider = new JsonRpcProvider(rpcUrl);
    const hd = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic.trim()), path);
    const wallet = new Wallet(hd.privateKey, provider);
    return new EvmWallet(wallet);
  }

  /** Create an EVM wallet from a raw private key. */
  static fromPrivateKey(pk: string, rpcUrl: string): EvmWallet {
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(pk, provider);
    return new EvmWallet(wallet);
  }

  /** The checksummed EVM address. */
  get address(): string {
    return this.wallet.address;
  }

  /** The underlying ethers provider. */
  get provider(): JsonRpcProvider {
    return this.wallet.provider as JsonRpcProvider;
  }

  /** Native balance (wei) of the wallet. */
  async getBalance(): Promise<bigint> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return balance;
  }

  /** Native balance formatted in ETH units. */
  async getBalanceEth(): Promise<string> {
    return formatUnits(await this.getBalance(), 18);
  }

  /** ERC-20 token balance (smallest units) for a given token contract. */
  async getTokenBalance(tokenAddress: string): Promise<bigint> {
    const token = new Contract(getAddress(tokenAddress), ERC20_ABI, this.provider);
    const balance: bigint = (await token.balanceOf(this.wallet.address)) as bigint;
    return balance;
  }

  /** Send native ETH to an address. Returns the transaction hash. */
  async sendTransaction(to: string, value: bigint): Promise<string> {
    const tx = await this.wallet.sendTransaction({ to, value });
    return tx.hash;
  }

  /** Transfer an ERC-20 token. Returns the transaction hash. */
  async sendToken(tokenAddress: string, to: string, amount: bigint): Promise<string> {
    const token = new Contract(getAddress(tokenAddress), ERC20_ABI, this.wallet);
    const tx = await token.transfer(to, amount);
    return tx.hash as string;
  }

  /** Sign an arbitrary UTF-8 message (EIP-191 personal_sign). */
  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message);
  }
}
