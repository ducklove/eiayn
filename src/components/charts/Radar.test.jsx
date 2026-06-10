// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Radar } from './Radar.jsx';

const FULL_FACTORS = {
  '단기 수익': 70,
  '장기 수익': 75,
  가치: 60,
  안정성: 80,
  분산: 90,
  효율성: 85,
};

afterEach(cleanup);

describe('Radar', () => {
  it('renders an svg with four grid polygons and one shape polygon', () => {
    const { container } = render(<Radar factors={FULL_FACTORS} />);
    expect(screen.getByLabelText('AIYN 팩터 레이더').tagName.toLowerCase()).toBe('svg');
    expect(container.querySelectorAll('polygon.radar-grid')).toHaveLength(4);
    expect(container.querySelectorAll('polygon.radar-shape')).toHaveLength(1);
  });

  it('renders one axis label and shape point per numeric factor', () => {
    const { container } = render(<Radar factors={FULL_FACTORS} />);
    for (const label of Object.keys(FULL_FACTORS)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    const shape = container.querySelector('polygon.radar-shape');
    expect(shape.getAttribute('points').split(' ')).toHaveLength(6);
  });

  it('excludes the 총보수 factor from the axes', () => {
    const { container } = render(<Radar factors={{ ...FULL_FACTORS, 총보수: 40 }} />);
    expect(screen.queryByText('총보수')).toBeNull();
    const shape = container.querySelector('polygon.radar-shape');
    expect(shape.getAttribute('points').split(' ')).toHaveLength(6);
  });

  it('ignores non-numeric factor values', () => {
    render(<Radar factors={{ 가치: 50, 안정성: null, 분산: '70' }} />);
    expect(screen.getByText('가치')).toBeTruthy();
    expect(screen.queryByText('안정성')).toBeNull();
    expect(screen.queryByText('분산')).toBeNull();
  });

  it('falls back to six zeroed axes when no factors remain', () => {
    const { container } = render(<Radar factors={{}} />);
    for (const label of ['단기 수익', '장기 수익', '가치', '안정성', '분산', '효율성']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    const shape = container.querySelector('polygon.radar-shape');
    expect(shape.getAttribute('points')).toBe('96,76 96,76 96,76 96,76 96,76 96,76');
  });

  it('falls back to zeroed axes when only 총보수 is numeric', () => {
    const { container } = render(<Radar factors={{ 총보수: 55 }} />);
    expect(screen.queryByText('총보수')).toBeNull();
    const shape = container.querySelector('polygon.radar-shape');
    expect(shape.getAttribute('points')).toBe('96,76 96,76 96,76 96,76 96,76 96,76');
  });
});
