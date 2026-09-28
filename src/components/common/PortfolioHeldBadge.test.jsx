// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PortfolioHeldBadge } from './PortfolioHeldBadge.jsx';

it('preserves external badge children when quotes, currency and ETF selection change', () => {
  const etf = { id: 'SCHP', ticker: 'SCHP', aliases: ['SCHP.K'], price: 20, currency: 'USD' };
  const { container, rerender, unmount } = render(<PortfolioHeldBadge etf={etf} />);
  const host = container.firstElementChild;
  const badge = document.createElement('span');
  badge.textContent = '보유';
  host.appendChild(badge);
  expect(host.dataset.portfolioAliases).toBe('SCHP,SCHP.K');
  rerender(<PortfolioHeldBadge etf={{ ...etf, price: 21 }} />);
  expect(host.dataset.portfolioPrice).toBe('21');
  expect(host.dataset.portfolioCurrency).toBe('USD');
  expect(host.firstElementChild).toBe(badge);
  rerender(<PortfolioHeldBadge etf={{ id: '069500', currency: 'KRW' }} />);
  expect(host.dataset.portfolioCode).toBe('069500');
  expect(host.dataset.portfolioCurrency).toBe('KRW');
  expect(host.hasAttribute('data-portfolio-price')).toBe(false);
  unmount();
});
