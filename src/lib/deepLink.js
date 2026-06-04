export function findEtfByCode(etfs, code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  return etfs.find((etf) => etfCodes(etf).some((candidate) => normalizeCode(candidate) === normalized)) ?? null;
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
  const defaultIds = etfs.slice(0, 3).map((etf) => etf.id);
  const baseIds = compareIds.length ? compareIds : defaultIds;
  const selectedIds = codeEtf
    ? uniqueIds([codeEtf.id, ...baseIds]).slice(0, maxSelected)
    : baseIds;
  const activeId = codeEtf?.id
    ?? (activeEtf && selectedIds.includes(activeEtf.id) ? activeEtf.id : selectedIds[0]);

  return {
    selectedIds,
    activeId,
    requestedCode: params.get('code')?.trim() || null,
    matchedCodeId: codeEtf?.id ?? null,
  };
}

function etfCodes(etf) {
  return [
    etf.id,
    etf.ticker,
    etf.yahooSymbol,
    ...(etf.aliases ?? []),
  ].filter(Boolean);
}

function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

function uniqueIds(ids) {
  return Array.from(new Set(ids));
}
