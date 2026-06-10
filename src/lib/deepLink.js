export function findEtfByCode(etfs, code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  return (
    etfs.find((etf) =>
      etfCodes(etf).some((candidate) => normalizeCode(candidate) === normalized),
    ) ?? null
  );
}

export function resolveInitialSelection(etfs, params, maxSelected = 4) {
  const compareIds = uniqueIds(
    (params.get('compare') ?? '')
      .split(',')
      .map((code) => findEtfByCode(etfs, code)?.id)
      .filter(Boolean),
  ).slice(0, maxSelected);

  const codeEtf = findEtfByCode(etfs, params.get('code'));
  const activeEtf = findEtfByCode(etfs, params.get('active'));
  const defaultIds = etfs.slice(0, Math.min(3, maxSelected)).map((etf) => etf.id);
  const selectedIds = codeEtf ? [codeEtf.id] : compareIds.length ? compareIds : defaultIds;
  const activeId =
    codeEtf?.id ??
    (activeEtf && selectedIds.includes(activeEtf.id) ? activeEtf.id : selectedIds[0]) ??
    null;
  const requestedView = params.get('view')?.trim().toLowerCase();
  const viewMode =
    params.get('code') || requestedView === 'analysis'
      ? 'analysis'
      : requestedView === 'list'
        ? 'list'
        : 'compare';

  return {
    selectedIds,
    activeId,
    viewMode,
    requestedCode: params.get('code')?.trim() || null,
    matchedCodeId: codeEtf?.id ?? null,
  };
}

function etfCodes(etf) {
  return [etf.id, etf.ticker, etf.yahooSymbol, ...(etf.aliases ?? [])].filter(Boolean);
}

function normalizeCode(code) {
  return String(code ?? '')
    .trim()
    .toUpperCase();
}

function uniqueIds(ids) {
  return Array.from(new Set(ids));
}
