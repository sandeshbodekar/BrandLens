import { Component } from 'react';

// Last line of defence (SRS 10 "error states"): if a component crashes while rendering,
// show a message and a reload button instead of a blank white page.
// Error boundaries must be class components; React has no hook for this yet.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('UI error:', error.message);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="max-w-md text-sm text-slate-700">The page hit an unexpected problem. Reloading usually fixes it.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Reload the page
        </button>
      </main>
    );
  }
}
