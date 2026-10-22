/**
 * Sign-In with Ethereum (SIWE) helper.
 * Builds and verifies EIP-4361 messages for ZIS authentication.
 */

import { verifyMessage, getAddress } from 'ethers';

export interface SiweMessageFields {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  requestId?: string;
  resources?: string[];
}

export class SiweHelper {
  /**
   * Create a SIWE (EIP-4361) message string ready for signing.
   */
  static createMessage(
    address: string,
    chainId: number,
    nonce: string,
    domain: string,
    uri: string,
    options?: {
      statement?: string;
      issuedAt?: string;
      expirationTime?: string;
      requestId?: string;
      resources?: string[];
    },
  ): string {
    const fields: SiweMessageFields = {
      domain,
      address: getAddress(address),
      statement: options?.statement ?? 'Sign in to ZION Identity Service',
      uri,
      version: '1',
      chainId,
      nonce,
      issuedAt: options?.issuedAt ?? new Date().toISOString(),
      expirationTime: options?.expirationTime,
      requestId: options?.requestId,
      resources: options?.resources,
    };
    return SiweHelper.serialize(fields);
  }

  /** Render a SiweMessageFields object into the EIP-4361 text format. */
  private static serialize(fields: SiweMessageFields): string {
    const header = `${fields.domain} wants you to sign in with your Ethereum account:`;
    const addressLine = fields.address;

    const statementBlock = fields.statement ? `\n${fields.statement}\n` : '\n';

    const uriLine = `URI: ${fields.uri}`;
    const versionLine = `Version: ${fields.version}`;
    const chainLine = `Chain ID: ${fields.chainId}`;
    const nonceLine = `Nonce: ${fields.nonce}`;
    const issuedLine = `Issued At: ${fields.issuedAt}`;
    const expiryLine = fields.expirationTime ? `\nExpiration Time: ${fields.expirationTime}` : '';
    const reqLine = fields.requestId ? `\nRequest ID: ${fields.requestId}` : '';
    const resLine = fields.resources && fields.resources.length > 0
      ? `\nResources:\n${fields.resources.map((r) => `- ${r}`).join('\n')}`
      : '';

    return [
      header,
      addressLine,
      statementBlock,
      uriLine,
      versionLine,
      chainLine,
      nonceLine,
      issuedLine + expiryLine + reqLine + resLine,
    ].join('\n');
  }

  /**
   * Verify a SIWE signature against the expected address.
   * Recovers the signer from the message + signature and compares (checksummed).
   */
  static verifyMessage(message: string, signature: string, expectedAddress: string): boolean {
    try {
      const recovered = verifyMessage(message, signature);
      return getAddress(recovered) === getAddress(expectedAddress);
    } catch {
      return false;
    }
  }
}
