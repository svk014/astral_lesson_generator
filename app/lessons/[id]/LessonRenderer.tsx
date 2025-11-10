'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';

interface LessonRendererProps {
  compiledJsPath: string | null;
}

/**
 * Client-side component that loads and renders a compiled lesson from storage
 * Dynamically imports the ES module and renders the component
 */
export default function LessonRenderer({ compiledJsPath }: LessonRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadAndRenderLesson = async () => {
      try {
        if (!compiledJsPath) {
          throw new Error('No compiled JS path provided');
        }

        // Dynamically import the compiled lesson module from storage
        // The module exports a default React component
        const lessonModule = await import(/* webpackIgnore: true */ compiledJsPath);
        
        if (!mounted) return;

        const Component = lessonModule.default;
        if (!Component || typeof Component !== 'function') {
          throw new Error('Compiled module does not export a valid React component');
        }

        // Render the component into the container
        if (containerRef.current) {
          const root = createRoot(containerRef.current);
          root.render(React.createElement(Component));
        }

        setLoading(false);
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[LessonRenderer] Failed to load lesson:', message);
          setError(message);
          setLoading(false);
        }
      }
    };

    loadAndRenderLesson();

    return () => {
      mounted = false;
    };
  }, [compiledJsPath]);

  if (loading) {
    return <div className="p-4">Loading lesson...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 border border-red-300 rounded bg-red-50">
        <h3 className="font-semibold mb-2">Failed to load lesson</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return <div ref={containerRef} className="lesson-container" />;
}
