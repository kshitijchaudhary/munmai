import React from "react";
import { trackError } from "../utils/telemetry";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    trackError("react_render_error", error.message, {
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
          <div className="max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Something went wrong
            </h1>
            <p className="text-slate-500 mb-6">
              We logged the issue. Refresh the page and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
