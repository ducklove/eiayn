// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Sparkline } from './Sparkline.jsx';

afterEach(cleanup);

function renderedPlaceholder(container) {
  return container.querySelector('.sparkline-placeholder');
}

describe('Sparkline', () => {
  it.each([[undefined], [[]], [[5]], [[3, null, '4']]])(
    'renders a dash placeholder when fewer than two numeric points exist (%j)',
    (values) => {
      const { container } = render(<Sparkline values={values} />);
      expect(renderedPlaceholder(container).textContent).toBe('-');
      expect(container.querySelector('svg')).toBeNull();
    },
  );

  it('renders a polyline scaled to the value range', () => {
    const { container } = render(<Sparkline values={[0, 5, 10]} />);
    expect(renderedPlaceholder(container)).toBeNull();
    const polyline = container.querySelector('svg.sparkline polyline');
    expect(polyline.getAttribute('points')).toBe('2,34 45,21 88,8');
  });

  it('skips non-numeric points while keeping the numeric ones', () => {
    const { container } = render(<Sparkline values={[1, null, 2]} />);
    const polyline = container.querySelector('polyline');
    expect(polyline.getAttribute('points')).toBe('2,34 88,8');
  });

  it('renders a flat line for constant values', () => {
    const { container } = render(<Sparkline values={[5, 5]} />);
    const polyline = container.querySelector('polyline');
    expect(polyline.getAttribute('points')).toBe('2,34 88,34');
  });

  it('hides the chart from assistive technology', () => {
    const { container } = render(<Sparkline values={[1, 2]} />);
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });
});
