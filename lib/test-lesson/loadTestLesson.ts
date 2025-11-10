import fs from 'fs/promises';
import path from 'path';
import { compileJsxToJs } from '@/lib/generation/jsxCompiler';
import { executeComponentCode } from '@/lib/generation/componentExecutor';

/**
 * Executes compiled JavaScript code in a server context and returns a React component
 */
function executeCompiledCodeOnServer(compiledCode: string): unknown {
  const result = executeComponentCode(compiledCode);
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.component;
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