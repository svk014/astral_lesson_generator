/**
 * Type-safe wrapper for dynamically executed React components
 * Ensures that dynamically loaded code exports valid React components
 */

import React from 'react';

/**
 * Type guard to check if something is a React component
 */
function isReactComponent(value: unknown): value is React.ComponentType {
  return typeof value === 'function';
}

/**
 * Result type for component execution
 */
export type ComponentExecutionResult = {
  success: true;
  component: React.ComponentType;
} | {
  success: false;
  error: Error;
};

/**
 * Safely executes compiled JavaScript code and extracts a React component
 * with proper type checking and error handling
 * 
 * @param compiledCode - Pre-compiled JavaScript code that should export a React component
 * @returns An object indicating success or failure with the component or error
 * 
 * @example
 * const result = executeComponentCode(compiledCode);
 * if (result.success) {
 *   const Component = result.component;
 *   // Use Component safely
 * } else {
 *   console.error('Component execution failed:', result.error);
 * }
 */
export function executeComponentCode(compiledCode: string): ComponentExecutionResult {
  try {
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

    // Try to extract the component in order of preference
    let resolved: unknown =
      (moduleLike.exports as Record<string, unknown>).default ??
      (moduleLike.exports as Record<string, unknown>).Lesson ??
      moduleLike.exports;

    // If resolved is not a function, try to find any exported function
    if (!isReactComponent(resolved)) {
      for (const key in moduleLike.exports) {
        const value = moduleLike.exports[key];
        if (isReactComponent(value)) {
          resolved = value;
          break;
        }
      }
    }

    // Final validation
    if (!isReactComponent(resolved)) {
      return {
        success: false,
        error: new Error(
          `Generated code did not export a valid React component. Exports: ${Object.keys(moduleLike.exports).join(', ') || 'none'}`
        ),
      };
    }

    return {
      success: true,
      component: resolved,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
