/**
 * Offline Transaction Queue
 * =========================
 * Persists signed transactions to AsyncStorage when the network is
 * unavailable, so they can be broadcast later once connectivity returns.
 *
 * Pure JS — no native modules required. Uses @react-native-async-storage/async-storage
 * which is already a project dependency.
 *
 * @module services/OfflineTxQueue
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'zion_offline_tx_queue';

/**
 * Queue a signed transaction for later broadcast.
 * @param {Object} signedTx - Signed transaction object (must include tx_id)
 * @returns {Promise<void>}
 */
export async function queueTransaction(signedTx) {
  const queue = await getQueue();
  queue.push({ tx: signedTx, queuedAt: Date.now(), attempts: 0 });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Get all queued transactions.
 * @returns {Promise<Array<{tx: Object, queuedAt: number, attempts: number}>>}
 */
export async function getQueue() {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
}

/**
 * Remove a transaction from the queue (after successful broadcast).
 * @param {string} txId - The tx_id of the transaction to remove
 * @returns {Promise<void>}
 */
export async function removeTransaction(txId) {
  const queue = await getQueue();
  const filtered = queue.filter(item => item.tx.tx_id !== txId);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

/**
 * Increment attempt count for a transaction (after a failed broadcast).
 * @param {string} txId - The tx_id of the transaction
 * @returns {Promise<void>}
 */
export async function incrementAttempts(txId) {
  const queue = await getQueue();
  for (const item of queue) {
    if (item.tx.tx_id === txId) {
      item.attempts++;
      break;
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Get count of pending transactions.
 * @returns {Promise<number>}
 */
export async function getPendingCount() {
  const queue = await getQueue();
  return queue.length;
}

/**
 * Clear all queued transactions (for testing / reset).
 * @returns {Promise<void>}
 */
export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export default {
  queueTransaction,
  getQueue,
  removeTransaction,
  incrementAttempts,
  getPendingCount,
  clearQueue,
};
