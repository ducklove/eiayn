export function getSortValue(etf, key) {
  const value = key.split('.').reduce((current, part) => current?.[part], etf);
  return value ?? null;
}

export function sortEtfs(etfs, key, direction = 'desc') {
  const factor = direction === 'asc' ? 1 : -1;
  return etfs.slice().sort((a, b) => {
    const left = getSortValue(a, key);
    const right = getSortValue(b, key);
    // Missing values always sink to the bottom, regardless of direction.
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left).localeCompare(String(right), 'ko') * factor;
    }
    return (left - right) * factor;
  });
}
