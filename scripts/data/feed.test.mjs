import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  buildFeedXml,
  changeSummaryLabel,
  escapeXml,
  FEED_LINK,
  FEED_MAX_ITEMS,
  FEED_TITLE,
} from './feed.mjs';

function changesFixture(overrides = {}) {
  return {
    schemaVersion: 1,
    generatedAt: '2026-06-10T21:40:00.000Z',
    previousGeneratedAt: '2026-06-09T21:40:00.000Z',
    newListings: [
      { id: '449450', name: 'PLUS K방산', market: '국내' },
      { id: 'BITW', name: 'Bitwise 10 Crypto', market: '미국' },
      { id: 'XYLD', name: 'Global X S&P 500 Covered Call', market: '미국' },
    ],
    delisted: [],
    feeChanges: [
      { id: '069500', name: 'KODEX 200', from: 0.15, to: 0.09 },
      { id: 'QQQ', name: 'Invesco QQQ Trust', from: 0.2, to: 0.15 },
    ],
    scoreMoves: [{ id: 'SOXX', name: 'iShares Semiconductor', from: 62, to: 71 }],
    ...overrides,
  };
}

// Strict XML parse: jsdom throws a DOMException on malformed documents.
function parseXml(xml) {
  return new JSDOM(xml, { contentType: 'text/xml' }).window.document;
}

describe('buildFeedXml', () => {
  it('produces a well-formed RSS 2.0 document with the required channel fields', () => {
    const xml = buildFeedXml(null, changesFixture());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);

    const doc = parseXml(xml);
    expect(doc.documentElement.tagName).toBe('rss');
    expect(doc.documentElement.getAttribute('version')).toBe('2.0');
    expect(doc.querySelector('rss > channel > title').textContent).toBe(FEED_TITLE);
    expect(doc.querySelector('rss > channel > link').textContent).toBe(FEED_LINK);
    expect(doc.querySelector('rss > channel > description').textContent).not.toBe('');
    expect(doc.querySelector('rss > channel > lastBuildDate').textContent).toBe(
      'Wed, 10 Jun 2026 21:40:00 GMT',
    );
  });

  it('summarizes counts in the item title and stamps guid/pubDate from generatedAt', () => {
    const doc = parseXml(buildFeedXml(null, changesFixture()));
    const item = doc.querySelector('channel > item');
    expect(item.querySelector('title').textContent).toBe(
      '[2026-06-11] 신규 상장 3종, 보수 변동 2종, 점수 급변 1종',
    );
    const guid = item.querySelector('guid');
    expect(guid.textContent).toBe('eiayn-data-update-2026-06-10T21:40:00.000Z');
    expect(guid.getAttribute('isPermaLink')).toBe('false');
    expect(item.querySelector('pubDate').textContent).toBe('Wed, 10 Jun 2026 21:40:00 GMT');
    expect(item.querySelector('link').textContent).toBe(FEED_LINK);
  });

  it('embeds HTML-escaped per-ETF deep links and details in the description', () => {
    const xml = buildFeedXml(null, changesFixture());
    const description = parseXml(xml).querySelector('channel > item > description').textContent;

    // textContent un-escapes the XML layer once, leaving the HTML markup.
    expect(description).toContain(`<a href="${FEED_LINK}?code=449450">PLUS K방산 (449450)</a>`);
    expect(description).toContain('보수 0.15% → 0.09%');
    expect(description).toContain('점수 62 → 71');
    // The HTML layer itself stays escaped: '&' in the ETF name survives the
    // double escape (&amp;amp; in raw XML, &amp; after one un-escape).
    expect(xml).toContain('&amp;amp;');
    expect(description).toContain('Global X S&amp;P 500 Covered Call');
  });

  it('escapes hostile markup in ETF names at both the HTML and XML layers', () => {
    const hostile = changesFixture({
      newListings: [{ id: 'EVIL', name: '<script>alert("x")&\'</script>', market: '미국' }],
      feeChanges: [],
      scoreMoves: [],
    });
    const xml = buildFeedXml(null, hostile);
    const doc = parseXml(xml); // must stay well-formed
    const description = doc.querySelector('channel > item > description').textContent;
    expect(description).not.toContain('<script>');
    expect(description).toContain('&lt;script&gt;alert(&quot;x&quot;)&amp;&apos;&lt;/script&gt;');
  });

  it('describes a run without changes as 변동 없음', () => {
    const quiet = changesFixture({ newListings: [], feeChanges: [], scoreMoves: [] });
    const doc = parseXml(buildFeedXml(null, quiet));
    expect(doc.querySelector('channel > item > title').textContent).toBe('[2026-06-11] 변동 없음');
  });

  it('prepends the new item to previous items and keeps the latest 20', () => {
    let xml = null;
    const runs = FEED_MAX_ITEMS + 5;
    for (let run = 0; run < runs; run += 1) {
      const generatedAt = `2026-05-${String(run + 1).padStart(2, '0')}T21:40:00.000Z`;
      xml = buildFeedXml(xml, changesFixture({ generatedAt }));
    }
    const doc = parseXml(xml);
    const guids = [...doc.querySelectorAll('channel > item > guid')].map(
      (node) => node.textContent,
    );
    expect(guids).toHaveLength(FEED_MAX_ITEMS);
    expect(guids[0]).toBe(`eiayn-data-update-2026-05-${runs}T21:40:00.000Z`);
    expect(guids.at(-1)).toBe('eiayn-data-update-2026-05-06T21:40:00.000Z');
  });

  it('replaces a re-run with the same generatedAt instead of duplicating it', () => {
    const first = buildFeedXml(null, changesFixture());
    const second = buildFeedXml(first, changesFixture());
    const doc = parseXml(second);
    expect(doc.querySelectorAll('channel > item')).toHaveLength(1);
  });

  it('regenerates cleanly when the previous feed is missing or corrupt', () => {
    for (const previous of [null, undefined, '', 'not xml at all', '<rss><channel>', 12345]) {
      const doc = parseXml(buildFeedXml(previous, changesFixture()));
      expect(doc.querySelectorAll('channel > item')).toHaveLength(1);
    }
  });

  it('round-trips its own output: items survive a rebuild byte-identically', () => {
    const first = buildFeedXml(null, changesFixture({ generatedAt: '2026-06-09T21:40:00.000Z' }));
    const second = buildFeedXml(first, changesFixture());
    const firstItem = first.match(/<item>[\s\S]*?<\/item>/g)[0];
    expect(second).toContain(firstItem);
  });

  it('throws a TypeError without a parseable generatedAt', () => {
    expect(() => buildFeedXml(null, null)).toThrow(TypeError);
    expect(() => buildFeedXml(null, changesFixture({ generatedAt: null }))).toThrow(TypeError);
    expect(() => buildFeedXml(null, changesFixture({ generatedAt: 'garbage' }))).toThrow(TypeError);
  });
});

describe('changeSummaryLabel', () => {
  it('joins only the non-empty change groups', () => {
    expect(changeSummaryLabel(changesFixture())).toBe(
      '신규 상장 3종, 보수 변동 2종, 점수 급변 1종',
    );
    expect(changeSummaryLabel(changesFixture({ delisted: [{ id: 'X' }] }))).toBe(
      '신규 상장 3종, 상장 폐지 1종, 보수 변동 2종, 점수 급변 1종',
    );
    expect(
      changeSummaryLabel({ newListings: [], delisted: [], feeChanges: [], scoreMoves: [] }),
    ).toBe('변동 없음');
    expect(changeSummaryLabel(null)).toBe('변동 없음');
  });
});

describe('escapeXml', () => {
  it('escapes the five XML special characters and stringifies nullish input', () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;',
    );
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
    expect(escapeXml(42)).toBe('42');
  });
});
