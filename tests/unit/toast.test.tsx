import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '@/components/ui/toast';

function ToastHarness({ onUndo }: { onUndo: () => void }) {
  const { toast } = useToast();

  return (
    <button
      type="button"
      onClick={() => toast('Pinned item', 'success', {
        actionLabel: 'Undo',
        onAction: onUndo,
      })}
    >
      Show toast
    </button>
  );
}

describe('ToastProvider', () => {
  it('renders toasts above modal layers and supports action buttons', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();

    render(
      <ToastProvider>
        <ToastHarness onUndo={onUndo} />
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /show toast/i }));

    const toastViewport = screen.getByTestId('toast-viewport');
    expect(toastViewport.className).toContain('z-[300]');

    await user.click(screen.getByRole('button', { name: /undo/i }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
