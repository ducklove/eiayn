import { useCallback, useEffect, useRef, useState } from 'react';

export function useEtfData() {
  const requestRef = useRef(null);
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20_000);
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}runtime-data/catalog.json`, {
        // no-cache still revalidates with the server (ETag/304) instead of
        // re-downloading the full snapshot on every visit like no-store did.
        cache: 'no-cache',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`데이터 스냅샷을 불러오지 못했습니다. (${response.status})`);
      }
      const data = await response.json();
      if (data?.snapshotVersion && Array.isArray(data.etfs)) {
        data.etfs = data.etfs.map((etf) => ({
          ...etf,
          holdings: Array.isArray(etf?.searchHoldings)
            ? etf.searchHoldings.map(([name, ticker]) => ({ name, ticker }))
            : null,
        }));
      }
      if (
        !Array.isArray(data?.etfs) ||
        !data.etfs.length ||
        !data.etfs.every(
          (etf) =>
            etf &&
            typeof etf.id === 'string' &&
            typeof etf.name === 'string' &&
            Array.isArray(etf.holdings) &&
            etf.returns &&
            etf.risk &&
            etf.dataQuality,
        )
      ) {
        throw new Error('ETF 데이터가 비어 있거나 형식이 올바르지 않습니다. 다시 시도해 주세요.');
      }
      if (controller.signal.aborted) return;
      setState({ data, loading: false, error: null });
    } catch (error) {
      if (requestRef.current !== controller || (controller.signal.aborted && !timedOut)) return;
      setState({
        data: null,
        loading: false,
        error: timedOut
          ? new Error('데이터 요청 시간이 초과되었습니다. 연결을 확인하고 다시 시도해 주세요.')
          : error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}
