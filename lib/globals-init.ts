export async function initializeReactGlobals(): Promise<void> {
  if (typeof globalThis === 'undefined') return;
  
  if ((globalThis as any).__react__) {
    return;
  }

  try {
    const React = await import('react');
    const ReactJsxRuntime = await import('react/jsx-runtime');

    (globalThis as any).__react__ = React.default || React;
    (globalThis as any).__reactJsxRuntime__ = ReactJsxRuntime;
  } catch (error) {
    console.error('[ReactGlobals] Failed to initialize:', error);
    throw new Error('Failed to initialize React globals for dynamic imports');
  }
}
