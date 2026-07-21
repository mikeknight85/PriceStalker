import React from 'react';
import './ErrorBoundary.css';

/**
 * Catches render-time exceptions so one broken component does not take the whole
 * page white.
 *
 * Without this, any throw during render unmounts the entire React tree and the
 * user sees a blank page with nothing to report but "it's blank" -- which is
 * exactly how a null locale reaching toLocaleDateString presented.
 */
interface Props {
  children: React.ReactNode;
  /** Shown in the message so the user can say which part failed. */
  section?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the stack in the console for anyone who opens devtools.
    console.error('Render error', this.props.section ?? '', error, info.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary">
        <h3 className="error-boundary-title">
          {this.props.section ? `Couldn't display ${this.props.section}` : 'Something went wrong'}
        </h3>
        <p className="error-boundary-message">
          The rest of the page still works. If this keeps happening, the details
          below help pin it down.
        </p>
        <pre className="error-boundary-detail">{error.message}</pre>
        <button className="btn btn-secondary" onClick={this.handleReset}>
          Try again
        </button>
      </div>
    );
  }
}
