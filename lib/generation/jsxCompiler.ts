import * as babel from "@babel/core";

/**
 * Compiles JSX to ES modules with React provided globally at runtime.
 * This is production-grade and handles all edge cases.
 */
export function compileJsxToJs(jsxSource: string): string {
  try {
    const result = babel.transformSync(jsxSource, {
      presets: [
        ["@babel/preset-env", { modules: false }],
        ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
        ["@babel/preset-react", { runtime: "automatic" }],
      ],
      filename: "Lesson.tsx",
      sourceType: "module",
      compact: false,
    });

    if (!result?.code) {
      throw new Error("Babel transformation produced no output");
    }

    let code = result.code;

    // Remove all imports from 'react' and 'react/jsx-runtime'
    // This handles all variations: single-line, multi-line, with/without spaces, etc.
    code = code
      // Remove entire import statements (handles multi-line with 's' flag)
      .replace(/import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]react(?:\/jsx-runtime)?['"]\s*;/g, '')
      // Clean up empty lines left behind
      .replace(/^\s*\n/gm, '');

    // Add runtime globals at the very top
    const header = `// Runtime globals injected by LessonRenderer
const React = globalThis.__react__;
const { jsx: _jsx, jsxs: _jsxs, Fragment: _Fragment } = globalThis.__reactJsxRuntime__;
if (!React || !_jsx || !_jsxs) {
  throw new Error('React globals not available. LessonRenderer must inject __react__ and __reactJsxRuntime__');
}

// Extract hooks and utilities from React
const { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useContext, 
  useReducer, 
  useRef,
  useLayoutEffect,
  useDebugValue,
  useDeferredValue,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useSyncExternalStore,
  useTransition
} = React;
`;

    code = header + '\n' + code;

    // Ensure default export exists
    if (!code.includes('export default')) {
      // Find any component function/const
      const match = code.match(/(?:export\s+)?((?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_]*)\s*[=({])/);
      if (match?.[2]) {
        code += `\n\nexport default ${match[2]};`;
      } else {
        throw new Error(
          'No React component found. Please define a component with a capital letter name.',
        );
      }
    }

    return code;
  } catch (error) {
    throw new Error(
      `JSX compilation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
