import React, { useState } from 'react';
import Icon from '../../../../../components/Icon';

interface ItemOverviewHeaderProps {
  name: string;
  onSaveName: (name: string) => Promise<void>;
  onOpenAddUrlModal: () => void;
  onOpenAttachModal: () => void;
  onRefreshAll: () => Promise<void>;
}

export const ItemOverviewHeader: React.FC<ItemOverviewHeaderProps> = ({
  name,
  onSaveName,
  onOpenAddUrlModal,
  onOpenAttachModal,
  onRefreshAll,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const handleNameSave = async () => {
    if (!nameInput.trim()) return;
    setIsSavingName(true);
    try {
      await onSaveName(nameInput.trim());
      setIsEditingName(false);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleRefreshAllClick = async () => {
    setIsRefreshingAll(true);
    try {
      await onRefreshAll();
    } finally {
      setIsRefreshingAll(false);
    }
  };

  return (
    <div className="item-detail-header-card">
      <div className="item-detail-title-group">
        {isEditingName ? (
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto' }}>
            <input
              type="text"
              className="form-control"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              autoFocus
              style={{ fontSize: '1.25rem', fontWeight: 700 }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleNameSave}
              disabled={isSavingName}
            >
              {isSavingName ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEditingName(false)}
              disabled={isSavingName}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h1 className="item-detail-title">{name}</h1>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setNameInput(name);
                setIsEditingName(true);
              }}
              title="Edit product name"
              style={{ padding: '0.35rem 0.5rem' }}
            >
              <Icon name="edit" />
            </button>
          </>
        )}
      </div>

      <div className="item-detail-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onOpenAddUrlModal}
          title="Track a new store URL for this product"
        >
          <Icon name="shoppingBag" /> Track New Store
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onOpenAttachModal}
          title="Attach a store you are already tracking to this product"
        >
          <Icon name="link" /> Link Existing Store
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleRefreshAllClick}
          disabled={isRefreshingAll}
          title="Refresh all store prices now"
        >
          <Icon name="refresh" /> {isRefreshingAll ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>
    </div>
  );
};
