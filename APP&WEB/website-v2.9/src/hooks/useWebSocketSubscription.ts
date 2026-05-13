import { useEffect, useState, useCallback, useRef } from 'react';
import { getZionWebSocket, SubscriptionType, WsMessage } from '@/lib/zion-rpc';

export interface UseWebSocketSubscriptionOptions {
  enabled?: boolean;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface UseWebSocketSubscriptionReturn<T = any> {
  data: T | null;
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected';
  error: Error | null;
  subscribe: (subscription: SubscriptionType, handler: (data: T) => void) => void;
  unsubscribe: (subscription: SubscriptionType) => void;
}

export function useWebSocketSubscription<T = any>(
  subscription: SubscriptionType,
  options: UseWebSocketSubscriptionOptions = {}
): UseWebSocketSubscriptionReturn<T> {
  const { enabled = true, onError, onConnect, onDisconnect } = options;

  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef(getZionWebSocket());
  const handlerRef = useRef<((data: T) => void) | null>(null);

  const subscribe = useCallback((sub: SubscriptionType, handler: (data: T) => void) => {
    handlerRef.current = handler;
    wsRef.current.subscribe(sub, handler);
  }, []);

  const unsubscribe = useCallback((sub: SubscriptionType) => {
    wsRef.current.unsubscribe(sub);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const ws = wsRef.current;

    // Connection state watcher
    const checkConnection = () => {
      setIsConnected(ws.isConnected());
      setConnectionState(ws.getConnectionState());
    };

    // Initial connection
    const connect = async () => {
      try {
        checkConnection();
        if (!ws.isConnected()) {
          await ws.connect();
          checkConnection();
          onConnect?.();
        }
      } catch (err) {
        const error = err as Error;
        setError(error);
        onError?.(error);
      }
    };

    connect();

    // Watch connection state changes
    const interval = setInterval(checkConnection, 1000);

    // Subscribe to the requested subscription
    const handler = (newData: T) => {
      setData(newData);
      if (handlerRef.current) {
        handlerRef.current(newData);
      }
    };

    ws.subscribe(subscription, handler);

    return () => {
      clearInterval(interval);
      ws.unsubscribe(subscription);
      onDisconnect?.();
    };
  }, [subscription, enabled, onError, onConnect, onDisconnect]);

  return {
    data,
    isConnected,
    connectionState,
    error,
    subscribe,
    unsubscribe,
  };
}

// Specific hooks for common subscriptions

export function useNewBlocks(enabled: boolean = true) {
  return useWebSocketSubscription(SubscriptionType.NewBlocks, { enabled });
}

export function usePendingTransactions(enabled: boolean = true) {
  return useWebSocketSubscription(SubscriptionType.PendingTransactions, { enabled });
}

export function useAddressSubscription(address: string, enabled: boolean = true) {
  const subscription = `${SubscriptionType.Address}:${address}` as SubscriptionType;
  return useWebSocketSubscription(subscription, { enabled });
}

export function useNetworkStatus(enabled: boolean = true) {
  return useWebSocketSubscription(SubscriptionType.NetworkStatus, { enabled });
}

// Hook for multiple subscriptions

export function useWebSocketSubscriptions(
  subscriptions: Array<{ type: SubscriptionType; handler: (data: any) => void }>,
  options: UseWebSocketSubscriptionOptions = {}
) {
  const { enabled = true, onError, onConnect, onDisconnect } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef(getZionWebSocket());

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) {
      return;
    }

    const ws = wsRef.current;

    const checkConnection = () => {
      setIsConnected(ws.isConnected());
      setConnectionState(ws.getConnectionState());
    };

    const connect = async () => {
      try {
        checkConnection();
        if (!ws.isConnected()) {
          await ws.connect();
          checkConnection();
          onConnect?.();
        }
      } catch (err) {
        const error = err as Error;
        setError(error);
        onError?.(error);
      }
    };

    connect();

    const interval = setInterval(checkConnection, 1000);

    // Subscribe to all requested subscriptions
    subscriptions.forEach(({ type, handler }) => {
      ws.subscribe(type, handler);
    });

    return () => {
      clearInterval(interval);
      subscriptions.forEach(({ type }) => {
        ws.unsubscribe(type);
      });
      onDisconnect?.();
    };
  }, [subscriptions, enabled, onError, onConnect, onDisconnect]);

  return {
    isConnected,
    connectionState,
    error,
  };
}
