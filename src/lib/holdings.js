export const HOLDING_COLORS = ['#0f3761', '#e06f42', '#2fbf71', '#7b8794', '#f2b84b', '#009b7d', '#4f77be', '#b66dff', '#d44949', '#667588'];

export const OTHER_HOLDING_COLOR = '#c9d1d9';

export function buildHoldingChart(holdings) {
  const totalWeight = holdings.reduce((sum, holding) => sum + (holding.weight ?? 0), 0);
  const otherWeight = Math.max(0, 100 - totalWeight);
  const state = holdings.reduce((acc, holding, index) => {
    const start = acc.total;
    const end = start + (holding.weight ?? 0);
    acc.stops.push(`${HOLDING_COLORS[index % HOLDING_COLORS.length]} ${start}% ${end}%`);
    acc.total = end;
    return acc;
  }, { stops: [], total: 0 });

  state.stops.push(`${OTHER_HOLDING_COLOR} ${state.total}% ${state.total + otherWeight}%`);
  return { stops: state.stops, otherWeight };
}
