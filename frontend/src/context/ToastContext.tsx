import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';

interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ActivityLogEntry {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: Date;
  details?: any;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', details?: any, action?: ToastAction) => void;
  activityLog: ActivityLogEntry[];
  clearActivityLog: () => void;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const toastsRef = useRef<Toast[]>([]);

  // Keep ref in sync for stacking limit logic
  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', details?: any, action?: ToastAction) => {
    const id = Date.now();
    
    // Add to activity log (persistent for session, not DB)
    setActivityLog((prev) => [
      { id, message, type, timestamp: new Date(), details },
      ...prev.slice(0, 49), // Keep last 50
    ]);

    // Enforce stacking limit (Max 3)
    setToasts((prev) => {
      const next = [...prev, { id, message, type, action }];
      if (next.length > 3) {
        return next.slice(next.length - 3);
      }
      return next;
    });

    // Auto-dismiss toast after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 6000);
  }, []);

  const clearActivityLog = useCallback(() => {
    setActivityLog([]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, activityLog, clearActivityLog, isDrawerOpen, setDrawerOpen }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        .toast-container {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          z-index: 9999;
          pointer-events: none;
        }

        .toast {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 1rem 1.25rem 1rem 1.5rem;
          border-radius: 0.75rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          font-size: 0.9375rem;
          font-weight: 500;
          pointer-events: auto;
          animation: toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          max-width: 400px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .toast::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
        }

        .toast.toast-success::before {
          background: var(--secondary);
        }

        .toast.toast-error::before {
          background: var(--danger);
        }

        .toast.toast-info::before {
          background: var(--primary);
        }

        @keyframes toast-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .toast-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .toast-success .toast-icon {
          color: var(--secondary);
          background: rgba(16, 185, 129, 0.1);
        }

        .toast-error .toast-icon {
          color: var(--danger);
          background: rgba(239, 68, 68, 0.1);
        }

        .toast-info .toast-icon {
          color: var(--primary);
          background: rgba(99, 102, 241, 0.1);
        }

        .toast-message {
          flex: 1;
          line-height: 1.4;
        }

        .toast-action-btn {
          background: var(--primary);
          color: white;
          border: none;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          margin-left: 0.5rem;
          white-space: nowrap;
        }

        .toast-action-btn:hover {
          background: var(--primary-dark);
        }

        .toast-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.375rem;
          flex-shrink: 0;
          transition: background 0.2s, color 0.2s;
          margin-left: 0.5rem;
        }

        .toast-close:hover {
          background: var(--background);
          color: var(--text);
        }

        @media (max-width: 480px) {
          .toast-container {
            left: 1rem;
            right: 1rem;
            bottom: 1rem;
          }

          .toast {
            max-width: none;
          }
        }
      `}</style>
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-icon">
              {toast.type === 'success' && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
            </div>
            <span className="toast-message">{toast.message}</span>
            {toast.action && (
              <button 
                className="toast-action-btn" 
                onClick={() => {
                  toast.action?.onClick();
                  onRemove(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button className="toast-close" onClick={() => onRemove(toast.id)} aria-label="Close">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
