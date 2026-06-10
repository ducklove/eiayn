import { useEffect } from 'react';

const BASE_TITLE = 'ETF is All You Need';

// Keeps the browser tab title in sync with the active view. Null-safe: while
// no ETF is selected the analysis view falls back to the base title.
export function useDocumentTitle(viewMode, selectedEtf) {
  const shortName = selectedEtf?.shortName ?? null;

  useEffect(() => {
    if (viewMode === 'analysis' && shortName) {
      document.title = `${shortName} 분석 — ${BASE_TITLE}`;
    } else if (viewMode === 'list') {
      document.title = `전체 목록 — ${BASE_TITLE}`;
    } else {
      document.title = BASE_TITLE;
    }
  }, [viewMode, shortName]);
}
