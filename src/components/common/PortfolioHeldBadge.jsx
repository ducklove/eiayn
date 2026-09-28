// The shared script owns children of this empty host; React owns only its attributes.
export function PortfolioHeldBadge({ etf }) {
  return (
    <span
      data-portfolio-code={etf.id}
      data-portfolio-aliases={[etf.ticker, etf.yahooSymbol, ...(etf.aliases ?? [])]
        .filter(Boolean)
        .join(',')}
      data-portfolio-price={etf.price ?? undefined}
      data-portfolio-currency={etf.currency || 'UNKNOWN'}
    />
  );
}
