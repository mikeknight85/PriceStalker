import Icon from '../../../components/Icon';
import { LiveMatch } from '../utils/liveSelector';

interface SelectorTesterProps {
  state: {
    liveSelector: string; setLiveSelector: (v: string) => void;
    liveMatches: LiveMatch[];
    liveError: string | null;
    liveEngine: string;
    hasHtml: boolean;
  };
  actions: {
    addToSelectors: (type: string, selector: string) => void;
  };
}

export default function SelectorTester({ state, actions }: SelectorTesterProps) {
  const { liveSelector, setLiveSelector, liveError, liveEngine, hasHtml } = state;
  const { addToSelectors } = actions;

  // The hook always returns an array, but this component is also mounted from a
  // page whose result payload comes straight off the API.
  const liveMatches = Array.isArray(state.liveMatches) ? state.liveMatches : [];

  return (
    <div className="card workstation-card mt-4">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3><Icon name="flask" /> Live Selector Lab</h3>
        <div className="badge method-badge">{liveMatches.length} Matches</div>
      </div>
      <div className="card-body">
        <div className="form-group mb-3">
          <label>Test Selector</label>
          <input
            type="text"
            className="form-control workstation-input"
            placeholder="e.g. .price-tag, meta[itemprop='price']::attr(content), xpath://span[@id='price']"
            value={liveSelector}
            onChange={e => setLiveSelector(e.target.value)}
          />
          <small className="selector-hint">
            CSS, <code>::attr(name)</code>, <code>!selector</code> for HTML, <code>xpath://</code> and
            <code>~regex~</code> all work here, exactly as in a retailer config.
          </small>
        </div>

        {!hasHtml && (
          <div className="no-matches">
            No extracted HTML to test against. Run an extraction with
            "Include raw HTML payload" enabled.
          </div>
        )}

        {hasHtml && liveError && (
          <div className="selector-error">
            <Icon name="alertTriangle" /> {liveError}
          </div>
        )}

        {hasHtml && !liveError && liveMatches.length > 0 && (
          <div className="live-results-grid">
            {liveMatches.map((match, i) => (
              <div key={i} className="live-match-card">
                <div className="match-header">
                  <span className="match-tag">
                    {match.tagName ? `<${match.tagName}>` : `${liveEngine} match`}
                  </span>
                  <div className="match-actions">
                    <button className="mini-action-btn" onClick={() => addToSelectors('price', liveSelector)}>+ Price</button>
                    <button className="mini-action-btn" onClick={() => addToSelectors('name', liveSelector)}>+ Name</button>
                    <button className="mini-action-btn" onClick={() => addToSelectors('image', liveSelector)}>+ Image</button>
                  </div>
                </div>

                {/*
                  The extracted value leads, whatever it was taken from. A meta
                  tag or an offscreen node has no text, and showing "Text:
                  (empty)" for a working attribute rule read as a failure.
                */}
                <div className="match-value">
                  <span className="match-value-label">{match.valueLabel}</span>
                  <code className={match.value ? '' : 'is-empty'}>
                    {match.value ? match.value : '(empty)'}
                  </code>
                </div>

                {match.status && (
                  <div className="match-status">Asserts status: <code>{match.status}</code></div>
                )}

                {match.attribute && match.text && (
                  <div className="match-content">
                    <strong>Text:</strong> <code>{match.text}</code>
                  </div>
                )}

                {Object.keys(match.attributes).length > 0 && (
                  <div className="match-attrs">
                    {Object.entries(match.attributes).map(([k, v]) => (
                      <span
                        key={k}
                        className={`attr-pill${k === match.attribute ? ' is-target' : ''}`}
                        title={`${k}="${v}"`}
                      >
                        {k}="{String(v).substring(0, 20)}{String(v).length > 20 ? '...' : ''}"
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {hasHtml && !liveError && liveSelector && liveMatches.length === 0 && (
          <div className="no-matches">No elements matching "{liveSelector}" found in the extracted HTML.</div>
        )}
      </div>
    </div>
  );
}
