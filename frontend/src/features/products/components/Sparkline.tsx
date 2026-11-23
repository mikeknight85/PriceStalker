import React, { useMemo, useState, useCallback } from 'react';
import { SparklinePoint } from '../../../types/api';
import { formatPrice, formatDateWithOptions } from '../../../utils/format';
import './PriceChart/Charts.css';

export interface SparklineProps {
  data: SparklinePoint[];
  currentPrice?: number | null;
  currency?: string | null;
  locale?: string | null;
  priceChange7d?: number | null;
  width?: number;
  height?: number;
  color?: string;
  showTrend?: boolean;
  showBounds?: boolean;
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  currentPrice,
  currency = 'USD',
  locale,
  priceChange7d,
  width = 85,
  height = 38,
  color,
  showTrend = true,
  showBounds = true,
}) => {
  const gradientId = useMemo(() => `sparkline-grad-${Math.random().toString(36).substring(2, 9)}`, []);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    price: number;
    time: number;
    deltaPct: number;
  } | null>(null);

  // Compact bound formatting (strips trailing .00 on whole numbers for cleaner typography)
  const formatBoundPrice = useCallback((val: number) => {
    const formatted = formatPrice(val, currency, locale);
    if (val % 1 === 0) {
      return formatted.replace(/([.,]00)(?=\s*[^\d]*$)/, '');
    }
    return formatted;
  }, [currency, locale]);

  // Normalize points and align to 7-day time window
  const { normalizedPoints, minPrice, maxPrice, firstPrice, lastPrice, trend, calculatedDelta } = useMemo(() => {
    const now = Date.now();
    const windowMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const windowStart = now - windowMs;

    // Parse all valid points
    const raw: { price: number; time: number; effectiveTime: number }[] = [];
    if (Array.isArray(data)) {
      for (const d of data) {
        const p = typeof d.price === 'string' ? parseFloat(d.price) : d.price;
        if (!isNaN(p) && p !== null && p !== undefined) {
          const t = d.recorded_at ? new Date(d.recorded_at).getTime() : now;
          const validT = isNaN(t) ? now : t;
          raw.push({ price: p, time: validT, effectiveTime: validT });
        }
      }
    }

    // Append current price if available and not redundant
    if (currentPrice !== undefined && currentPrice !== null && !isNaN(currentPrice)) {
      const numCur = typeof currentPrice === 'string' ? parseFloat(currentPrice) : currentPrice;
      if (raw.length === 0) {
        raw.push({ price: numCur, time: now, effectiveTime: now });
      } else {
        const last = raw[raw.length - 1];
        if (Math.abs(last.time - now) > 60_000) {
          raw.push({ price: numCur, time: now, effectiveTime: now });
        }
      }
    }

    // Handle empty data fallback
    if (raw.length === 0) {
      return {
        normalizedPoints: [],
        minPrice: 0,
        maxPrice: 0,
        firstPrice: 0,
        lastPrice: 0,
        trend: 'steady' as const,
        calculatedDelta: 0,
      };
    }

    // Sort by recorded time ascending
    raw.sort((a, b) => a.time - b.time);

    // If only 1 point exists, span it across the 7-day window
    let pts: { price: number; time: number; effectiveTime: number }[] = [];
    if (raw.length === 1) {
      pts = [
        { price: raw[0].price, time: windowStart, effectiveTime: raw[0].effectiveTime },
        { price: raw[0].price, time: now, effectiveTime: raw[0].effectiveTime },
      ];
    } else {
      // If the first point was before windowStart (prior anchor), clamp its visual time to windowStart
      pts = raw.map((p, idx) => {
        if (idx === 0 && p.time < windowStart) {
          return { price: p.price, time: windowStart, effectiveTime: p.effectiveTime };
        }
        return p;
      });
      // Ensure the line extends to now without falsely jumping the step's effective date to now
      if (pts[pts.length - 1].time < now) {
        const lastPt = pts[pts.length - 1];
        pts.push({ price: lastPt.price, time: now, effectiveTime: lastPt.effectiveTime });
      }
    }

    const prices = pts.map((p) => p.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const firstP = prices[0];
    const lastP = prices[prices.length - 1];

    // Determine delta and trend
    let delta = priceChange7d;
    if (delta === undefined || delta === null) {
      if (firstP > 0) {
        delta = ((lastP - firstP) / firstP) * 100;
      } else {
        delta = 0;
      }
    }

    let t: 'down' | 'up' | 'steady' = 'steady';
    if (minP !== maxP && Math.abs(delta) >= 0.05) {
      t = lastP < firstP || delta < 0 ? 'down' : 'up';
    }

    return {
      normalizedPoints: pts,
      minPrice: minP,
      maxPrice: maxP,
      firstPrice: firstP,
      lastPrice: lastP,
      trend: t,
      calculatedDelta: delta,
    };
  }, [data, currentPrice, priceChange7d]);

  // Tooltip summary text
  const tooltipText = useMemo(() => {
    if (minPrice === maxPrice || normalizedPoints.length === 0) {
      return `7-day price: ${formatPrice(currentPrice ?? minPrice, currency, locale)} (Steady)`;
    }
    const deltaStr = calculatedDelta !== null && calculatedDelta !== undefined
      ? ` (${calculatedDelta > 0 ? '+' : ''}${calculatedDelta.toFixed(1)}%)`
      : '';
    return `7-day trend: ${formatPrice(firstPrice, currency, locale)} → ${formatPrice(lastPrice, currency, locale)}${deltaStr}\nLow: ${formatPrice(minPrice, currency, locale)} • High: ${formatPrice(maxPrice, currency, locale)}`;
  }, [minPrice, maxPrice, normalizedPoints.length, calculatedDelta, firstPrice, lastPrice, currentPrice, currency, locale]);

  const padding = 3;
  const chartWidth = Math.max(10, width - padding * 2);
  const chartHeight = Math.max(10, height - padding * 2);

  // Line & Area Styling
  const strokeColor = color || (trend === 'down' ? 'var(--secondary, #10b981)' : trend === 'up' ? 'var(--danger, #ef4444)' : 'var(--text-muted)');
  const stopColor = trend === 'down' ? 'var(--secondary, #10b981)' : trend === 'up' ? 'var(--danger, #ef4444)' : 'transparent';

  // Compute SVG Geometry
  const { pathD, fillD, lastCoords, scaleMin, scaleDelta } = useMemo(() => {
    if (normalizedPoints.length < 2 || minPrice === maxPrice) {
      return {
        pathD: '',
        fillD: '',
        lastCoords: { x: padding + chartWidth, y: padding + chartHeight / 2 },
        scaleMin: minPrice,
        scaleDelta: 1,
      };
    }

    const now = Date.now();
    const windowMs = 7 * 24 * 60 * 60 * 1000;
    const windowStart = now - windowMs;

    // Avoid micro-drop vertical distortion (minimum 5% scale range)
    const rawRange = maxPrice - minPrice;
    const effectiveRange = Math.max(rawRange, maxPrice * 0.05);
    const padRange = (effectiveRange - rawRange) / 2;
    const sMin = minPrice - padRange;
    const sDelta = effectiveRange;

    const coords = normalizedPoints.map((pt) => {
      const clampedTime = Math.max(windowStart, Math.min(now, pt.time));
      const timeFrac = (clampedTime - windowStart) / windowMs;
      const x = padding + timeFrac * chartWidth;
      const y = padding + chartHeight - ((pt.price - sMin) / sDelta) * chartHeight;
      return { x, y };
    });

    // Generate discrete retail step-after path (stays flat until price changes)
    let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      d += ` L ${next.x.toFixed(1)},${curr.y.toFixed(1)} L ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
    }

    const last = coords[coords.length - 1];
    const bottomY = padding + chartHeight;
    const fill = `${d} L ${last.x.toFixed(1)},${bottomY} L ${coords[0].x.toFixed(1)},${bottomY} Z`;

    return { pathD: d, fillD: fill, lastCoords: last, scaleMin: sMin, scaleDelta: sDelta };
  }, [normalizedPoints, minPrice, maxPrice, padding, chartWidth, chartHeight]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (normalizedPoints.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = rect.width > 0 ? width / rect.width : 1;
      const mouseX = Math.max(padding, Math.min(padding + chartWidth, (e.clientX - rect.left) * scaleX));
      const timeFrac = (mouseX - padding) / chartWidth;
      const now = Date.now();
      const windowMs = 7 * 24 * 60 * 60 * 1000;
      const windowStart = now - windowMs;
      const hoverTime = windowStart + timeFrac * windowMs;

      if (minPrice === maxPrice || normalizedPoints.length < 2) {
        setHoverInfo({
          x: mouseX,
          y: padding + chartHeight / 2,
          price: minPrice,
          time: normalizedPoints[0]?.effectiveTime ?? hoverTime,
          deltaPct: 0,
        });
        return;
      }

      // In a discrete retail step-after curve:
      // The price at hoverTime is the price of the last point recorded at or before hoverTime.
      let active = normalizedPoints[0];
      for (let i = 0; i < normalizedPoints.length; i++) {
        if (normalizedPoints[i].time <= hoverTime) {
          active = normalizedPoints[i];
        } else {
          break;
        }
      }

      const y = padding + chartHeight - ((active.price - scaleMin) / scaleDelta) * chartHeight;
      const deltaPct = firstPrice > 0 ? ((active.price - firstPrice) / firstPrice) * 100 : 0;

      setHoverInfo({
        x: mouseX,
        y,
        price: active.price,
        time: active.effectiveTime ?? active.time,
        deltaPct,
      });
    },
    [normalizedPoints, minPrice, maxPrice, firstPrice, padding, chartWidth, chartHeight, scaleMin, scaleDelta, width]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  return (
    <div className="sparkline-container" title={tooltipText}>
      <div className="sparkline-header">
        {hoverInfo ? (
          <div className={`sparkline-hover-pill ${hoverInfo.deltaPct < -0.05 ? 'down' : hoverInfo.deltaPct > 0.05 ? 'up' : 'steady'}`}>
            <span className="sparkline-hover-price">{formatPrice(hoverInfo.price, currency, locale)}</span>
            <span className="sparkline-hover-date">
              {formatDateWithOptions(hoverInfo.time, locale, { month: 'short', day: 'numeric' })}
            </span>
            {Math.abs(hoverInfo.deltaPct) >= 0.05 && (
              <span className="sparkline-hover-diff">
                {hoverInfo.deltaPct < 0 ? `↓ ${Math.abs(hoverInfo.deltaPct).toFixed(1)}%` : `↑ ${hoverInfo.deltaPct.toFixed(1)}%`}
              </span>
            )}
          </div>
        ) : showTrend ? (
          <span className={`sparkline-trend ${trend}`}>
            {trend === 'down' && `↓ ${Math.abs(calculatedDelta ?? 0).toFixed(1)}%`}
            {trend === 'up' && `↑ ${(calculatedDelta ?? 0).toFixed(1)}%`}
            {trend === 'steady' && '→ Steady'}
          </span>
        ) : null}
      </div>

      <div className="sparkline-row">
        {showBounds && minPrice !== maxPrice && (
          <div className="sparkline-bounds" aria-hidden="true">
            <span>{formatBoundPrice(maxPrice)}</span>
            <span>{formatBoundPrice(minPrice)}</span>
          </div>
        )}

        <svg
          className="sparkline-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={tooltipText}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <title>{tooltipText}</title>

          {minPrice === maxPrice || normalizedPoints.length < 2 ? (
            // Clean neutral baseline for steady prices
            <>
              <line
                x1={padding}
                y1={padding + chartHeight / 2}
                x2={padding + chartWidth}
                y2={padding + chartHeight / 2}
                stroke="var(--chart-grid, var(--border))"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={padding + chartWidth}
                cy={padding + chartHeight / 2}
                r="2.5"
                fill="var(--text-muted)"
              />
              {hoverInfo && (
                <>
                  <line
                    x1={hoverInfo.x}
                    y1={padding}
                    x2={hoverInfo.x}
                    y2={padding + chartHeight}
                    stroke="var(--text-muted)"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                  <circle
                    cx={hoverInfo.x}
                    cy={padding + chartHeight / 2}
                    r="3.5"
                    fill="var(--text-muted)"
                    stroke="var(--surface)"
                    strokeWidth="1.5"
                  />
                </>
              )}
            </>
          ) : (
            // Step-line and gradient area fill for active price movements
            <>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stopColor} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={stopColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={fillD} fill={`url(#${gradientId})`} />
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {trend !== 'steady' && (
                <circle
                  cx={lastCoords.x}
                  cy={lastCoords.y}
                  r="5.5"
                  fill={strokeColor}
                  opacity="0.22"
                />
              )}
              <circle
                cx={lastCoords.x}
                cy={lastCoords.y}
                r="2.5"
                fill={strokeColor}
              />
              {hoverInfo && (
                <>
                  <line
                    x1={hoverInfo.x}
                    y1={padding}
                    x2={hoverInfo.x}
                    y2={padding + chartHeight}
                    stroke="var(--text-muted)"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                  <circle
                    cx={hoverInfo.x}
                    cy={hoverInfo.y}
                    r="3.5"
                    fill={strokeColor}
                    stroke="var(--surface)"
                    strokeWidth="1.5"
                  />
                </>
              )}
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

export default Sparkline;
