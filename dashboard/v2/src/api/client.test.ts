import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { apiFetch, ApiError } from './client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    const mockData = { status: 'ok', height: 100 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await apiFetch('/api/status');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('/api/status', expect.any(Object));
  });

  it('retries on network error then succeeds', async () => {
    const mockData = { ok: true };
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

    const result = await apiFetch('/api/health');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws ApiError on HTTP 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(apiFetch('/api/missing')).rejects.toThrow(ApiError);
  });

  it('passes custom timeout in options', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    await apiFetch('/api/fast', { timeout: 2000 });
    expect(fetch).toHaveBeenCalledWith('/api/fast', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });
});

describe('api client endpoints', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);
  });

  it('health() calls /api/health', async () => {
    await api.health();
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('blocks(limit) passes query param', async () => {
    await api.blocks(50);
    expect(fetch).toHaveBeenCalledWith('/api/blocks?limit=50', expect.any(Object));
  });

  it('node1Start() POSTs to /api/node1/start', async () => {
    await api.node1Start();
    expect(fetch).toHaveBeenCalledWith('/api/node1/start', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({}),
    }));
  });

  it('stackLaunch() POSTs to /api/stack/launch', async () => {
    await api.stackLaunch();
    expect(fetch).toHaveBeenCalledWith('/api/stack/launch', expect.objectContaining({ method: 'POST' }));
  });
});
