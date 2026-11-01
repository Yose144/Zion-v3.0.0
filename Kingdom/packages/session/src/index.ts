/**
 * @zion/session — jediný klient ZION Identity Service.
 *
 * Dřív měl každý povrch vlastní kopii (website 619 řádků, market 344,
 * pool-ui 182, nirvana 73). Tohle je jedna implementace; appky ji jen volají.
 *
 * Pravidla:
 * - Klíč nikdy neopouští prohlížeč. Do ZIS jde podpis, ne fráze.
 * - Session je cookie `zion_session`, vydává ji ZIS, drží ji hostitel okna.
 * - Na serveru se cookie předává explicitně (`sessionCookie`), nikdy se
 *   nespoléhá na to, že ji `fetch` pošle sám.
 */

export { SESSION_COOKIE, ZisError, zisUrl } from './client';
export type { CallOptions } from './client';
export {
  getChallenge,
  verifyEd25519,
  getCurrentUser,
  listSessions,
  logout,
} from './client';

export {
  deriveWalletFromMnemonic,
  addressFromPublicKey,
  signMessage,
  isValidMnemonic,
} from './wallet';
export type { ZionWallet } from './wallet';

export type {
  ZisChainType,
  ZisChallenge,
  ZisLinkedAddress,
  ZisOasisPlayer,
  ZisUser,
  ZisSession,
  ZisActiveSession,
  ZisSignature,
} from './types';
