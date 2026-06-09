import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/retroui/Sonner';
import { toast } from 'sonner';

beforeAll(() => {
  HTMLElement.prototype.setPointerCapture ??= vi.fn();
  HTMLElement.prototype.releasePointerCapture ??= vi.fn();
});

function ToastHarness({ onUndo }: { onUndo: () => void }) {
  return (
    <button
      type="button"
      onClick={() => toast.success('Pinned item', {
        action: {
          label: 'Undo',
          onClick: onUndo,
        },
      })}
    >
      Show toast
    </button>
  );
}

describe('RetroUI Sonner', () => {
  it('renders toasts and supports action buttons', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();

    render(
      <>
        <ToastHarness onUndo={onUndo} />
        <Toaster />
      </>
    );

    await user.click(screen.getByRole('button', { name: /show toast/i }));

    await user.click(await screen.findByRole('button', { name: /undo/i }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
