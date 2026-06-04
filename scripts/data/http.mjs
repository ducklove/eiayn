export async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, {
    accept: 'application/json,text/plain,*/*',
    ...options,
  }));
}

export async function fetchText(url, options = {}) {
  const {
    accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    attempts = 3,
    timeoutMs = 45_000,
    warn = true,
  } = options;

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept,
          'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'user-agent': 'Mozilla/5.0 (compatible; EIAYNDataBot/1.0; +https://github.com/ducklove/eiayn)',
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (warn) {
        console.warn(`[data:update] Fetch failed (${attempt}/${attempts}) ${url}: ${error.message}`);
      }
      if (attempt < attempts) await wait(800 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message}`);
}

export async function optionalJson(url, options = {}) {
  try {
    return await fetchJson(url, { attempts: 2, warn: false, ...options });
  } catch (error) {
    console.warn(`[data:update] Optional source unavailable ${url}: ${error.message}`);
    return null;
  }
}

export async function optionalText(url, options = {}) {
  try {
    return await fetchText(url, { attempts: 2, warn: false, ...options });
  } catch (error) {
    console.warn(`[data:update] Optional source unavailable ${url}: ${error.message}`);
    return null;
  }
}

export async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
