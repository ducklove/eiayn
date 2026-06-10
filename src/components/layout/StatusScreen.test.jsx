// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StatusScreen } from './StatusScreen.jsx';

afterEach(cleanup);

describe('StatusScreen', () => {
  it('renders the brand mark, title, and message', () => {
    render(<StatusScreen title="데이터 로딩 중" message="잠시만 기다려주세요." />);
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '데이터 로딩 중' })).toBeTruthy();
    expect(screen.getByText('잠시만 기다려주세요.')).toBeTruthy();
  });

  it('renders the optional action node', () => {
    render(
      <StatusScreen
        title="불러오기 실패"
        message="네트워크 상태를 확인해주세요."
        action={<button type="button">다시 시도</button>}
      />,
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });

  it('renders no button when no action is given', () => {
    render(<StatusScreen title="데이터 로딩 중" message="잠시만 기다려주세요." />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
