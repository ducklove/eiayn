import { useEffect, useState } from 'react';

// Lazy loader for optional secondary data files (history.json, changes.json).
// A missing file (404 on first deploys) resolves to data:null without error noise.
export function useDataFile(filename) {
  const [state, setState] = useState({ data: null, loading: true });

  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true });
    fetch(`${import.meta.env.BASE_URL}data/${filename}`, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((data) => {
        if (alive) setState({ data, loading: false });
      });
    return () => {
      alive = false;
    };
  }, [filename]);

  return state;
}
