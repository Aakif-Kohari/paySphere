import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export default {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    isOpen: { control: 'boolean' },
    title: { control: 'text' },
    maxWidth: { control: 'text' },
    closeOnBackdropClick: { control: 'boolean' },
    onClose: { action: 'closed' },
  },
};

const ModalTemplate = (args) => {
  const [isOpen, setIsOpen] = useState(args.isOpen || false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal
        {...args}
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          args.onClose && args.onClose();
        }}
      >
        <p className="text-text-secondary">
          This is the modal body content. It can contain text, forms, or any
          other elements.
        </p>
      </Modal>
    </div>
  );
};

export const Default = ModalTemplate.bind({});
Default.args = {
  title: 'Confirmation Required',
  isOpen: false,
  footer: (
    <div className="flex justify-end gap-3">
      <Button variant="outline">Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </div>
  ),
};

export const UnclosableBackdrop = ModalTemplate.bind({});
UnclosableBackdrop.args = {
  title: 'Critical Action',
  isOpen: false,
  closeOnBackdropClick: false,
  footer: (
    <div className="flex justify-end gap-3">
      <Button variant="outline">Close</Button>
      <Button variant="danger">Delete Permanently</Button>
    </div>
  ),
};
