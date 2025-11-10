'use client';

import React from 'react';
import { reportError } from '@/lib/error-reporting';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class LessonErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError(error, {
      component: 'LessonErrorBoundary',
      errorBoundaryInfo: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback?.(this.state.error) ?? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            <h3 className="font-semibold mb-2">Failed to render lesson</h3>
            <p className="text-xs opacity-75">{this.state.error.message}</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
