import { useCallback, useEffect, useState } from 'react';

export function useEtfData() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/etfs.json`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`데이터 스냅샷을 불러오지 못했습니다. (${response.status})`);
      }
      const data = await response.json();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
