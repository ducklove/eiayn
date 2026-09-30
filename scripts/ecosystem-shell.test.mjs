// Structure and behaviour contract for the Value Compass ecosystem adoption:
// index.html carries the synced pre-paint theme-boot block, the vendored
// tokens/shell assets, a <vc-shell> outside React's #root, and the hub's
// held-badges script loaded async (never ahead of the app's first render).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BOOT = /<!-- vc:theme-boot --><script>\n([\s\S]*?)\n<\/script><!-- \/vc:theme-boot -->/;

function runBoot(url, storage = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url,
    runScripts: 'outside-only',
  });
  for (const [key, value] of Object.entries(storage)) dom.window.localStorage.setItem(key, value);
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.eval(html.match(BOOT)[1]);
  return dom.window;
}

describe('index.html ecosystem structure', () => {
  it('has exactly one filled theme-boot block before any stylesheet or script', () => {
    expect(html.match(/<!-- vc:theme-boot -->/g)).toHaveLength(1);
    const boot = html.match(BOOT);
    expect(boot?.[1]).toContain('vc-theme-boot v1');
    const bootAt = html.indexOf('<!-- vc:theme-boot -->');
    expect(bootAt).toBeLessThan(html.indexOf('rel="stylesheet"'));
    expect(bootAt).toBeLessThan(html.indexOf('<script defer'));
  });

  it('drops the app-specific pre-paint script and the eiayn:theme:v1 key', () => {
    expect(html).not.toContain('eiaynTheme');
    expect(html.replace(BOOT, '')).not.toContain('eiayn:theme:v1');
  });

  // No ?v= on local public/ files (repo convention, as for value-analytics.js):
  // Vite cannot resolve a query-suffixed public path and warns at build time.
  it('links the vendored tokens before the app CSS and loads the shell deferred', () => {
    expect(html).toContain('<link rel="stylesheet" href="%BASE_URL%vc-tokens.css" />');
    expect(html).toContain('<script defer src="%BASE_URL%vc-shell.js"></script>');
    expect(html.indexOf('vc-tokens.css')).toBeLessThan(html.indexOf('/src/main.jsx'));
    expect(html.indexOf('vc-shell.js')).toBeLessThan(html.indexOf('/src/main.jsx'));
  });

  it('places <vc-shell tool="eiayn"> as a sibling before #root with a hub fallback link', () => {
    expect(html).toMatch(
      /<body>\s*<!--[^>]*-->\s*<vc-shell tool="eiayn"><a href="https:\/\/ducklove\.duckdns\.org:3691"[^>]*>Value Compass ↗<\/a><\/vc-shell>\s*<div id="root"><\/div>/,
    );
  });

  it('loads the hub held-badges script async at the registry version', () => {
    const tags = html.match(/<script[^>]*portfolio-held-badges\.js[^>]*><\/script>/g);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatch(/^<script async /);
    expect(tags[0]).not.toContain('defer');
    expect(tags[0]).toContain('portfolio-held-badges.js?v=20260930-vc');
  });

  it('ships the vendored assets from public/ (copied to the Pages root by Vite)', () => {
    for (const file of ['public/vc-shell.js', 'public/vc-tokens.css', 'scripts/vc-publish.mjs']) {
      expect(existsSync(path.join(ROOT, file)), file).toBe(true);
    }
    expect(readFileSync(path.join(ROOT, 'public/vc-shell.js'), 'utf8')).toContain('window.VCShell');
    expect(readFileSync(path.join(ROOT, 'public/vc-tokens.css'), 'utf8')).toContain('--vc-up');
  });

  it('keeps vendored copies out of Prettier', () => {
    const ignore = readFileSync(path.join(ROOT, '.prettierignore'), 'utf8').split('\n');
    for (const file of [
      'public/value-analytics.js',
      'public/vc-shell.js',
      'public/vc-tokens.css',
      'scripts/vc-publish.mjs',
      'index.html',
    ]) {
      expect(ignore).toContain(file);
    }
  });
});

describe('theme-boot block behaviour', () => {
  it('applies ?theme=dark without storing it and flags ?embed', () => {
    const win = runBoot('https://example.test/eiayn/?theme=dark&embed=1&code=069500', {
      theme: 'light',
    });
    expect(win.document.documentElement.dataset.theme).toBe('dark');
    expect(win.document.documentElement.hasAttribute('data-embed')).toBe(true);
    expect(win.localStorage.getItem('theme')).toBe('light');
  });

  it('ignores a legacy ETF category in ?theme= and ?embed=0', () => {
    const win = runBoot('https://example.test/eiayn/?theme=%EB%B0%B0%EB%8B%B9&embed=0', {
      theme: 'dark',
    });
    expect(win.document.documentElement.dataset.theme).toBe('dark');
    expect(win.document.documentElement.hasAttribute('data-embed')).toBe(false);
  });

  it('migrates the legacy eiayn:theme:v1 JSON value into the shared key', () => {
    const win = runBoot('https://example.test/eiayn/', { 'eiayn:theme:v1': '"dark"' });
    expect(win.document.documentElement.dataset.theme).toBe('dark');
    expect(win.localStorage.getItem('theme')).toBe('dark');
  });
});
