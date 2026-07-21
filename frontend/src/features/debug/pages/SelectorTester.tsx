

interface SelectorTesterProps {
  state: {
    liveSelector: string; setLiveSelector: (v: string) => void;
    liveMatches: any[];
  };
  actions: {
    addToSelectors: (type: string, selector: string) => void;
  };
}

export default function SelectorTester({ state, actions }: SelectorTesterProps) {
  const { liveSelector, setLiveSelector, liveMatches } = state;
  const { addToSelectors } = actions;

  return (
    <div className="card workstation-card mt-4">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>🧪 Live Selector Lab</h3>
        <div className="badge method-badge">{liveMatches.length} Matches</div>
      </div>
      <div className="card-body">
        <div className="form-group mb-3">
          <label>Test CSS Selector</label>
          <input 
            type="text" 
            className="form-control workstation-input" 
            placeholder="e.g. .price-tag, meta[property='og:price'], img#product-image"
            value={liveSelector}
            onChange={e => setLiveSelector(e.target.value)}
          />
        </div>
        
        {liveMatches.length > 0 ? (
          <div className="live-results-grid">
            {liveMatches.map((match, i) => (
              <div key={i} className="live-match-card">
                <div className="match-header">
                  <span className="match-tag">&lt;{match.tagName}&gt;</span>
                  <div className="match-actions">
                    <button className="mini-action-btn" onClick={() => addToSelectors('price', liveSelector)}>+ Price</button>
                    <button className="mini-action-btn" onClick={() => addToSelectors('name', liveSelector)}>+ Name</button>
                    <button className="mini-action-btn" onClick={() => addToSelectors('image', liveSelector)}>+ Image</button>
                  </div>
                </div>
                <div className="match-content">
                  <strong>Text:</strong> <code>{match.text || '(empty)'}</code>
                </div>
                {Object.keys(match.attributes).length > 0 && (
                  <div className="match-attrs">
                    {Object.entries(match.attributes).map(([k, v]: any) => (
                      <span key={k} className="attr-pill" title={`${k}="${v}"`}>
                        {k}="{String(v).substring(0, 20)}{String(v).length > 20 ? '...' : ''}"
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : liveSelector && (
          <div className="no-matches">No elements matching "{liveSelector}" found in the extracted HTML.</div>
        )}
      </div>
    </div>
  );
}
