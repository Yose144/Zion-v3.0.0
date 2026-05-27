import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAlertStore } from './alertStore';

describe('useAlertStore', () => {
  beforeEach(() => {
    useAlertStore.setState({
      alerts: [],
      unreadCount: 0,
    });
    vi.resetAllMocks();
  });

  it('has correct initial state', () => {
    const state = useAlertStore.getState();
    expect(state.alerts).toEqual([]);
    expect(state.unreadCount).toBe(0);
  });

  it('appendAlert adds alert and increments unreadCount', () => {
    const alert = { id: '1', severity: 'warning', title: 'Test', detail: 'Detail', dismissed: false };
    useAlertStore.getState().appendAlert(alert);
    const state = useAlertStore.getState();
    expect(state.alerts).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });

  it('appendAlert does not increment unreadCount for dismissed alerts', () => {
    const alert = { id: '1', severity: 'info', title: 'Test', detail: 'Detail', dismissed: true };
    useAlertStore.getState().appendAlert(alert);
    expect(useAlertStore.getState().unreadCount).toBe(0);
  });

  it('dismiss marks alert as dismissed and decrements unreadCount', async () => {
    const store = useAlertStore.getState();
    store.appendAlert({ id: '1', severity: 'warning', title: 'Test', detail: 'D', dismissed: false });
    
    // Mock fetch for dismiss API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    await store.dismiss('1');
    const state = useAlertStore.getState();
    expect(state.alerts[0].dismissed).toBe(true);
    expect(state.unreadCount).toBe(0);
  });
});
