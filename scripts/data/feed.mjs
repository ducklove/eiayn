// RSS 2.0 update feed (public/data/feed.xml).
//
// buildFeedXml(previousXml, changes) prepends one <item> per refresh run,
// summarizing the diffSnapshots() result with per-ETF deep links, and keeps
// the latest FEED_MAX_ITEMS items. Existing items are recovered from the
// previous feed text with a naive-but-safe regex (the feed is always written
// by this module, and escaped content can never contain a raw '<'); a
// missing or corrupt previous feed regenerates cleanly from scratch. Pure.

import { seoulDateOf } from './history.mjs';

export const FEED_MAX_ITEMS = 20;
export const FEED_TITLE = 'ETF is All You Need — 데이터 업데이트';
export const FEED_LINK = 'https://ducklove.github.io/eiayn/';
export const FEED_DESCRIPTION =
  'EIAYN 데이터 갱신마다 신규 상장, 상장 폐지, 보수 변동, AIYN 점수 급변을 요약합니다.';

const ITEM_PATTERN = /<item>[\s\S]*?<\/item>/g;

/**
 * Returns the full feed.xml text with a new item for `changes` (the
 * diffSnapshots() output) prepended to the items recovered from
 * `previousXml`. Throws TypeError when changes.generatedAt is missing
 * (callers wrap feed generation non-fatally).
 */
export function buildFeedXml(previousXml, changes) {
  const generatedAt = changes?.generatedAt;
  const pubDate = new Date(Date.parse(typeof generatedAt === 'string' ? generatedAt : ''));
  if (Number.isNaN(pubDate.getTime())) {
    throw new TypeError('buildFeedXml: changes.generatedAt must be an ISO datetime');
  }

  const guid = `eiayn-data-update-${generatedAt}`;
  const newItem = renderItem({
    title: itemTitle(changes, generatedAt),
    guid,
    pubDate: pubDate.toUTCString(),
    descriptionHtml: itemDescriptionHtml(changes),
  });

  const previousItems = parseItems(previousXml).filter(
    (item) => !item.includes(`>${escapeXml(guid)}<`),
  );
  const items = [newItem, ...previousItems].slice(0, FEED_MAX_ITEMS);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(FEED_TITLE)}</title>`,
    `    <link>${escapeXml(FEED_LINK)}</link>`,
    `    <description>${escapeXml(FEED_DESCRIPTION)}</description>`,
    '    <language>ko</language>',
    `    <lastBuildDate>${escapeXml(pubDate.toUTCString())}</lastBuildDate>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

/** Counts summary, e.g. '신규 상장 3종, 보수 변동 2종, 점수 급변 5종'. */
export function changeSummaryLabel(changes) {
  const parts = [
    [changes?.newListings, '신규 상장'],
    [changes?.delisted, '상장 폐지'],
    [changes?.feeChanges, '보수 변동'],
    [changes?.scoreMoves, '점수 급변'],
  ]
    .filter(([list]) => Array.isArray(list) && list.length > 0)
    .map(([list, label]) => `${label} ${list.length}종`);
  return parts.length ? parts.join(', ') : '변동 없음';
}

export function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function itemTitle(changes, generatedAt) {
  const date = seoulDateOf(generatedAt);
  return `${date ? `[${date}] ` : ''}${changeSummaryLabel(changes)}`;
}

function itemDescriptionHtml(changes) {
  const sections = [
    `<p>${escapeXml(changeSummaryLabel(changes))}</p>`,
    sectionHtml('신규 상장', changes?.newListings, (etf) => marketSuffix(etf)),
    sectionHtml('상장 폐지', changes?.delisted, (etf) => marketSuffix(etf)),
    sectionHtml('보수 변동', changes?.feeChanges, (etf) => ` 보수 ${etf.from}% → ${etf.to}%`),
    sectionHtml('점수 급변', changes?.scoreMoves, (etf) => ` 점수 ${etf.from} → ${etf.to}`),
  ];
  return sections.filter(Boolean).join('');
}

function sectionHtml(label, entries, detail) {
  if (!Array.isArray(entries) || !entries.length) return '';
  const items = entries
    .map((entry) => `<li>${etfLinkHtml(entry)}${escapeXml(detail(entry))}</li>`)
    .join('');
  return `<h4>${escapeXml(label)}</h4><ul>${items}</ul>`;
}

function etfLinkHtml(entry) {
  const href = `${FEED_LINK}?code=${encodeURIComponent(entry.id)}`;
  const label = entry.name ? `${entry.name} (${entry.id})` : entry.id;
  return `<a href="${escapeXml(href)}">${escapeXml(label)}</a>`;
}

function marketSuffix(etf) {
  return etf.market ? ` — ${etf.market}` : '';
}

function renderItem({ title, guid, pubDate, descriptionHtml }) {
  return [
    '    <item>',
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(FEED_LINK)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(guid)}</guid>`,
    `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
    `      <description>${escapeXml(descriptionHtml)}</description>`,
    '    </item>',
  ].join('\n');
}

function parseItems(previousXml) {
  if (typeof previousXml !== 'string' || !previousXml.includes('<rss')) return [];
  const blocks = previousXml.match(ITEM_PATTERN) ?? [];
  return blocks.map(reindentItem);
}

// Previous items are re-emitted verbatim except for whitespace, which is
// normalized so the regenerated document keeps a consistent layout.
function reindentItem(block) {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines
    .map((line, index) =>
      index === 0 || index === lines.length - 1 ? `    ${line}` : `      ${line}`,
    )
    .join('\n');
}
