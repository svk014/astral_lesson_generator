"use client";

import { useEffect, useState } from "react";
import React from "react";

type LessonViewerProps = {
  compiledCode?: string | null;
};

/**
 * Executes pre-compiled JavaScript code and extracts the React component.
 * The code is pre-compiled on the backend, so no Babel is needed here.
 */
function executeCompiledCode(compiledCode: string): React.ComponentType {
  const exports = {} as Record<string, unknown>;
  const moduleLike = { exports } as { exports: Record<string, unknown> };

  const require = (id: string) => {
    if (id === "react" || id === "react/jsx-runtime") {
      return React;
    }

    throw new Error(`Unsupported import: ${id}`);
  };

  // Execute the pre-compiled code in a function scope
  const fn = new Function("exports", "module", "require", "React", compiledCode);
  fn(exports, moduleLike, require, React);

  let resolved =
    moduleLike.exports.default ??
    (moduleLike.exports as Record<string, unknown>).Lesson ??
    moduleLike.exports;

  // If resolved is not a function, try to find any exported function
  if (typeof resolved !== "function") {
    for (const key in moduleLike.exports) {
      const value = moduleLike.exports[key];
      if (typeof value === "function") {
        resolved = value;
        break;
      }
    }
  }

  if (typeof resolved === "function") {
    return resolved as React.ComponentType;
  }

  console.error("Module exports:", moduleLike.exports);
  throw new Error("Generated code did not export a component");
}

export function LessonViewer({ compiledCode }: LessonViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [code, setCode] = useState<string | null>(compiledCode ?? null);

  useEffect(() => {
    setError(null);
    setCode(compiledCode ?? null);
  }, [compiledCode]);

  useEffect(() => {
    if (!code) {
      setError("Lesson content is not available yet.");
      setComponent(null);
      return;
    }

    try {
      const compiled = executeCompiledCode(code);
      setComponent(() => compiled);
      setError(null);
    } catch (err) {
      console.error("Failed to execute compiled code", err);
      const message = err instanceof Error ? err.message : "Unknown execution error";
      setError(message);
      setComponent(null);
    }
  }, [code]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to render lesson: {error}
      </div>
    );
  }

  if (!Component) {
    return (
      <div className="rounded-md border bg-muted/10 p-4 text-sm text-muted-foreground">
        Lesson code is still generating. Check back soon!
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow w-full h-full">
      <Component />
    </div>
  );
}
