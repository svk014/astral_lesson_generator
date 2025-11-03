"use client";

import { useEffect, useState } from "react";
import * as Babel from "@babel/standalone";
import React from "react";

type LessonViewerProps = {
  jsx: string | null;
};

function compileJsx(source: string) {
  const transformed = Babel.transform(source, {
    presets: [
      ["env", { modules: "commonjs", targets: { esmodules: true } }],
      ["react", { runtime: "automatic" }],
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
    if (id === "react") {
      return React;
    }

    throw new Error(`Unsupported import: ${id}`);
  };

  const fn = new Function("exports", "module", "require", "React", transformed.code ?? "");
  fn(exports, moduleLike, require, React);

  const resolved =
    moduleLike.exports.default ??
    (moduleLike.exports as Record<string, unknown>).Lesson ??
    moduleLike.exports;
  if (typeof resolved === "function") {
    return resolved as React.ComponentType;
  }

  throw new Error("Generated code did not export a component");
}

export function LessonViewer({ jsx }: LessonViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [Component, setComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    if (!jsx) {
      setError("Lesson content is not available yet.");
      setComponent(null);
      return;
    }

    try {
      const compiled = compileJsx(jsx);
      setComponent(() => compiled);
      setError(null);
    } catch (err) {
      console.error("Failed to compile JSX", err);
      const message = err instanceof Error ? err.message : "Unknown compilation error";
      setError(message);
      setComponent(null);
    }
  }, [jsx]);

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
    <div className="rounded-lg border bg-card p-6 shadow">
      <Component />
    </div>
  );
}
