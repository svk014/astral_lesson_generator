'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { LessonErrorBoundary } from './LessonErrorBoundary';
import { reportError } from '@/lib/error-reporting';

interface LessonRendererProps {
  lessonId: string;
  compiledJsPath: string | null;
}

/**
 * Client-side component that loads and renders a compiled lesson from storage
 * Dynamically imports the ES module and renders the component
 */
export default function LessonRenderer({ lessonId, compiledJsPath }: LessonRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadAndRenderLesson = async () => {
      try {
        if (!compiledJsPath) {
          throw new Error('No compiled JS path provided');
        }

        const apiUrl = `/api/compiled-js/${lessonId}`;
        const lessonModule = await import(/* webpackIgnore: true */ apiUrl);
        
        if (!mounted) {
          return;
        }

        const Component = lessonModule.default;
        if (!Component || typeof Component !== 'function') {
          throw new Error(`Component is not a function: ${typeof Component}. Module exports: ${Object.keys(lessonModule).join(', ')}`);
        }

        if (!containerRef.current) {
          throw new Error('Container element not found');
        }
        
        if (rootRef.current) {
          rootRef.current.unmount();
        }

        const newRoot = createRoot(containerRef.current);
        rootRef.current = newRoot;
        
        newRoot.render(
          React.createElement(
            LessonErrorBoundary,
            {
              fallback: (err: Error) =>
                React.createElement(
                  'div',
                  { className: 'p-4 text-red-600 border border-red-300 rounded bg-red-50' },
                  React.createElement('h3', { className: 'font-semibold mb-2' }, 'Lesson render error'),
                  React.createElement('p', { className: 'text-sm' }, err.message)
                ),
              children: React.createElement(Component),
            }
          )
        );

        if (mounted) {
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : String(err);
          
          if (err instanceof Error) {
            reportError(err, {
              component: 'LessonRenderer',
              lessonId,
            });
          }
          
          setError(message);
          setLoading(false);
        }
      }
    };

    loadAndRenderLesson();

    return () => {
      mounted = false;
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, [compiledJsPath, lessonId]);

  return (
    <>
      {loading && <div className="p-4">Loading lesson...</div>}
      {error && (
        <div className="p-4 text-red-600 border border-red-300 rounded bg-red-50">
          <h3 className="font-semibold mb-2">Failed to load lesson</h3>
          <p className="text-sm">{error}</p>
        </div>
      )}
      <div ref={containerRef} className="lesson-container" style={{ display: loading || error ? 'none' : 'block' }} />
    </>
  );
}
