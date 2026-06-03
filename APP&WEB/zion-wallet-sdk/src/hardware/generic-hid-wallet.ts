/**
 * Generic HID Hardware Wallet Abstraction
 *
 * Base class / interface for integrating arbitrary USB HID devices
 * (cold cards, air-gapped signers, custom HSMs) into ZION.
 *
 * Implementors must override:
 *   - connect()
 *   - disconnect()
 *   - getAddress(path, verifyOnDevice)
 *
 * Optional overrides:
 *   - signTransaction(txHash, path)
 *   - signMessage(message, path)
 */

// Note: subclasses that implement getAddress will need to import publicKeyToAddress

export interface HIDDeviceInfo {
  vendorId: number;
  productId: number;
  productName: string;
  serialNumber?: string;
}

export interface GenericAddressResult {
  address: string;
  publicKey: string;
  path: string;
  deviceInfo?: HIDDeviceInfo;
}

export interface GenericHIDWalletOptions {
  vendorId?: number;
  productId?: number;
  productName?: string;
}

/**
 * Abstract base for any HID hardware wallet.
 * Concrete implementations should extend this and wire transport
 * logic (WebUSB, WebHID, serial, BLE, …) in `connect()`.
 */
export abstract class GenericHIDWallet {
  protected deviceInfo: HIDDeviceInfo | null = null;
  protected connected = false;

  /** Open the transport to the device. */
  abstract connect(options?: GenericHIDWalletOptions): Promise<void>;

  /** Close the transport and release the device. */
  abstract disconnect(): void;

  protected ensureReady(): void {
    if (!this.connected) {
      throw new Error('Hardware wallet not connected. Call connect() first.');
    }
  }

  /**
   * Export public key and derive ZION address.
   * Must be implemented by every subclass.
   */
  abstract getAddress(
    path?: string,
    verifyOnDevice?: boolean
  ): Promise<GenericAddressResult>;

  /**
   * Show the address on the device for visual confirmation.
   * Default implementation delegates to `getAddress(path, true)`.
   */
  async verifyAddress(path?: string): Promise<void> {
    await this.getAddress(path, true);
  }

  /**
   * Sign a transaction hash. Subclasses may implement this.
   * Default throws — most generic HID devices will not support this initially.
   */
  async signTransaction(_txHash: Uint8Array, _path?: string): Promise<Uint8Array> {
    throw new Error(
      `Transaction signing not implemented for ${this.deviceInfo?.productName ?? 'this device'}. ` +
      'Override signTransaction() in your device subclass.'
    );
  }

  /**
   * Sign a message. Subclasses may implement this.
   * Default throws.
   */
  async signMessage(_message: string | Uint8Array, _path?: string): Promise<string> {
    throw new Error(
      `Message signing not implemented for ${this.deviceInfo?.productName ?? 'this device'}. ` +
      'Override signMessage() in your device subclass.'
    );
  }
}

/**
 * Registry for concrete GenericHIDWallet implementations.
 * Consumers can register new device drivers at runtime.
 */
export class HIDWalletRegistry {
  private static drivers = new Map<string, new () => GenericHIDWallet>();

  static register(name: string, ctor: new () => GenericHIDWallet): void {
    HIDWalletRegistry.drivers.set(name, ctor);
  }

  static create(name: string): GenericHIDWallet {
    const ctor = HIDWalletRegistry.drivers.get(name);
    if (!ctor) {
      throw new Error(`No HID wallet driver registered for "${name}". ` +
        `Available: ${Array.from(HIDWalletRegistry.drivers.keys()).join(', ')}`);
    }
    return new ctor();
  }

  static list(): string[] {
    return Array.from(HIDWalletRegistry.drivers.keys());
  }
}
