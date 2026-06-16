/**
 * Web Storage — uses localStorage for browser environments.
 */

import { StorageInterface } from './storage-interface.js';

export class WebStorage implements StorageInterface {
  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') throw new Error('localStorage not available');
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') throw new Error('localStorage not available');
    localStorage.removeItem(key);
  }
}
