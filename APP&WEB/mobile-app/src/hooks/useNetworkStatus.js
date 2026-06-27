/**
 * useNetworkStatus
 * =================
 * React hook that reports online/offline status.
 *
 * Pure JS — no native modules required. Uses a lightweight fetch-based
 * connectivity poll against a known endpoint (httpbin.org/status/200).
 *
 * @react-native-community/netinfo is NOT in package.json, so we avoid it
 * to keep this a pure-JS feature with zero new dependencies.
 *
 * @module hooks/useNetworkStatus
 * @returns {boolean} isOnline — true while connectivity appears available
 */

import { useState, useEffect } from 'react';

const CHECK_URL = 'https://httpbin.org/status/200';
const CHECK_INTERVAL_MS = 30000; // poll every 30s
const REQUEST_TIMEOUT_MS = 5000;

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkConnectivity = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(CHECK_URL, {
          method: 'HEAD',
          signal: controller.signal,
        });
        if (!cancelled) setIsOnline(response.ok);
      } catch {
        if (!cancelled) setIsOnline(false);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Check immediately on mount, then on an interval.
    checkConnectivity();
    const interval = setInterval(checkConnectivity, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}

export default useNetworkStatus;
