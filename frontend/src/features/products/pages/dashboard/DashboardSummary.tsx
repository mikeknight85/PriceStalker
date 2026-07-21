import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ChartTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Product } from '../../../../types/api';
import { STOCK_COLORS } from '../../constants';
import './DashboardSummary.css';

interface DashboardSummaryProps {
  summary: {
    totalProducts: number;
    biggestDrops: Product[];
    atTargetPrice: Product[];
    atHistoricalLow: Product[];
    pausedProducts: number;
    activeProducts: number;
    onSaleCount: number;
    retailerCounts: { name: string; count: number }[];
    categoryCounts: { name: string; count: number }[];
    stockCounts: { name: string; count: number }[];
  } | null;
}

const getThemeColors = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid: isDark ? '#334155' : '#e2e8f0',
    text: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
  };
};

const DashboardSummary: React.FC<DashboardSummaryProps> = ({ summary }) => {
  const [isLowestOpen, setIsLowestOpen] = useState(false);
  const [isTargetOpen, setIsTargetOpen] = useState(false);
  const [themeColors, setThemeColors] = useState(getThemeColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeColors(getThemeColors());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  if (!summary || summary.totalProducts === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <h3 className="empty-state-title">No stats available</h3>
        <p className="empty-state-text">Start tracking products to see price insights here.</p>
      </div>
    );
  }

  // Format price helper
  const formatValue = (val: number | null, currency: string | null) => {
    if (val === null) return '-';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency || 'AUD'
    }).format(val);
  };

  // Truncate name helper
  const truncateName = (name: string | null, maxLength: number = 60) => {
    if (!name) return 'Unknown';
    return name.length > maxLength ? `${name.substring(0, maxLength)}...` : name;
  };

  return (
    <div className="summary-dashboard-layout">
      {/* 1. General Metrics & Volatility */}
      <div className="summary-dashboard-grid-row">
        <div className="summary-card metrics-grid-card">
          <div className="summary-card-title">Tracking Overview</div>
          <div className="metrics-grid">
            <div className="metric-box">
              <span className="metric-box-label">Total</span>
              <span className="metric-box-val">{summary.totalProducts}</span>
            </div>
            <div className="metric-box">
              <span className="metric-box-label">Active</span>
              <span className="metric-box-val success">{summary.activeProducts}</span>
            </div>
            <div className="metric-box">
              <span className="metric-box-label">Paused</span>
              <span className="metric-box-val">{summary.pausedProducts}</span>
            </div>
            <div className="metric-box">
              <span className="metric-box-label">On Sale</span>
              <span className="metric-box-val highlight">{summary.onSaleCount}</span>
            </div>
          </div>
        </div>

        {/* 2. Retailer Distribution Progress Bars */}
        <div className="summary-card">
          <div className="summary-card-title">Top Retailers</div>
          <div className="retailers-progress-list">
            {summary.retailerCounts.map((ret) => {
              const pct = (ret.count / summary.totalProducts) * 100;
              return (
                <div key={ret.name} className="retailer-progress-item">
                  <div className="retailer-progress-header">
                    <span className="retailer-progress-name">{ret.name}</span>
                    <span className="retailer-progress-count">
                      {ret.count} {ret.count === 1 ? 'product' : 'products'}
                    </span>
                  </div>
                  <div className="retailer-progress-bar-bg">
                    <div className="retailer-progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Lists: Biggest Drops & Collapsible Quick-Lists */}
      <div className="summary-dashboard-grid-row">
        {/* Biggest Drops (7d) */}
        <div className="summary-card list-card-summary">
          <div className="summary-card-title">Biggest Price Drops (7d)</div>
          {summary.biggestDrops.length > 0 ? (
            <div className="drops-media-list">
              {summary.biggestDrops.map((p) => (
                <Link key={p.id} to={`/?product=${p.id}&tab=products`} className="drop-media-item-link">
                  <div className="drop-media-item">
                    <div className="drop-media-image-wrapper">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" />
                      ) : (
                        <span style={{ fontSize: '1rem' }}>📦</span>
                      )}
                    </div>
                    <div className="drop-media-info">
                      <div className="drop-media-name">{truncateName(p.name)}</div>
                      <div className="drop-media-retailer">@{p.retailer_name || 'Store'}</div>
                    </div>
                    <div className="drop-media-prices">
                      <span className="drop-media-percentage">{p.price_change_7d?.toFixed(1)}%</span>
                      <span className="drop-media-current">
                        {formatValue(p.current_price, p.currency)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="no-data-placeholder">No recent price drops recorded.</div>
          )}
        </div>

        {/* Collapsible Action/Quick-Lists */}
        <div className="summary-card list-card-summary">
          <div className="summary-card-title">Insights Drawer</div>
          
          {/* Quick-list: Historical Low */}
          <div className="quick-list-section">
            <button 
              className="quick-list-header"
              onClick={() => setIsLowestOpen(!isLowestOpen)}
            >
              <span>At Historical Lowest Price ({summary.atHistoricalLow.length})</span>
              <span className={`chevron ${isLowestOpen ? 'expanded' : ''}`}>▼</span>
            </button>
            
            {isLowestOpen && (
              <div className="quick-list-body">
                {summary.atHistoricalLow.length > 0 ? (
                  <div className="quick-products-list">
                    {summary.atHistoricalLow.map((p) => (
                      <Link key={p.id} to={`/?product=${p.id}&tab=products`} className="quick-product-item-link">
                        <div className="quick-product-item">
                          <div className="quick-product-image">
                            {p.image_url ? <img src={p.image_url} alt="" /> : '📦'}
                          </div>
                          <div className="quick-product-name">{truncateName(p.name)}</div>
                          <div className="quick-product-price">
                            {formatValue(p.current_price, p.currency)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="quick-list-empty">No products are currently at their lowest recorded price.</div>
                )}
              </div>
            )}
          </div>

          <hr className="quick-list-divider" />

          {/* Quick-list: Target Price */}
          <div className="quick-list-section">
            <button 
              className="quick-list-header"
              onClick={() => setIsTargetOpen(!isTargetOpen)}
            >
              <span>At or Below Target Price ({summary.atTargetPrice.length})</span>
              <span className={`chevron ${isTargetOpen ? 'expanded' : ''}`}>▼</span>
            </button>
            
            {isTargetOpen && (
              <div className="quick-list-body">
                {summary.atTargetPrice.length > 0 ? (
                  <div className="quick-products-list">
                    {summary.atTargetPrice.map((p) => (
                      <Link key={p.id} to={`/?product=${p.id}&tab=products`} className="quick-product-item-link">
                        <div className="quick-product-item">
                          <div className="quick-product-image">
                            {p.image_url ? <img src={p.image_url} alt="" /> : '📦'}
                          </div>
                          <div className="quick-product-name">{truncateName(p.name)}</div>
                          <div className="quick-product-price">
                            {formatValue(p.current_price, p.currency)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="quick-list-empty">No products are currently at or below their target price.</div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 4. Charts: Stock & Category Breakdown */}
      <div className="summary-dashboard-grid-row">
        {/* Stock Status Donut */}
        <div className="summary-card chart-card">
          <div className="summary-card-title">Stock Availability</div>
          <div className="chart-container-summary" style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary.stockCounts}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {summary.stockCounts.map((entry) => (
                    <Cell key={entry.name} fill={STOCK_COLORS[entry.name] || '#6366f1'} />
                  ))}
                </Pie>
                <ChartTooltip
                  contentStyle={{
                    background: themeColors.tooltipBg,
                    border: `1px solid ${themeColors.tooltipBorder}`,
                    borderRadius: '0.375rem',
                    color: 'var(--text)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend-grid">
            {summary.stockCounts.map((entry) => (
              <div key={entry.name} className="chart-legend-item">
                <span className="legend-dot" style={{ background: STOCK_COLORS[entry.name] || '#6366f1' }} />
                <span className="legend-label">{entry.name} ({entry.count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Categories Bar Chart */}
        <div className="summary-card chart-card">
          <div className="summary-card-title">Category Distribution</div>
          <div className="chart-container-summary" style={{ height: '220px' }}>
            {summary.categoryCounts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.categoryCounts}
                  layout="vertical"
                  margin={{ left: 5, right: 15, top: 10, bottom: 5 }}
                >
                  <XAxis type="number" stroke={themeColors.text} fontSize={11} hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke={themeColors.text}
                    fontSize={11}
                    width={85}
                    tickLine={false}
                  />
                  <ChartTooltip
                    contentStyle={{
                      background: themeColors.tooltipBg,
                      border: `1px solid ${themeColors.tooltipBorder}`,
                      borderRadius: '0.375rem',
                      color: 'var(--text)'
                    }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-data-placeholder">No categories configured.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSummary;
