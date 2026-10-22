/**
 * Session Manager
 * Orchestrates ZIS login flows and persists the session token/user.
 *
 * Supports four login methods:
 *  - Mnemonic (Ed25519 / ZION L1)
 *  - SIWE (Ethereum private key)
 *  - Google OAuth ID token
 *  - API key
 */

import type { ZisClient, ZisUser } from './zis-client.js';
import type { StorageInterface } from '../storage/storage-interface.js';
import { deriveKeypairFromMnemonic, signMessage } from '../core/keypair.js';
import { publicKeyToAddress } from '../core/address.js';
import { EvmWallet } from '../evm/evm-wallet.js';
import { SiweHelper } from '../evm/siwe.js';

const SESSION_TOKEN_KEY = 'zion_zis_token';
const SESSION_USER_KEY = 'zion_zis_user';

export class SessionManager {
  private token: string | null = null;
  private user: ZisUser | null = null;
  private storage: StorageInterface;

  constructor(storage: StorageInterface) {
    this.storage = storage;
  }

  /** Restore a previously persisted session from storage. */
  async restore(): Promise<boolean> {
    const token = await this.storage.getItem(SESSION_TOKEN_KEY);
    const userJson = await this.storage.getItem(SESSION_USER_KEY);
    if (token && userJson) {
      this.token = token;
      try {
        this.user = JSON.parse(userJson) as ZisUser;
      } catch {
        this.user = null;
      }
      return this.user !== null;
    }
    return false;
  }

  /** Persist the current session to storage. */
  private async persist(): Promise<void> {
    if (this.token) {
      await this.storage.setItem(SESSION_TOKEN_KEY, this.token);
    }
    if (this.user) {
      await this.storage.setItem(SESSION_USER_KEY, JSON.stringify(this.user));
    }
  }

  /** Clear the in-memory + persisted session. */
  private async clearSession(): Promise<void> {
    this.token = null;
    this.user = null;
    await this.storage.removeItem(SESSION_TOKEN_KEY);
    await this.storage.removeItem(SESSION_USER_KEY);
  }

  /**
   * Login with a BIP39 mnemonic using Ed25519 (ZION L1) auth.
   * Derives the keypair, requests a challenge, signs it, and verifies.
   */
  async loginWithMnemonic(zisClient: ZisClient, mnemonic: string): Promise<ZisUser> {
    const { privateKey, publicKey } = await deriveKeypairFromMnemonic(mnemonic);
    const address = publicKeyToAddress(publicKey);

    const challenge = await zisClient.challenge(address, 'zion-l1');
    const messageBytes = new TextEncoder().encode(challenge.message);
    const signature = await signMessage(messageBytes, privateKey);

    const result = await zisClient.verifyEd25519(
      address,
      Buffer.from(publicKey).toString('hex'),
      Buffer.from(signature).toString('hex'),
    );

    this.token = result.token;
    this.user = result.user;
    await this.persist();
    return result.user;
  }

  /**
   * Login with an EVM private key using Sign-In with Ethereum.
   * Creates a SIWE message from a server challenge, signs it, and verifies.
   *
   * @param rpcUrl EVM RPC URL used to resolve the wallet/provider.
   * @param domain Origin domain for the SIWE message.
   * @param uri    Full URI of the relying party.
   * @param chainId EVM chain id (e.g. 1 for mainnet).
   */
  async loginWithSiwe(
    zisClient: ZisClient,
    privateKey: string,
    rpcUrl: string,
    domain: string,
    uri: string,
    chainId: number = 1,
  ): Promise<ZisUser> {
    const wallet = EvmWallet.fromPrivateKey(privateKey, rpcUrl);
    const address = wallet.address;

    const challenge = await zisClient.challenge(address, 'evm');
    const message = SiweHelper.createMessage(
      address,
      chainId,
      challenge.nonce,
      domain,
      uri,
    );

    const signature = await wallet.signMessage(message);
    const result = await zisClient.verifySiwe(message, signature);

    this.token = result.token;
    this.user = result.user;
    await this.persist();
    return result.user;
  }

  /** Login with a Google OAuth ID token. */
  async loginWithGoogle(zisClient: ZisClient, idToken: string): Promise<ZisUser> {
    const result = await zisClient.verifyGoogle(idToken);
    this.token = result.token;
    this.user = result.user;
    await this.persist();
    return result.user;
  }

  /** Login with an API key (service-to-service auth). */
  async loginWithApiKey(zisClient: ZisClient, apiKey: string): Promise<ZisUser> {
    const result = await zisClient.verifyApiKey(apiKey);
    if (!result.valid) {
      throw new Error('Invalid API key');
    }
    // API key auth may return a user without a bearer token; store the key
    // as the token so downstream clients can reuse it.
    this.token = apiKey;
    this.user = result.user;
    await this.persist();
    return result.user;
  }

  /** Current bearer token (or null). */
  getToken(): string | null {
    return this.token;
  }

  /** Current authenticated user (or null). */
  getUser(): ZisUser | null {
    return this.user;
  }

  /** Whether a session is present in memory. */
  isAuthenticated(): boolean {
    return this.token !== null && this.user !== null;
  }

  /** Logout and clear the session. */
  async logout(zisClient: ZisClient): Promise<void> {
    if (this.token) {
      try {
        await zisClient.logout(this.token);
      } catch {
        // Best-effort: clear locally even if the server call fails.
      }
    }
    await this.clearSession();
  }
}
