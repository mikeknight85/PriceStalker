import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

/**
 * Layout override (issue #123).
 *
 * The layout is chosen purely from the viewport width: `@media (max-width: 968px)`
 * and friends. There is no user-agent sniffing anywhere in the frontend. That is
 * usually the right thing, but it leaves one case with no way out: a high-DPR
 * Android tablet (1600x2560 at DPR 2) reports roughly 800 CSS px, and Chrome's
 * "Request desktop site" only widens the layout viewport to about 980px. Neither
 * clears the 968px breakpoint, so the mobile layout sticks no matter what the
 * user asks the browser for.
 *
 * This is the explicit way out. It deliberately mirrors ThemeContext: one stored
 * preference, one attribute stamped on <html> (`data-layout` beside `data-theme`),
 * and the stylesheets decide what that means.
 *
 * "auto" removes the attribute entirely rather than writing `data-layout="auto"`,
 * so the document is byte-identical to what it was before this existed.
 */
export type LayoutMode = 'auto' | 'desktop' | 'mobile';

interface LayoutContextType {
  mode: LayoutMode;
  setMode: (mode: LayoutMode) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

const STORAGE_KEY = 'layout';

/**
 * Widths used when a layout is forced.
 *
 * Rewriting the viewport meta is the only lever that moves *every* stylesheet at
 * once on a phone or tablet, including the ones with their own breakpoints that
 * this change does not touch. It is exactly what a browser's own "Request
 * desktop site" does, and on a desktop browser it is simply ignored -- which is
 * why the CSS guards below it exist too.
 */
const FORCED_VIEWPORT: Record<Exclude<LayoutMode, 'auto'>, string> = {
  desktop: 'width=1280, viewport-fit=cover',
  mobile: 'width=420, initial-scale=1.0, viewport-fit=cover',
};

const FALLBACK_VIEWPORT = 'width=device-width, initial-scale=1.0, viewport-fit=cover';

function viewportMeta(): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
}

/**
 * The document's own viewport value, captured before anything overwrites it, so
 * that returning to "auto" restores it verbatim instead of a hard-coded guess
 * that could drift away from index.html.
 */
let autoViewport: string | null = null;

function rememberAutoViewport(): string {
  if (autoViewport === null) {
    autoViewport = viewportMeta()?.content ?? FALLBACK_VIEWPORT;
  }
  return autoViewport;
}

function readStoredMode(): LayoutMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'desktop' || saved === 'mobile' ? saved : 'auto';
  } catch {
    // Private windows throw on any localStorage access. No stored preference
    // simply means "auto", which is the default anyway.
    return 'auto';
  }
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<LayoutMode>(readStoredMode);

  // Layout effect, not a plain effect: a stored "desktop" must be in place
  // before the first paint, or the page flashes the mobile layout on every load.
  useLayoutEffect(() => {
    const original = rememberAutoViewport();
    const root = document.documentElement;

    if (mode === 'auto') {
      root.removeAttribute('data-layout');
    } else {
      root.setAttribute('data-layout', mode);
    }

    const meta = viewportMeta();
    if (meta) {
      meta.content = mode === 'auto' ? original : FORCED_VIEWPORT[mode];
    }
  }, [mode]);

  const setMode = (next: LayoutMode) => {
    try {
      if (next === 'auto') {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Private window: the choice still applies to this session, it just will
      // not survive a reload. Better than taking the render down.
    }
    setModeState(next);
  };

  return <LayoutContext.Provider value={{ mode, setMode }}>{children}</LayoutContext.Provider>;
}

export function useLayoutMode() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayoutMode must be used within a LayoutProvider');
  }
  return context;
}
