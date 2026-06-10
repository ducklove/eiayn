// Simple, honest cost estimate: amount × expense ratio × years, no compounding
// and no return assumptions. The UI must state this assumption next to the result.
export function estimateHoldingCost({ amount, years, expenseRatio }) {
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    typeof years !== 'number' ||
    !Number.isFinite(years) ||
    years <= 0 ||
    typeof expenseRatio !== 'number' ||
    !Number.isFinite(expenseRatio) ||
    expenseRatio < 0
  ) {
    return null;
  }
  const annual = amount * (expenseRatio / 100);
  return {
    annual,
    total: annual * years,
  };
}
