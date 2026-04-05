import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ConfirmDeleteParentModal } from './ConfirmDeleteParentModal';

describe('ConfirmDeleteParentModal', () => {
  it('should render nothing when isOpen is false', () => {
    render(
      <ConfirmDeleteParentModal
        isOpen={false}
        childCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Delete Task with Sub-Tasks')).not.toBeInTheDocument();
  });

  it('should render the modal when isOpen is true', () => {
    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Delete Task with Sub-Tasks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete All' })).toBeInTheDocument();
  });

  it('should show the child task count in the message', () => {
    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={7}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/sub-tasks/)).toBeInTheDocument();
  });

  it('should use singular "sub-task" when childCount is 1', () => {
    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={1}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    const message = screen.getByText(/This will delete the parent task/);
    expect(message.textContent).toMatch(/\bsub-task\b/);
    expect(message.textContent).not.toMatch(/sub-tasks/);
  });

  it('should use plural "sub-tasks" when childCount is greater than 1', () => {
    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={4}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const message = screen.getByText(/This will delete the parent task/);
    expect(message.textContent).toMatch(/sub-tasks/);
  });

  it('should show an undoable-action warning', () => {
    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('should call onConfirm when "Delete All" is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={3}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete All' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when "Delete All" is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={3}
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete All' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when "Cancel" is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={3}
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
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={3}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should have red/destructive styling on the "Delete All" button', () => {
    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete All' });
    expect(deleteButton.className).toMatch(/bg-red/);
  });

  it('should include a confirmation question in the message', () => {
    render(
      <ConfirmDeleteParentModal
        isOpen={true}
        childCount={3}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Are you sure\?/)).toBeInTheDocument();
  });
});
