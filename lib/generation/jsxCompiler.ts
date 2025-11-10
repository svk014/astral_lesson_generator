import * as babel from "@babel/core";

/**
 * Compiles JSX source code to ES modules for client-side rendering
 * Outputs a module that exports the component as default export
 */
export function compileJsxToJs(jsxSource: string): string {
  try {
    const result = babel.transformSync(jsxSource, {
      presets: [
        ["@babel/preset-env", { modules: false }], // ES modules, not CommonJS
        ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
        ["@babel/preset-react", { runtime: "automatic" }], // automatic JSX transform
      ],
      filename: "Lesson.tsx",
      sourceType: "module",
      compact: false,
    });

    if (!result || !result.code) {
      throw new Error("Babel transformation produced no output");
    }

    // Ensure default export is present
    let compiledCode = result.code;

    // If no export default, wrap the last component in default export
    if (!compiledCode.includes("export default") && !compiledCode.includes("export {")) {
      const componentMatch = compiledCode.match(
        /(?:const|let|var|function)\s+([A-Z][A-Za-z0-9_]*)\s*=/,
      );
      if (componentMatch?.[1]) {
        compiledCode += `\n\nexport default ${componentMatch[1]};`;
      } else {
        // Fallback: wrap everything in a default export
        compiledCode = `export default function LessonComponent() {
  return null;
}\n${compiledCode}`;
      }
    }

    return compiledCode;
  } catch (error) {
    throw new Error(
      `JSX compilation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
