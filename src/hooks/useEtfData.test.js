// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useEtfData } from './useEtfData.js';

const validData = {
  etfs: [{ id: 'QQQ', name: 'QQQ', holdings: [], returns: {}, risk: {}, dataQuality: {} }],
};
const response = (data) => ({ ok: true, json: async () => data });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ETF data loading', () => {
  it.each([null, {}, { etfs: [] }, { etfs: [null] }, { etfs: [{ id: 'QQQ' }] }])(
    'rejects invalid snapshots instead of leaving initialization pending: %j',
    async (data) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(data)));
      const { result } = renderHook(() => useEtfData());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error.message).toContain('형식');
    },
  );

  it('recovers from an HTTP failure on retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce(response(validData)),
    );
    const { result } = renderHook(() => useEtfData());
    await waitFor(() => expect(result.current.error?.message).toContain('503'));
    await act(() => result.current.reload());
    expect(result.current.data).toEqual(validData);
    expect(result.current.error).toBeNull();
  });

  it('aborts an obsolete request and prevents it replacing newer data', async () => {
    let resolveFirst;
    let firstSignal;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce((url, options) => {
          firstSignal = options.signal;
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        })
        .mockResolvedValueOnce(response(validData)),
    );
    const { result } = renderHook(() => useEtfData());
    await act(() => result.current.reload());
    expect(firstSignal.aborted).toBe(true);
    await act(async () => {
      resolveFirst(response({ etfs: [] }));
    });
    expect(result.current.data).toEqual(validData);
    expect(result.current.error).toBeNull();
  });

  it('times out a stalled request and offers a retryable error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (url, { signal }) =>
          new Promise((resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );
    const { result } = renderHook(() => useEtfData());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error.message).toContain('시간이 초과');
  });
});
