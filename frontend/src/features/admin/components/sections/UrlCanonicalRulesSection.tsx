import { useState } from 'react';
import CollapsibleCard from '../../../../components/CollapsibleCard';
import Icon from '../../../../components/Icon';
import { FieldHelp } from '../../components';
import { UrlCanonicalRule } from '../../../../types/api';
import { AdminSystemService } from '../../services/AdminSystemService';
import { useToast } from '../../../../context/ToastContext';

interface UrlCanonicalRulesSectionProps {
  rules: UrlCanonicalRule[];
  onChange: (rules: UrlCanonicalRule[]) => void;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

export default function UrlCanonicalRulesSection({
  rules,
  onChange,
  isExpanded,
  onToggle,
}: UrlCanonicalRulesSectionProps) {
  const { showToast } = useToast();

  // Editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [ruleForm, setRuleForm] = useState<UrlCanonicalRule>({
    domain_pattern: '',
    path_match: '',
    path_replacement: '',
    description: '',
  });

  // URL test state
  const [testUrl, setTestUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    canonicalUrl: string;
    matched: boolean;
    rule: UrlCanonicalRule | null;
  } | null>(null);

  const startAdd = () => {
    setRuleForm({
      domain_pattern: '',
      path_match: '',
      path_replacement: '',
      description: '',
    });
    setEditingIndex(null);
    setIsAdding(true);
  };

  const startEdit = (index: number) => {
    setRuleForm({ ...rules[index] });
    setEditingIndex(index);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setIsAdding(false);
    setRuleForm({
      domain_pattern: '',
      path_match: '',
      path_replacement: '',
      description: '',
    });
  };

  const moveRule = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rules.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...rules];
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    onChange(updated);
  };

  const saveRule = () => {
    if (!ruleForm.domain_pattern.trim()) {
      showToast('Domain pattern is required', 'error');
      return;
    }
    if (!ruleForm.path_match.trim()) {
      showToast('Path match regex is required', 'error');
      return;
    }
    if (ruleForm.path_replacement === undefined) {
      showToast('Path replacement is required', 'error');
      return;
    }

    // Validate regex syntax
    try {
      new RegExp(ruleForm.domain_pattern.trim());
    } catch {
      showToast('Invalid domain pattern regular expression', 'error');
      return;
    }
    try {
      new RegExp(ruleForm.path_match.trim());
    } catch {
      showToast('Invalid path match regular expression', 'error');
      return;
    }

    const updated = [...rules];
    const newRule: UrlCanonicalRule = {
      domain_pattern: ruleForm.domain_pattern.trim(),
      path_match: ruleForm.path_match.trim(),
      path_replacement: ruleForm.path_replacement.trim(),
      description: ruleForm.description?.trim() || undefined,
    };

    if (isAdding) {
      updated.push(newRule);
    } else if (editingIndex !== null) {
      updated[editingIndex] = newRule;
    }

    onChange(updated);
    cancelEdit();
  };

  const deleteRule = (index: number) => {
    const updated = rules.filter((_, i) => i !== index);
    onChange(updated);
    if (editingIndex === index) {
      cancelEdit();
    }
  };

  const runTest = async () => {
    if (!testUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await AdminSystemService.testCanonicalRule(testUrl.trim(), rules);
      setTestResult({
        canonicalUrl: res.canonicalUrl,
        matched: res.matched,
        rule: res.rule,
      });
    } catch {
      showToast('Failed to test URL canonicalization', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <CollapsibleCard
      title="URL Canonicalization Rules"
      leadingIcon={<Icon name="link" />}
      id="sys_url_canonical"
      badge={`${rules.length} rules`}
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
          Rewrite and normalize product URLs before saving or scraping. This strips localized title slugs,
          promotional hierarchies, and referral segments into deduplicated canonical formats.
        </p>

        {/* Existing Rules List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rules.map((rule, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '0.25rem' }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveRule(idx, 'up')}
                      className="mini-arrow-btn"
                      title="Move rule up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === rules.length - 1}
                      onClick={() => moveRule(idx, 'down')}
                      className="mini-arrow-btn"
                      title="Move rule down"
                    >
                      ▼
                    </button>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {rule.description || `Rule #${idx + 1}`}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '0.25rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {rule.domain_pattern}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => startEdit(idx)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    title="Edit rule"
                  >
                    <Icon name="edit" size="0.85em" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => deleteRule(idx)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--danger)' }}
                    title="Delete rule"
                  >
                    <Icon name="trash" size="0.85em" />
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: '0.5rem',
                  alignItems: 'center',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  background: 'var(--surface)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.25rem',
                  overflowX: 'auto',
                }}
              >
                <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rule.path_match}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>→</div>
                <div style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  {rule.path_replacement}
                </div>
              </div>
            </div>
          ))}

          {rules.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No canonicalization rules configured. URLs will only have tracking query parameters stripped.
            </div>
          )}
        </div>

        {/* Add/Edit Form */}
        {(isAdding || editingIndex !== null) ? (
          <div
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {isAdding ? 'Add Canonical Rule' : `Edit Rule #${editingIndex! + 1}`}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
                  Description (optional)
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '100%', height: '36px' }}
                  placeholder="e.g. Amazon ASIN canonicalizer"
                  value={ruleForm.description || ''}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
                  Domain Regex Pattern *
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '100%', height: '36px', fontFamily: 'monospace' }}
                  placeholder="e.g. (?:^|\.)amazon\..*"
                  value={ruleForm.domain_pattern}
                  onChange={(e) => setRuleForm({ ...ruleForm, domain_pattern: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
                  Path Match Regex *
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '100%', height: '36px', fontFamily: 'monospace' }}
                  placeholder="e.g. (?:^|.*\/)(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/.*)?$"
                  value={ruleForm.path_match}
                  onChange={(e) => setRuleForm({ ...ruleForm, path_match: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
                  Path Replacement *
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '100%', height: '36px', fontFamily: 'monospace' }}
                  placeholder="e.g. /dp/$1"
                  value={ruleForm.path_replacement}
                  onChange={(e) => setRuleForm({ ...ruleForm, path_replacement: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={saveRule}>
                {isAdding ? 'Add Rule' : 'Update Rule'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={startAdd}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Icon name="plus" size="0.85em" />
              Add Canonical Rule
            </button>
          </div>
        )}

        {/* Live URL Testing Playground */}
        <div
          style={{
            marginTop: '0.5rem',
            borderTop: '1px solid var(--border)',
            paddingTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name="flask" size="1em" />
            Test URL Canonicalization
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Paste a product URL to test against the active canonical rules and query parameters filter.
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              type="text"
              className="form-control"
              style={{ flex: 1, fontSize: '0.85rem' }}
              placeholder="e.g. https://www.amazon.fr/product-title-slug/dp/B08WXT12BN/ref=pd_.../?th=1"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runTest();
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={runTest}
              disabled={isTesting || !testUrl.trim()}
              style={{ minWidth: '70px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isTesting ? 'Testing...' : 'Test'}
            </button>
          </div>

          {testResult && (
            <div
              style={{
                marginTop: '0.5rem',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>Matched Rule:</span>
                {testResult.matched ? (
                  <span style={{ color: 'var(--secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Icon name="checkCircle" size="0.9em" />
                    {testResult.rule?.description || testResult.rule?.domain_pattern}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>None (Standard query cleaning only)</span>
                )}
              </div>

              <div>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Canonical Result:</span>
                <code
                  style={{
                    display: 'block',
                    background: 'var(--surface)',
                    padding: '0.5rem',
                    borderRadius: '0.25rem',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                  }}
                >
                  {testResult.canonicalUrl}
                </code>
              </div>
            </div>
          )}
        </div>

        <FieldHelp>
          Rules execute in order. The first rule whose domain pattern matches the hostname and whose path pattern matches the pathname is applied. Use the arrow buttons to adjust priority.
        </FieldHelp>
      </div>

      <style>{`
        .mini-arrow-btn {
          padding: 0;
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 0.6rem;
          cursor: pointer;
          height: 12px;
          line-height: 1;
        }
        .mini-arrow-btn:hover:not(:disabled) {
          color: var(--primary);
        }
        .mini-arrow-btn:disabled {
          opacity: 0.2;
          cursor: default;
        }
      `}</style>
    </CollapsibleCard>
  );
}
