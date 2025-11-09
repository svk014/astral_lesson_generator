import fs from 'fs/promises';
import path from 'path';
import { compileJsxToJs } from '@/lib/generation/jsxCompiler';

/**
 * Executes compiled JavaScript code in a server context and returns a React component
 */
function executeCompiledCodeOnServer(compiledCode: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as unknown;
  const exports: Record<string, unknown> = {};
  const moduleLike = { exports } as { exports: Record<string, unknown> };

  const customRequire = (id: string): unknown => {
    if (id === "react" || id === "react/jsx-runtime") {
      return React;
    }
    throw new Error(`Unsupported import: ${id}`);
  };

  // Execute the pre-compiled code in a server function scope
  const fn = new Function("exports", "module", "require", "React", compiledCode);
  fn(exports, moduleLike, customRequire, React);

  let resolved: unknown =
    (moduleLike.exports as Record<string, unknown>).default ??
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
    return resolved;
  }

  throw new Error("Generated code did not export a component");
}

export type TestLessonResult = {
  lesson: {
    id: string;
    outline: string;
    jsxSource: string;
    compiledCode: string;
    renderedHtml: string;
    created_at: string;
    updated_at: string;
  };
  renderedHtml: string;
};

export async function loadTestLessonDirect(): Promise<TestLessonResult | null> {
  try {
    const outputPath = path.join(process.cwd(), 'sandbox', 'output.jsx');
    const jsxSource = await fs.readFile(outputPath, 'utf-8');

    // Compile the JSX to JavaScript
    const compiledCode = compileJsxToJs(jsxSource);

    // Execute the compiled code on the server to get the React component
    const Component = executeCompiledCodeOnServer(compiledCode);

    // Dynamically import react-dom/server and React only when needed
    const reactDomServer = await import('react-dom/server');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react') as typeof import('react');

    // Render the component to static HTML
    const renderedHtml = reactDomServer.renderToStaticMarkup(React.createElement(Component as React.ComponentType));

    const lesson = {
      id: 'test-lesson',
      outline: 'Test lesson from harness output',
      jsxSource,
      compiledCode,
      renderedHtml,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      lesson,
      renderedHtml,
    };
  } catch (error) {
    console.error('Failed to load test lesson', error);
    return null;
  }
}