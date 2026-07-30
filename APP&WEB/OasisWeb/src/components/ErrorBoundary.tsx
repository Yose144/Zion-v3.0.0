'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import GlassPanel from './GlassPanel';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('OASIS ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full w-full items-center justify-center p-4">
          <GlassPanel className="max-w-md text-center">
            <h2 className="mb-2 text-xl font-bold text-oasis-cyan">Something went wrong</h2>
            <p className="mb-4 text-sm text-gray-400">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-oasis-cyan/20 px-4 py-2 text-sm font-medium text-oasis-cyan transition hover:bg-oasis-cyan/30"
            >
              <RotateCcw className="h-4 w-4" />
              Reload
            </button>
          </GlassPanel>
        </div>
      );
    }
    return this.props.children;
  }
}
