'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import { LessonErrorBoundary } from './LessonErrorBoundary';

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
    let currentRoot: ReturnType<typeof createRoot> | null = null;

    const loadAndRenderLesson = async () => {
      try {
        if (!compiledJsPath) {
          throw new Error('No compiled JS path provided');
        }

        // CRITICAL: Ensure globals are set BEFORE importing the module
        // because the module code runs its destructuring at import time
        if (typeof globalThis !== 'undefined') {
          (globalThis as any).__react__ = React;
          (globalThis as any).__reactJsxRuntime__ = ReactJsxRuntime;
        }

        console.log('[LessonRenderer] Loading lesson:', lessonId);
        console.log('[LessonRenderer] Globals set:', {
          hasReact: !!(globalThis as any).__react__,
          hasRuntime: !!(globalThis as any).__reactJsxRuntime__,
        });

        // Use our API proxy to bypass CORS and ensure proper headers
        const apiUrl = `/api/compiled-js/${lessonId}`;
        console.log('[LessonRenderer] Fetching from API:', apiUrl);

        // Dynamically import the compiled lesson module through our API
        console.log('[LessonRenderer] Importing module...');
        const lessonModule = await import(/* webpackIgnore: true */ apiUrl);
        
        console.log('[LessonRenderer] Module imported, checking for default export...');
        console.log('[LessonRenderer] Module exports:', Object.keys(lessonModule));
        
        if (!mounted) {
          console.log('[LessonRenderer] Component unmounted, aborting render');
          return;
        }

        const Component = lessonModule.default;
        if (!Component || typeof Component !== 'function') {
          throw new Error(`Component is not a function: ${typeof Component}. Module exports: ${Object.keys(lessonModule).join(', ')}`);
        }

        console.log('[LessonRenderer] Component valid, rendering...');
        console.log('[LessonRenderer] Component:', Component.toString().substring(0, 200));

        // Render the component into the container
        if (!containerRef.current) {
          console.error('[LessonRenderer] Container ref is null!');
          throw new Error('Container element not found');
        }

        console.log('[LessonRenderer] Container element:', containerRef.current);
        
        // Clean up any existing root before creating a new one
        if (rootRef.current) {
          console.log('[LessonRenderer] Unmounting existing root');
          rootRef.current.unmount();
          rootRef.current = null;
        }

        // Create new root for this render
        currentRoot = createRoot(containerRef.current);
        rootRef.current = currentRoot;
        
        // Wrap component in error boundary for runtime errors
        currentRoot.render(
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
        console.log('[LessonRenderer] Rendered successfully');
        console.log('[LessonRenderer] Container HTML after render:', containerRef.current.innerHTML.substring(0, 200));

        if (mounted) {
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[LessonRenderer] Error:', message);
          console.error('[LessonRenderer] Full error:', err);
          setError(message);
          setLoading(false);
        }
      }
    };

    loadAndRenderLesson();

    // Cleanup function: unmount root and mark as unmounted
    return () => {
      mounted = false;
      if (currentRoot) {
        console.log('[LessonRenderer] Cleaning up root on unmount/re-render');
        currentRoot.unmount();
      }
      if (rootRef.current === currentRoot) {
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
