// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary.jsx';

function Boom() {
  throw new Error('boom');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>정상 화면</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('정상 화면')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '새로고침' })).toBeNull();
  });

  it('renders the fallback with a 새로고침 button when a child throws', () => {
    // React logs the thrown error (and componentDidCatch logs again); keep test output clean.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // React (dev) also replays the error as a window error event, which jsdom
    // reports as an uncaught exception unless the event is cancelled.
    const swallowWindowError = (event) => event.preventDefault();
    window.addEventListener('error', swallowWindowError);
    try {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );
    } finally {
      window.removeEventListener('error', swallowWindowError);
    }
    expect(
      screen.getByRole('heading', { level: 1, name: '화면을 그리는 중 문제가 발생했습니다' }),
    ).toBeTruthy();
    expect(screen.getByText(/새로고침으로 다시 시도해주세요/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeTruthy();
    expect(screen.queryByText('정상 화면')).toBeNull();
    expect(errorSpy.mock.calls.some((call) => call[0] === '[eiayn] render error')).toBe(true);
  });
});
