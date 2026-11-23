import { describe, it, expect, vi, beforeEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

describe('ErrorBoundary (Rule #3 UI Guard)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('captures error in state using getDerivedStateFromError', () => {
    const error = new Error('Render crash in ProductHistoryChart');
    const nextState = ErrorBoundary.getDerivedStateFromError(error);

    expect(nextState).toEqual({ error });
  });

  it('logs render error with section and component stack in componentDidCatch', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boundary = new ErrorBoundary({ children: 'Test Child', section: 'Price History' });

    const error = new Error('Null locale formatted with Intl');
    const info = { componentStack: '\n    at ChartComponent\n    at ErrorBoundary' };

    boundary.componentDidCatch(error, info);

    expect(errorSpy).toHaveBeenCalledWith(
      'Render error',
      'Price History',
      error,
      info.componentStack
    );
  });

  it('renders children when state.error is null', () => {
    const boundary = new ErrorBoundary({ children: 'Safe Content', section: 'Dashboard' });
    boundary.state = { error: null };

    const rendered = boundary.render();
    expect(rendered).toBe('Safe Content');
  });

  it('renders section-specific fallback UI when error occurs', () => {
    const boundary = new ErrorBoundary({ children: 'Child', section: 'Store Listings' });
    boundary.state = { error: new Error('Cannot read properties of null') };

    const rendered: any = boundary.render();

    expect(rendered.type).toBe('div');
    expect(rendered.props.className).toBe('error-boundary');

    const children = rendered.props.children;
    // Inspect title
    const titleElement = children[0];
    expect(titleElement.props.children).toBe("Couldn't display Store Listings");

    // Inspect error message pre
    const preElement = children[2];
    expect(preElement.props.children).toBe('Cannot read properties of null');
  });

  it('falls back to generic title when section is omitted', () => {
    const boundary = new ErrorBoundary({ children: 'Child' });
    boundary.state = { error: new Error('Generic failure') };

    const rendered: any = boundary.render();
    const titleElement = rendered.props.children[0];
    expect(titleElement.props.children).toBe('Something went wrong');
  });

  it('resets error state when handleReset is called', () => {
    const boundary = new ErrorBoundary({ children: 'Child' });
    boundary.state = { error: new Error('Temporary failure') };

    boundary.setState = vi.fn().mockImplementation((updater) => {
      const next = typeof updater === 'function' ? updater(boundary.state) : updater;
      boundary.state = { ...boundary.state, ...next };
    });

    boundary.handleReset();

    expect(boundary.setState).toHaveBeenCalledWith({ error: null });
    expect(boundary.state.error).toBeNull();
  });
});
