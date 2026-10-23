import { Component, ReactNode } from 'react';

/** Keeps a rendering bug in one view from blanking the whole window. Data is unaffected. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="view">
        <div className="notice notice-error" role="alert">
          <strong>This view hit an unexpected error.</strong>
          <p>Your data is safe. Switch views or try again.</p>
          <p className="hint">{this.state.error.message}</p>
          <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      </div>
    );
  }
}
