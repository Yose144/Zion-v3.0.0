import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStatusStore } from './statusStore';

describe('useStatusStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useStatusStore.setState({
      status: null,
      health: null,
      history: [],
      connected: false,
      lastUpdated: null,
      error: null,
    });
    vi.resetAllMocks();
  });

  it('has correct initial state', () => {
    const state = useStatusStore.getState();
    expect(state.status).toBeNull();
    expect(state.health).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.connected).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setConnected updates state', () => {
    useStatusStore.getState().setConnected(true);
    expect(useStatusStore.getState().connected).toBe(true);
  });

  it('applyWsStatus updates status and lastUpdated', () => {
    const mockStatus = { node1: { running: true, block_height: 100 } } as any;
    useStatusStore.getState().applyWsStatus(mockStatus);
    const state = useStatusStore.getState();
    expect(state.status).toEqual(mockStatus);
    expect(state.lastUpdated).not.toBeNull();
  });

  it('applyWsHealth updates health map', () => {
    const mockHealth = { node1: 'healthy', pool: 'degraded' };
    useStatusStore.getState().applyWsHealth(mockHealth);
    expect(useStatusStore.getState().health).toEqual(mockHealth);
  });
});
