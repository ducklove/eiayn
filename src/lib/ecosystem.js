// Glue between the app and the vendored Value Compass shell (public/vc-shell.js,
// window.VCShell). Every call degrades to a no-op when the shell is missing.

// The hub's analysis view accepts KRX-style 6-character codes only; overseas
// tickers (VOO, 1321.T) never get the '허브에서 분석' chip.
const HUB_CODE = /^[0-9A-Z]{6}$/;
const DOMESTIC_MARKET = '국내';

export function hubStockCode(etf) {
  if (!etf || etf.market !== DOMESTIC_MARKET) return null;
  const code = String(etf.id ?? '')
    .trim()
    .toUpperCase();
  return HUB_CODE.test(code) ? code : null;
}

export function shell() {
  return typeof window !== 'undefined' ? (window.VCShell ?? null) : null;
}

export function syncShellStock(etf) {
  const api = shell();
  if (typeof api?.setStock !== 'function') return;
  const code = hubStockCode(etf);
  api.setStock(code, code ? (etf.shortName || etf.name || '').trim() || null : null);
}

// --- #vc-held fragment -------------------------------------------------------
// The hub hands holdings to portfolio-held-badges.js in a `vc-held=` fragment
// segment. That script loads async (it lives on the home server), so the app
// must not mistake the segment for a section anchor, and must not leave the
// holdings in the address bar when the script never arrives.

const isHeldSegment = (segment) => segment === 'vc-held' || segment.startsWith('vc-held=');

export function sectionFromHash(hash) {
  return (
    String(hash ?? '')
      .replace(/^#/, '')
      .split('&')
      .find((segment) => segment && !isHeldSegment(segment)) ?? ''
  );
}

export function stripHeldFragment(win = window) {
  const segments = win.location.hash.slice(1).split('&');
  if (!segments.some(isHeldSegment)) return false;
  const rest = segments.filter((segment) => segment && !isHeldSegment(segment)).join('&');
  win.history.replaceState(
    win.history.state,
    '',
    `${win.location.pathname}${win.location.search}${rest ? `#${rest}` : ''}`,
  );
  return true;
}

export const HELD_FRAGMENT_TIMEOUT_MS = 5000;

export function scheduleHeldFragmentCleanup(win = window, timeoutMs = HELD_FRAGMENT_TIMEOUT_MS) {
  if (!win.location.hash.includes('vc-held')) return null;
  return win.setTimeout(() => stripHeldFragment(win), timeoutMs);
}
