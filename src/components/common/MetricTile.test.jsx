// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MetricTile } from './MetricTile.jsx';

afterEach(cleanup);

describe('MetricTile', () => {
  it('renders the label and value', () => {
    render(<MetricTile label="1년 수익률" value="+11.20%" />);
    expect(screen.getByText('1년 수익률').tagName).toBe('SPAN');
    expect(screen.getByText('+11.20%').tagName).toBe('STRONG');
  });

  it('applies the tone modifier class', () => {
    const { container } = render(<MetricTile label="등락" value="-0.50%" tone="negative" />);
    expect(container.firstChild.classList.contains('metric-tile')).toBe(true);
    expect(container.firstChild.classList.contains('tone-negative')).toBe(true);
  });

  it('omits the tone class when no tone is given', () => {
    const { container } = render(<MetricTile label="AUM" value="₩5T" />);
    expect(Array.from(container.firstChild.classList)).toEqual(['metric-tile']);
  });
});
