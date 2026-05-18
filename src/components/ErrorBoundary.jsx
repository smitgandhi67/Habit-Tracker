import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
          <p className="text-4xl mb-4">⚠️</p>
          <h1 className="text-lg font-bold text-slate-800 mb-1">Something went wrong</h1>
          <p className="text-sm text-slate-500 mb-6">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
