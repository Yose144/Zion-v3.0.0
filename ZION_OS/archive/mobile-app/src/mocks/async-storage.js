/**
 * Web mock for @react-native-async-storage/async-storage
 * Uses localStorage as web backend
 */
const AsyncStorage = {
  getItem: async (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: async (key, value) => {
    try { localStorage.setItem(key, value); } catch {}
  },
  removeItem: async (key) => {
    try { localStorage.removeItem(key); } catch {}
  },
  mergeItem: async (key, value) => {
    try {
      const existing = localStorage.getItem(key);
      if (existing) {
        const merged = { ...JSON.parse(existing), ...JSON.parse(value) };
        localStorage.setItem(key, JSON.stringify(merged));
      } else {
        localStorage.setItem(key, value);
      }
    } catch {}
  },
  clear: async () => {
    try { localStorage.clear(); } catch {}
  },
  getAllKeys: async () => {
    try {
      return Object.keys(localStorage);
    } catch { return []; }
  },
  multiGet: async (keys) => {
    try {
      return keys.map(k => [k, localStorage.getItem(k)]);
    } catch { return keys.map(k => [k, null]); }
  },
  multiSet: async (keyValuePairs) => {
    try {
      keyValuePairs.forEach(([k, v]) => localStorage.setItem(k, v));
    } catch {}
  },
  multiRemove: async (keys) => {
    try {
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
  },
};

export default AsyncStorage;
