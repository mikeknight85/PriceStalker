import { useState, useEffect, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { AdminSystemService } from '../../services/AdminSystemService';
import { useToast } from '../../../../context/ToastContext';
import ConfirmationModal from '../../../../components/ConfirmationModal';

interface LogsSectionProps {
  onSearchRetailer: (domain: string) => void;
}

export default function LogsSection({ onSearchRetailer }: LogsSectionProps) {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPages, setLogPages] = useState(1);
  const [logSearch, setLogSearch] = useState('');
  const [logLevel, setLogLevel] = useState('');
  const [logContext, setLogContext] = useState('');
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<number[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [availableContexts, setAvailableContexts] = useState<string[]>([]);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const fetchLogs = useCallback(async (page: number) => {
    setIsLogsLoading(true);
    try {
      const res = await AdminSystemService.getLogs({ 
        page, 
        limit: 50, 
        search: logSearch, 
        level: logLevel, 
        context: logContext 
      });
      setLogs(res.data.logs);
      setTotalCount(res.data.total);
      setLogPage(res.data.page);
      setLogPages(res.data.pages);
      setAvailableContexts(res.data.availableContexts || []);
    } catch {
      showToast('Failed to load logs', 'error');
    } finally {
      setIsLogsLoading(false);
    }
  }, [logSearch, logLevel, logContext, showToast]);

  useEffect(() => {
    fetchLogs(1);
  }, [logLevel, logContext, fetchLogs]);

  useEffect(() => {
    if (isAutoRefresh && !isLogsLoading) {
      const interval = setInterval(() => fetchLogs(logPage), 10000);
      return () => clearInterval(interval);
    }
  }, [isAutoRefresh, isLogsLoading, logPage, fetchLogs]);

  const handleDeleteLogs = async () => {
    if (selectedLogIds.length === 0) return;
    try {
      await AdminSystemService.deleteLogs(selectedLogIds);
      showToast('Logs deleted', 'success');
      setSelectedLogIds([]);
      fetchLogs(logPage);
    } catch { showToast('Delete failed', 'error'); }
  };

  const handleClearLogs = async () => {
    try {
      await AdminSystemService.clearLogs(logLevel || undefined, logContext || undefined);
      showToast('All logs purged', 'success');
      fetchLogs(1);
    } catch { showToast('Purge failed', 'error'); }
  };

  return (
    <div className="admin-section-wrapper">
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteLogs}
        title="Delete Log Entries"
        message={`Are you sure you want to delete ${selectedLogIds.length} selected log entries?`}
        confirmText="Delete Entries"
        isDanger={true}
      />
      <ConfirmationModal
        isOpen={showPurgeConfirm}
        onClose={() => setShowPurgeConfirm(false)}
        onConfirm={handleClearLogs}
        title="Purge System Logs"
        message="Are you sure you want to purge ALL system logs matching current filters? This cannot be undone."
        confirmText="Purge All"
        isDanger={true}
      />
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 className="settings-card-title" style={{ margin: 0 }}>System Event Log</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', marginRight: '0.5rem' }}>
              <input type="checkbox" checked={isAutoRefresh} onChange={e => setIsAutoRefresh(e.target.checked)} />
              <span className="mobile-hide">Auto Refresh</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {selectedLogIds.length > 0 && <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>Del ({selectedLogIds.length})</button>}
              <button className="btn btn-secondary btn-sm" style={{ minWidth: '85px' }} onClick={() => fetchLogs(logPage)} disabled={isLogsLoading}>{isLogsLoading ? '...' : 'Refresh'}</button>
              <button className="btn btn-danger btn-sm" onClick={() => setShowPurgeConfirm(true)}>Purge</button>
            </div>
          </div>
        </div>
        
        <div className="form-grid" style={{ marginBottom: '2rem' }}>
          <div className="form-group">
            <label>Search Content</label>
            <input type="text" className="form-control" value={logSearch} onChange={e => setLogSearch(e.target.value)} onKeyPress={e => e.key === 'Enter' && fetchLogs(1)} placeholder="Search message..." />
          </div>
          <div className="form-group">
            <label>Level Filter</label>
            <select className="form-control" value={logLevel} onChange={e => setLogLevel(e.target.value)}>
              <option value="">All Severities</option>
              <option value="ERROR">Errors</option>
              <option value="WARN">Warnings</option>
              <option value="INFO">Information</option>
              <option value="DEBUG">Debug</option>
            </select>
          </div>
          <div className="form-group">
            <label>Context Filter</label>
            <select className="form-control" value={logContext} onChange={e => setLogContext(e.target.value)}>
              <option value="">All Sources</option>
              {availableContexts.map(ctx => <option key={ctx} value={ctx}>{ctx}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <span>Showing {logs.length} of {totalCount} events</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchLogs(logPage - 1)} disabled={logPage <= 1 || isLogsLoading}>Prev</button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem' }}>{logPage} / {logPages}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchLogs(logPage + 1)} disabled={logPage >= logPages || isLogsLoading}>Next</button>
          </div>
        </div>

        <div className="mobile-scroll-hint">Swipe left for details →</div>
        <div style={{ overflowX: 'auto', margin: '0 -1rem', padding: '0 1rem' }}>
          <table className="users-table responsive-log-table" style={{ borderBottom: 'none' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}><input type="checkbox" checked={selectedLogIds.length === logs.length && logs.length > 0} onChange={e => setSelectedLogIds(e.target.checked ? logs.map(l => l.id) : [])} /></th>
                <th style={{ width: '160px' }} className="mobile-hide">Timestamp</th>
                <th style={{ width: '100px' }}>Level</th>
                <th style={{ width: '120px' }} className="mobile-hide">Source</th>
                <th>Message</th>
                <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
               {logs.map(log => (
                 <Fragment key={log.id}>
                   <tr style={{ fontSize: '0.8125rem', background: expandedLogId === log.id ? 'rgba(var(--primary-rgb), 0.05)' : 'none' }}>
                      <td className="log-select-cell"><input type="checkbox" checked={selectedLogIds.includes(log.id)} onChange={e => setSelectedLogIds(prev => e.target.checked ? [...prev, log.id] : prev.filter(id => id !== log.id))} /></td>
                      <td style={{ color: 'var(--text-muted)' }} className="mobile-hide">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="log-level-cell">
                        <span style={{ 
                          fontWeight: 700, fontSize: '0.65rem', padding: '0.125rem 0.4rem', borderRadius: '4px',
                          background: log.level === 'ERROR' ? 'rgba(239, 68, 68, 0.1)' : log.level === 'WARN' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : '#10b981'
                        }}>{log.level}</span>
                      </td>
                      <td style={{ fontWeight: 600 }} className="mobile-hide">{log.context}</td>
                      <td className="log-message-cell">
                        <div className="log-message-content">
                          {log.message.replace(/<[^>]*>?/gm, '')}
                        </div>
                      </td>
                      <td className="log-action-cell" style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)} style={{ padding: '0.25rem 0.5rem' }}>
                          {expandedLogId === log.id ? 'Hide' : 'View'}
                        </button>
                      </td>
                   </tr>
                   {expandedLogId === log.id && (
                     <tr className="details-row">
                       <td colSpan={6} style={{ padding: '0 0 1.5rem 0', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                         <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', fontSize: '0.8125rem', overflowX: 'auto', boxShadow: 'var(--shadow)' }}>
                            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Event Details <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>({new Date(log.created_at).toLocaleString()})</span></span>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {log.details?.tokens && (
                                  <>
                                    <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                      In: {log.details.tokens.input}
                                    </span>
                                    <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                      Out: {log.details.tokens.output}
                                    </span>
                                  </>
                                )}
                                {log.details?.product_id && (
                                  <Link to={`/products/${log.details.product_id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.65rem', height: '20px', padding: '0 0.5rem', display: 'flex', alignItems: 'center' }}>
                                    Product
                                  </Link>
                                )}
                                {log.details?.retailer_domain && (
                                  <button 
                                    className="btn btn-secondary btn-sm" 
                                    style={{ fontSize: '0.65rem', height: '20px', padding: '0 0.5rem', display: 'flex', alignItems: 'center' }}
                                    onClick={() => onSearchRetailer(log.details.retailer_domain)}
                                  >
                                    Retailer
                                  </button>
                                )}
                              </div>
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '1.5rem', padding: '1rem', background: 'var(--background)', borderRadius: '0.5rem', border: '1px solid var(--border)', color: 'var(--text)' }}>
                              {log.message.replace(/<[^>]*>?/gm, '')}
                            </div>

                            {(log.details?.trace || log.details?.steps) && (
                              <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.9rem' }}>Process Flow</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {(log.details.trace || log.details.steps).map((step: string, idx: number) => (
                                    <div key={idx} style={{ 
                                      padding: '0.5rem 0.75rem', 
                                      background: 'var(--background)', 
                                      borderLeft: `3px solid ${step.toLowerCase().includes('failed') || step.toLowerCase().includes('error') || step.toLowerCase().includes('block') ? 'var(--danger)' : 'var(--primary)'}`,
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      gap: '0.75rem',
                                      alignItems: 'center'
                                    }}>
                                      <span style={{ opacity: 0.5, fontWeight: 700, minWidth: '20px' }}>{idx + 1}</span>
                                      <span style={{ wordBreak: 'break-word' }}>{step}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {log.details && (
                              <>
                                <div style={{ marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.9rem' }}>Technical Data</div>
                                {log.details.error && (
                                  <div style={{ marginBottom: '0.5rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '0.5rem', color: 'var(--danger)', fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                                    <strong>Error:</strong> {typeof log.details.error === 'string' ? log.details.error : JSON.stringify(log.details.error)}
                                  </div>
                                )}
                                {log.details.stack && (
                                  <div style={{ marginBottom: '0.5rem', padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'monospace', maxHeight: '150px', overflowY: 'auto', wordBreak: 'break-all' }}>
                                    <strong>Stack Trace:</strong><br/>
                                    {log.details.stack}
                                  </div>
                                )}
                                <pre style={{ 
                                  margin: 0, 
                                  padding: '0.75rem', 
                                  background: 'var(--background)', 
                                  borderRadius: '0.5rem', 
                                  fontSize: '0.75rem', 
                                  border: '1px solid var(--border)',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all'
                                }}>
                                  {JSON.stringify(
                                    Object.fromEntries(Object.entries(log.details).filter(([k]) => !['steps', 'trace', 'error', 'stack'].includes(k))), 
                                    null, 2
                                  )}
                                </pre>
                              </>
                            )}
                         </div>
                       </td>
                     </tr>
                   )}
                 </Fragment>
               ))}
               {logs.length === 0 && (
                 <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No system events found matching your criteria.</td></tr>
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
