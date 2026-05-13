/**
 * React Native Storage — uses @react-native-async-storage/async-storage.
 * This file must be imported conditionally in React Native apps.
 */

import { StorageInterface } from './storage-interface.js';

export class ReactNativeStorage implements StorageInterface {
  private asyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;

  constructor() {
    try {
      // Dynamic import to avoid bundling issues in web builds
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      // @ts-ignore — optional peer dependency, not installed in base SDK
      const mod = require('@react-native-async-storage/async-storage');
      this.asyncStorage = mod.default ?? mod;
    } catch {
      throw new Error(
        '@react-native-async-storage/async-storage is required for ReactNativeStorage. ' +
          'Install it: npm install @react-native-async-storage/async-storage'
      );
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.asyncStorage) throw new Error('AsyncStorage not initialized');
    return this.asyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.asyncStorage) throw new Error('AsyncStorage not initialized');
    await this.asyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (!this.asyncStorage) throw new Error('AsyncStorage not initialized');
    await this.asyncStorage.removeItem(key);
  }
}
