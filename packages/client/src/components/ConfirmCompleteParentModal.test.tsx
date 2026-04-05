import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ConfirmCompleteParentModal } from './ConfirmCompleteParentModal';

describe('ConfirmCompleteParentModal', () => {
  it('should render nothing when isOpen is false', () => {
    render(
      <ConfirmCompleteParentModal
        isOpen={false}
        incompleteCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Complete Task with Sub-Tasks')).not.toBeInTheDocument();
  });

  it('should render the modal when isOpen is true', () => {
    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Complete Task with Sub-Tasks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete All' })).toBeInTheDocument();
  });

  it('should show the incomplete sub-task count in the message', () => {
    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={5}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/sub-tasks/)).toBeInTheDocument();
  });

  it('should use singular "sub-task" when incompleteCount is 1', () => {
    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={1}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    // Should say "sub-task" not "sub-tasks"
    const message = screen.getByText(/This will complete the parent task/);
    expect(message.textContent).toMatch(/\bsub-task\b/);
    expect(message.textContent).not.toMatch(/sub-tasks/);
  });

  it('should use plural "sub-tasks" when incompleteCount is greater than 1', () => {
    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const message = screen.getByText(/This will complete the parent task/);
    expect(message.textContent).toMatch(/sub-tasks/);
  });

  it('should call onConfirm when "Complete All" is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={3}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Complete All' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when "Complete All" is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={3}
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Complete All' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when "Cancel" is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={3}
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should NOT call onConfirm when "Cancel" is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={3}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should have blue styling on the "Complete All" button', () => {
    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const confirmButton = screen.getByRole('button', { name: 'Complete All' });
    expect(confirmButton.className).toMatch(/bg-blue/);
  });

  it('should include a confirmation question in the message', () => {
    render(
      <ConfirmCompleteParentModal
        isOpen={true}
        incompleteCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Are you sure\?/)).toBeInTheDocument();
  });
});
