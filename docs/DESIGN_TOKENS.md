# PriceStalker Frontend Design Tokens

> **Verified against `frontend/src/index.css`.** These are the tokens in use. Always use `var(--token)`, never hardcode a hex or pixel value.


These variables are defined in the global stylesheet (`index.css`) under `:root` and override for dark theme (`:root[data-theme="dark"]` and prefers-color-scheme media queries).

Use these standard custom CSS properties (using the `var()` function) rather than hardcoding hexadecimal colors or custom pixel layout borders.

---

## 🎨 Theme Colors

| CSS Variable | Light Theme Value | Dark Theme Value | Usage |
|---|---|---|---|
| `--primary` | `#6366f1` | `#818cf8` | Core brand color, link text, active indicators |
| `--primary-rgb` | `99, 102, 241` | `129, 140, 248` | RGB triplet used for dynamic box-shadow alphas |
| `--primary-dark` | `#4f46e5` | `#6366f1` | Hover state for primary buttons |
| `--secondary` | `#10b981` | `#34d399` | Success indicator, active toggle, positive change |
| `--danger` | `#ef4444` | `#f87171` | Delete actions, error alerts, price increases, offline status |
| `--background` | `#f8fafc` | `#0f172a` | Main body/page background |
| `--surface` | `#ffffff` | `#1e293b` | Cards, panels, input boxes, navigation bars |
| `--text` | `#1e293b` | `#f1f5f9` | Primary headings, body copy, form labels |
| `--text-muted` | `#64748b` | `#94a3b8` | Subtitles, disabled states, helper hints |
| `--border` | `#e2e8f0` | `#334155` | Table boundaries, section dividers, card contours |

---

## 📊 Chart Variables

| CSS Variable | Light Theme Value | Dark Theme Value | Usage |
|---|---|---|---|
| `--chart-grid` | `#e2e8f0` | `#334155` | Sparkline background grids and timeline bounds |
| `--chart-text` | `#94a3b8` | `#64748b` | Sparkline axis label text |

---

## 👤 Shadow Properties

| CSS Variable | Light Theme Value | Dark Theme Value | Usage |
|---|---|---|---|
| `--shadow` | `0 1px 3px rgba(0, 0, 0, 0.1)` | `0 1px 3px rgba(0, 0, 0, 0.3)` | Regular elements elevation (cards, buttons) |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | `0 10px 15px -3px rgba(0,0,0,0.3)` | Modal panels and floating popovers |

---

## 📐 Layout Constraints (Standard Classes)
- **Container**: Max-width is set to `1200px` with `0 auto` margin and `1rem` horizontal padding.
- **Form Controls**: Use `padding: 0.75rem`, `border-radius: 0.5rem`, and transition `border-color 0.2s, box-shadow 0.2s`.
- **Buttons**: Use `padding: 0.75rem 1.5rem` and `border-radius: 0.5rem`.
