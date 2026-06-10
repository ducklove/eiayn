// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuideModal } from './GuideModal.jsx';

afterEach(cleanup);

describe('GuideModal', () => {
  it('renders the guide dialog', () => {
    const { container } = render(<GuideModal onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: '사용 가이드' })).toBeTruthy();
    expect(container.querySelectorAll('.guide-content p').length).toBeGreaterThan(0);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<GuideModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onClose = vi.fn();
    render(<GuideModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops listening for Escape after unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<GuideModal onClose={onClose} />);
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<GuideModal onClose={onClose} />);
    fireEvent.click(container.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the modal content is clicked', () => {
    const onClose = vi.fn();
    render(<GuideModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('heading', { name: '사용 가이드' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<GuideModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
