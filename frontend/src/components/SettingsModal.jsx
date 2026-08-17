import Modal from './common/Modal';

const SettingsModal = ({ open, onClose, children }) => {
  return (
    <Modal open={open} onClose={onClose} title="Settings">
      {children}
    </Modal>
  );
};

export default SettingsModal;
