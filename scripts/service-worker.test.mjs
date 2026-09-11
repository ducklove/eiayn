import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker() {
  const handlers = {};
  const caches = {
    keys: async () => ['another-app-v1', 'eiayn-static-v1', 'eiayn-static-v2'],
    delete: vi.fn().mockResolvedValue(true),
  };
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    caches,
    self: {
      location: { origin: 'https://ducklove.github.io' },
      registration: { scope: 'https://ducklove.github.io/eiayn/' },
      clients: { claim: vi.fn() },
      addEventListener: (name, handler) => {
        handlers[name] = handler;
      },
    },
  });
  return { handlers, caches };
}

describe('service worker isolation', () => {
  it('removes only obsolete EIAYN caches on activation', async () => {
    const { handlers, caches } = worker();
    let pending;
    handlers.activate({
      waitUntil: (promise) => {
        pending = promise;
      },
    });
    await pending;
    expect(caches.delete.mock.calls).toEqual([['eiayn-static-v1']]);
  });
  it('does not intercept other apps on the same GitHub Pages origin', () => {
    const { handlers } = worker();
    const respondWith = vi.fn();
    handlers.fetch({
      request: { method: 'GET', mode: 'navigate', url: 'https://ducklove.github.io/another-app/' },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
  });
});
