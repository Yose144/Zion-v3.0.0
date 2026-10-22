/**
 * Electron Storage — uses electron's safeStorage for encrypted local storage.
 * Requires Electron's main process context.
 */

import { StorageInterface } from './storage-interface.js';

export class ElectronStorage implements StorageInterface {
  private safeStorage: { encryptString: (text: string) => Buffer; decryptString: (buffer: Buffer) => string } | null = null;

  constructor() {
    try {
      const { safeStorage } = require('electron');
      this.safeStorage = safeStorage;
    } catch {
      throw new Error('Electron safeStorage is not available. This must run in Electron main process.');
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.safeStorage) throw new Error('safeStorage not initialized');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const filePath = path.join(os.homedir(), '.zion', 'wallet-storage', `${key}.enc`);

    if (!fs.existsSync(filePath)) return null;

    const encrypted = fs.readFileSync(filePath);
    return this.safeStorage.decryptString(encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.safeStorage) throw new Error('safeStorage not initialized');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const dir = path.join(os.homedir(), '.zion', 'wallet-storage');
    const filePath = path.join(dir, `${key}.enc`);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const encrypted = this.safeStorage.encryptString(value);
    fs.writeFileSync(filePath, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const filePath = path.join(os.homedir(), '.zion', 'wallet-storage', `${key}.enc`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
