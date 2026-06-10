import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { buildSitemapXml, SITEMAP_BASE_URL } from './build-sitemap.mjs';

const GENERATED_AT = '2026-06-05T02:32:08.842Z';

function etf(id) {
  return { id, name: `${id} ETF` };
}

// Strict XML parse: jsdom throws a DOMException on malformed documents.
function parseXml(xml) {
  return new JSDOM(xml, { contentType: 'text/xml' }).window.document;
}

function locsOf(doc) {
  return [...doc.getElementsByTagName('loc')].map((node) => node.textContent);
}

describe('buildSitemapXml', () => {
  it('produces a well-formed urlset with the sitemaps.org namespace', () => {
    const xml = buildSitemapXml([etf('QQQ')], { generatedAt: GENERATED_AT });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.endsWith('</urlset>\n')).toBe(true);

    const doc = parseXml(xml);
    expect(doc.documentElement.tagName).toBe('urlset');
    expect(doc.documentElement.getAttribute('xmlns')).toBe(
      'http://www.sitemaps.org/schemas/sitemap/0.9',
    );
  });

  it('lists the root URL first, then one ?code= deep link per ETF in snapshot order', () => {
    const doc = parseXml(
      buildSitemapXml([etf('122630'), etf('QQQ'), etf('FUEVFVND.VN')], {
        generatedAt: GENERATED_AT,
      }),
    );
    expect(locsOf(doc)).toEqual([
      SITEMAP_BASE_URL,
      `${SITEMAP_BASE_URL}?code=122630`,
      `${SITEMAP_BASE_URL}?code=QQQ`,
      `${SITEMAP_BASE_URL}?code=FUEVFVND.VN`,
    ]);
  });

  it('emits one <url> per ETF plus the root entry at snapshot scale', () => {
    const etfs = Array.from({ length: 1348 }, (_, index) => etf(`E${index}`));
    const doc = parseXml(buildSitemapXml(etfs, { generatedAt: GENERATED_AT }));
    expect(doc.getElementsByTagName('url')).toHaveLength(1349);
  });

  it('stamps every entry with lastmod = the snapshot generatedAt date (YYYY-MM-DD)', () => {
    const doc = parseXml(buildSitemapXml([etf('QQQ'), etf('VTI')], { generatedAt: GENERATED_AT }));
    const lastmods = [...doc.getElementsByTagName('lastmod')].map((node) => node.textContent);
    expect(lastmods).toEqual(['2026-06-05', '2026-06-05', '2026-06-05']);
  });

  it('XML-escapes hostile ids in <loc> while the document stays well-formed', () => {
    const hostile = `A&B<C>"D'E`;
    const xml = buildSitemapXml([etf(hostile)], { generatedAt: GENERATED_AT });
    expect(xml).toContain(`<loc>${SITEMAP_BASE_URL}?code=A&amp;B&lt;C&gt;&quot;D&apos;E</loc>`);

    const doc = parseXml(xml); // must stay well-formed
    expect(locsOf(doc).at(-1)).toBe(`${SITEMAP_BASE_URL}?code=${hostile}`);
  });

  it('honors a custom baseUrl', () => {
    const doc = parseXml(
      buildSitemapXml([etf('QQQ')], {
        baseUrl: 'https://example.test/app/',
        generatedAt: GENERATED_AT,
      }),
    );
    expect(locsOf(doc)).toEqual([
      'https://example.test/app/',
      'https://example.test/app/?code=QQQ',
    ]);
  });

  it('skips etfs without a usable string id', () => {
    const doc = parseXml(
      buildSitemapXml([etf('QQQ'), { name: 'no id' }, { id: '' }, null], {
        generatedAt: GENERATED_AT,
      }),
    );
    expect(locsOf(doc)).toEqual([SITEMAP_BASE_URL, `${SITEMAP_BASE_URL}?code=QQQ`]);
  });

  it('throws a TypeError without an etf array or a dated generatedAt', () => {
    expect(() => buildSitemapXml(null, { generatedAt: GENERATED_AT })).toThrow(TypeError);
    expect(() => buildSitemapXml('nope', { generatedAt: GENERATED_AT })).toThrow(TypeError);
    expect(() => buildSitemapXml([etf('QQQ')])).toThrow(TypeError);
    expect(() => buildSitemapXml([etf('QQQ')], {})).toThrow(TypeError);
    expect(() => buildSitemapXml([etf('QQQ')], { generatedAt: 'garbage' })).toThrow(TypeError);
    expect(() => buildSitemapXml([etf('QQQ')], { generatedAt: null })).toThrow(TypeError);
  });
});
