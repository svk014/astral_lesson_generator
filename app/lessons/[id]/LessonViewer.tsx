"use client";

import { useEffect, useState } from "react";
import * as Babel from "@babel/standalone";
import React from "react";

type LessonViewerProps = {
  jsx?: string | null;
  jsxUrl?: string | null;
};

function ensureExport(source: string) {
  if (/export\s+(default\s+)?[A-Za-z]/.test(source) || /module\.exports/.test(source)) {
    return source;
  }

  const componentMatch = source.match(
    /(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^=]*\)\s*=>|function\s*\()/,
  );

  if (componentMatch?.[1]) {
    return `${source}\n\nexport default ${componentMatch[1]};`;
  }

  const functionMatch = source.match(/function\s+([A-Z][A-Za-z0-9_]*)\s*\(/);
  if (functionMatch?.[1]) {
    return `${source}\n\nexport default ${functionMatch[1]};`;
  }

  return `${source}\n\nexport default () => React.createElement("div", null, "Generated lesson did not return a component");`;
}

function compileJsx(source: string) {
  const preparedSource = ensureExport(source);

  const transformed = Babel.transform(preparedSource, {
    presets: [
      ["env", { modules: "commonjs", targets: { esmodules: true } }],
      ["react", { runtime: "classic" }],
      "typescript",
    ],
    filename: "Lesson.tsx",
    sourceType: "module",
    parserOpts: {
      plugins: ["jsx", "typescript"],
    },
    generatorOpts: {
      compact: false,
    },
  });

  const exports = {} as Record<string, unknown>;
  const moduleLike = { exports } as { exports: Record<string, unknown> };

  const require = (id: string) => {
    if (id === "react" || id === "react/jsx-runtime") {
      return React;
    }

    throw new Error(`Unsupported import: ${id}`);
  };

  const fn = new Function("exports", "module", "require", "React", transformed.code ?? "");
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

export function LessonViewer({ jsx, jsxUrl }: LessonViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [jsxContent, setJsxContent] = useState<string | null>(jsx ?? null);

  useEffect(() => {
    setError(null);
    setJsxContent(jsx ?? null);
  }, [jsx]);

  useEffect(() => {
    if (!jsxContent) {
      setError("Lesson content is not available yet.");
      setComponent(null);
      return;
    }

    try {
      const compiled = compileJsx(jsxContent);
      setComponent(() => compiled);
      setError(null);
    } catch (err) {
      console.error("Failed to compile JSX", err);
      const message = err instanceof Error ? err.message : "Unknown compilation error";
      setError(message);
      setComponent(null);
    }
  }, [jsxContent]);

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
