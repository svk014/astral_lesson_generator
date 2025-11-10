import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ts from 'typescript';

const RUNTIME_TEMPLATE_PLACEHOLDER = '{{CONTENT}}';
const RUNTIME_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  'lib/generation/runtime-preview.template.html',
);

const runtimePreviewTemplate = (() => {
  const template = readFileSync(RUNTIME_TEMPLATE_PATH, 'utf8');
  if (!template.includes(RUNTIME_TEMPLATE_PLACEHOLDER)) {
    throw new Error(
      `Runtime preview template missing placeholder ${RUNTIME_TEMPLATE_PLACEHOLDER} in ${RUNTIME_TEMPLATE_PATH}`,
    );
  }
  return template;
})();

function ensureDefaultExport(source: string): string {
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

  return `${source}\n\nexport default () => React.createElement('div', null, 'Generated lesson did not return a component');`;
}

function compileJsxToComponent(jsx: string): React.ComponentType {
  const prepared = ensureDefaultExport(jsx);
  const transpiled = ts.transpileModule(prepared, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: 'RuntimeLessonComponent.tsx',
    reportDiagnostics: true,
  });

  const diagnostics = transpiled.diagnostics ?? [];
  if (diagnostics.length > 0) {
    const messages = diagnostics
      .map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n'))
      .join('\n');
    throw new Error(`Runtime transpilation failed: ${messages}`);
  }

  const moduleLike = { exports: {} as Record<string, unknown> };

  const requireShim = (id: string) => {
    if (id === 'react') {
      return Object.assign({ default: React }, React);
    }
    if (id === 'react/jsx-runtime') {
      return Object.assign({ default: ReactJsxRuntime }, ReactJsxRuntime);
    }
    throw new Error(`Unsupported import during runtime validation: ${id}`);
  };

  // Use 'eval' with proper scope to avoid 'window is not defined' errors
  // This runs in Node.js context where globalThis and React are properly set up
  try {
    const factory = new Function('exports', 'module', 'require', 'React', 'globalThis', transpiled.outputText ?? '');
    factory(moduleLike.exports, moduleLike, requireShim, React, globalThis);
  } catch (error) {
    console.error('[JSXRenderer] Component execution error:', error);
    throw new Error(
      `Failed to execute component during validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let resolved =
    (moduleLike.exports as Record<string, unknown>).default ??
    (moduleLike.exports as Record<string, unknown>).Lesson ??
    moduleLike.exports;

  if (typeof resolved !== 'function') {
    for (const value of Object.values(moduleLike.exports)) {
      if (typeof value === 'function') {
        resolved = value;
        break;
      }
    }
  }

  if (typeof resolved !== 'function') {
    throw new Error('Runtime validation could not find a component export.');
  }

  return resolved as React.ComponentType;
}

/**
 * Renders JSX to a static HTML page for runtime testing
 */
export function renderJsxToStaticPage(jsx: string): string {
  const Component = compileJsxToComponent(jsx);
  const markup = renderToStaticMarkup(React.createElement(Component));

  return runtimePreviewTemplate.replace(RUNTIME_TEMPLATE_PLACEHOLDER, markup);
}
