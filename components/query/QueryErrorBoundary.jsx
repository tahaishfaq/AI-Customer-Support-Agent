"use client";

import { Component } from "react";

export class QueryErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-40 items-center justify-center px-4 py-8">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-center">
          <p className="text-sm font-medium text-destructive">
            This section could not be displayed.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Please retry. Your saved data is unchanged.
          </p>
          <button
            type="button"
            className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            onClick={this.reset}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}
