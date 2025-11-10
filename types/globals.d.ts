/**
 * Type definitions for dynamically injected global React objects
 * Used for dynamic lesson imports that can't use ES imports
 */

declare global {
  var __react__: typeof import('react');
  var __reactJsxRuntime__: typeof import('react/jsx-runtime');
}

export {};
