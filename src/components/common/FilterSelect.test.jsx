// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilterSelect } from './FilterSelect.jsx';

afterEach(cleanup);

describe('FilterSelect', () => {
  it('renders the label and one option per entry', () => {
    render(
      <FilterSelect label="시장" value="전체" options={['전체', 'KR', 'US']} onChange={() => {}} />,
    );
    expect(screen.getByText('시장')).toBeTruthy();
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['전체', 'KR', 'US']);
  });

  it('reflects the controlled value', () => {
    render(
      <FilterSelect label="시장" value="KR" options={['전체', 'KR', 'US']} onChange={() => {}} />,
    );
    expect(screen.getByRole('combobox').value).toBe('KR');
  });

  it('calls onChange with the newly selected value', () => {
    const onChange = vi.fn();
    render(
      <FilterSelect label="시장" value="전체" options={['전체', 'KR', 'US']} onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'US' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('US');
  });
});
