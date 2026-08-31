import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RetailerConfig, GlobalCurrency } from '../../../../types/api';
import RetailerConfigEditor from './RetailerConfigEditor';
import Icon from '../../../../components/Icon';
import { queryClient } from '../../../../api/queryClient';
import { adminRetailersQuery } from '../../../../api/queries';

interface RetailersSectionProps {
  globalCurrencies: GlobalCurrency[];
  initialSearch?: string;
}

export default function RetailersSection({ globalCurrencies, initialSearch }: RetailersSectionProps) {
  const [retailerSearch, setRetailerSearch] = useState(initialSearch || '');
  const [editingRetailer, setEditingRetailer] = useState<Partial<RetailerConfig> | null>(null);
  const retailersResult = useQuery(adminRetailersQuery());
  const retailers = retailersResult.data ?? [];

  const handleEditRetailer = (r: Partial<RetailerConfig>) => {
    setEditingRetailer(r);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddRetailer = () => {
    handleEditRetailer({ 
      domain: '', 
      name: '',
      status: 'OK',
      use_proxy: false, 
      use_browser_scraper: false,
      currency_hint: null,
      active: true,
      description: ''
    });
  };

  const handleSave = () => {
    setEditingRetailer(null);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'retailers'] });
  };

  const handleCancel = () => {
    setEditingRetailer(null);
  };

  const handleDelete = () => {
    setEditingRetailer(null);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'retailers'] });
  };

  return (
    <div className="admin-section-wrapper">
      {retailersResult.isError && <div className="alert alert-error">Failed to load retailers. <button className="btn btn-secondary btn-sm" onClick={() => void retailersResult.refetch()}>Retry</button></div>}
      <div className="settings-card" style={{ marginBottom: editingRetailer ? '2rem' : '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 className="settings-card-title" style={{ margin: 0 }}>Retailers</h2>
          {!editingRetailer && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: '1', justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '150px', maxWidth: '300px', flex: '1' }}>
                <input 
                  type="text" 
                  className="form-control btn-sm" 
                  value={retailerSearch} 
                  onChange={e => setRetailerSearch(e.target.value)} 
                  placeholder="Filter domains..." 
                  style={{ width: '100%', paddingRight: '2rem' }} 
                />
                {retailerSearch && (
                  <button 
                    onClick={() => setRetailerSearch('')}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.25rem'
                    }}
                    title="Clear search"
                  >
                    <Icon name="x" />
                  </button>
                )}
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleAddRetailer}>+ Add Retailer</button>
            </div>
          )}
        </div>
      </div>

      {editingRetailer ? (
        <RetailerConfigEditor
          initialRetailer={editingRetailer}
          globalCurrencies={globalCurrencies}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={handleDelete}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {retailers.filter(r => r.domain.toLowerCase().includes(retailerSearch.toLowerCase())).map(r => (
            <div key={r.id} className="settings-card" style={{ padding: '1.25rem', cursor: 'pointer', borderLeft: `4px solid ${r.active === false ? 'var(--danger)' : 'var(--primary)'}`, marginBottom: 0 }} onClick={() => handleEditRetailer(r)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{r.name || r.domain}</div>
                {r.active === false && <span style={{ fontSize: '0.6rem', color: 'var(--danger)', fontWeight: 800 }}>INACTIVE</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{r.domain}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.7rem' }}>
                <div style={{ opacity: r.use_browser_scraper ? 1 : 0.3 }}><Icon name="globe" /> Browser Scraper</div>
                <div style={{ opacity: r.use_proxy ? 1 : 0.3 }}><Icon name="shield" /> Proxy</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
