// 휴장일을 추정하거나 가격을 보간하지 않고 실제 관측일의 교집합만 비교합니다.
export function datedPerformance(performance) {
  const dates = performance?.dates;
  const values = performance?.values;
  if (!Array.isArray(dates) || !Array.isArray(values) || dates.length !== values.length)
    return null;
  if (
    !dates.every(
      (date, i) =>
        typeof date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Number.isFinite(Date.parse(date)) &&
        new Date(date).toISOString().slice(0, 10) === date &&
        (i === 0 || date > dates[i - 1]) &&
        Number.isFinite(values[i]) &&
        values[i] > 0,
    )
  )
    return null;
  return dates.length >= 2 ? new Map(dates.map((date, i) => [date, values[i]])) : null;
}

export function buildOverlaySeries(etfs) {
  const available = etfs
    .map((etf) => ({ etf, points: datedPerformance(etf.performance1y) }))
    .filter(({ points }) => points);
  if (available.length < 2) return null;
  const dates = [...available[0].points.keys()].filter((date) =>
    available.every(({ points }) => points.has(date)),
  );
  if (dates.length < 2) return null;
  const series = available.map(({ etf, points }) => {
    const base = points.get(dates[0]);
    const values = dates.map((date) => (points.get(date) / base) * 100);
    return { id: etf.id, label: etf.shortName, values, changePercent: values.at(-1) - 100 };
  });
  const all = series.flatMap((item) => item.values);
  return {
    series,
    dates,
    window: dates.length,
    start: dates[0],
    end: dates.at(-1),
    excluded: etfs
      .filter((etf) => !available.some((item) => item.etf.id === etf.id))
      .map((etf) => etf.shortName ?? etf.id),
    min: Math.min(...all),
    max: Math.max(...all),
  };
}
