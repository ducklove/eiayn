// Aligns the compared ETFs' weekly performance series onto a common recent
// window and re-normalizes each to 100 at the window start so the overlay
// lines are directly comparable.
export function buildOverlaySeries(etfs) {
  const withData = etfs.filter((etf) => (etf.performance1y?.values?.length ?? 0) >= 2);
  if (withData.length < 2) return null;

  const window = Math.min(...withData.map((etf) => etf.performance1y.values.length));
  const series = withData.map((etf) => {
    const values = etf.performance1y.values.slice(-window);
    const base = values[0];
    const normalized = values.map((value) => (value / base) * 100);
    return {
      id: etf.id,
      label: etf.shortName,
      values: normalized,
      changePercent: normalized.at(-1) - 100,
    };
  });

  const all = series.flatMap((item) => item.values);
  return {
    series,
    window,
    min: Math.min(...all),
    max: Math.max(...all),
  };
}
