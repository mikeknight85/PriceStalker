import React from 'react';
import Modal from '../Modal';
import LoadingSpinner from '../LoadingSpinner';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => any;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  isLoading = false,
}) => {
  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
        {cancelText}
      </button>
      <button 
        className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} 
        onClick={async () => {
          try {
            await onConfirm();
            onClose();
          } catch (err) {
            // Error is handled by the confirm action
          }
        }}
        disabled={isLoading}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '100px', gap: '0.5rem' }}
      >
        {isLoading && <LoadingSpinner size="1rem" />}
        <span>{confirmText}</span>
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} maxWidth="400px">
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
};

export default ConfirmationModal;
