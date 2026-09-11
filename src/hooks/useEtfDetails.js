import { useEffect, useMemo, useState } from 'react';

export function useEtfDetails(snapshot, ids) {
  const [state, setState] = useState({ version: null, entries: {}, errors: {} });
  const [attempt, setAttempt] = useState(0);
  const key = [...new Set(ids.filter(Boolean))].sort().join(',');
  const version = snapshot?.snapshotVersion;
  const requests = useMemo(() => {
    const wanted = new Set(key.split(','));
    return (snapshot?.etfs ?? []).filter((etf) => wanted.has(etf.id) && etf.detailFile);
  }, [snapshot, key]);

  useEffect(() => {
    if (!version || !requests.length) return undefined;
    const controller = new AbortController();
    setState((current) =>
      current.version === version
        ? { ...current, errors: {} }
        : { version, entries: {}, errors: {} },
    );
    const cached = state.version === version ? state.entries : {};
    requests
      .filter((etf) => !cached[etf.id])
      .forEach(async (etf) => {
        const requestController = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          requestController.abort();
        }, 20_000);
        try {
          if (!/^[a-f0-9]{24}\.json$/.test(etf.detailFile))
            throw new Error('상세 데이터 경로가 올바르지 않습니다.');
          const response = await fetch(
            `${import.meta.env.BASE_URL}runtime-data/${etf.detailFile}`,
            {
              signal: AbortSignal.any([controller.signal, requestController.signal]),
              cache: 'force-cache',
            },
          );
          if (!response.ok)
            throw new Error(`상세 데이터를 불러오지 못했습니다. (${response.status})`);
          const detail = await response.json();
          if (
            detail.snapshotVersion !== version ||
            detail.id !== etf.id ||
            !Array.isArray(detail.holdings) ||
            !Array.isArray(detail.sparkline) ||
            !detail.dataQuality
          )
            throw new Error(
              '목록과 상세 데이터의 버전 또는 형식이 다릅니다. 목록을 새로 불러와 주세요.',
            );
          if (controller.signal.aborted || requestController.signal.aborted) return;
          setState((current) => ({
            version,
            entries: { ...current.entries, [etf.id]: { ...etf, ...detail } },
            errors: { ...current.errors, [etf.id]: null },
          }));
        } catch (error) {
          if (!controller.signal.aborted)
            setState((current) => ({
              ...current,
              errors: {
                ...current.errors,
                [etf.id]: timedOut
                  ? '상세 데이터 요청 시간이 초과되었습니다.'
                  : error instanceof TypeError
                    ? '상세 데이터에 연결하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.'
                    : error.message,
              },
            }));
        } finally {
          clearTimeout(timer);
        }
      });
    return () => controller.abort();
    // 완료된 항목을 캐시에 합칠 때 진행 중인 다른 요청을 재시작하지 않습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, requests, attempt]);

  const entries = state.version === version ? state.entries : {};
  const errors =
    state.version === version ? requests.map((etf) => state.errors[etf.id]).filter(Boolean) : [];
  return {
    entries,
    ready: requests.every((etf) => entries[etf.id]),
    error: errors[0] ?? null,
    retry: () => setAttempt((value) => value + 1),
  };
}
