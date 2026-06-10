import { useEffect, useRef, useState } from 'react';

export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const skipFirstWrite = useRef(true);

  useEffect(() => {
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota and privacy-mode failures; UI state still works in memory.
    }
  }, [key, value]);

  return [value, setValue];
}
