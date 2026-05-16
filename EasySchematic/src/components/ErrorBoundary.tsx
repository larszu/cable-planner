import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("EasySchematic crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white px-6">
        <img src="/favicon.svg" alt="EasySchematic" className="w-16 h-16 mb-6" />
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-slate-400 mb-1 text-center max-w-md">
          EasySchematic hit an unexpected error. Your schematic is saved in your
          browser and will be restored when you reload.
        </p>
        {this.state.error && (
          <pre className="text-xs text-slate-500 mt-2 max-w-lg overflow-auto">
            {this.state.error.message}
          </pre>
        )}
        <button
          className="mt-6 px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
