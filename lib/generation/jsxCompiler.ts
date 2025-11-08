import * as babel from "@babel/core";

/**
 * Compiles JSX source code to CommonJS-compatible JavaScript
 * that can be safely executed using `new Function()` on the frontend
 */
export function compileJsxToJs(jsxSource: string): string {
  try {
    const result = babel.transformSync(jsxSource, {
      presets: [
        ["@babel/preset-env", { modules: "commonjs" }],
        ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
        ["@babel/preset-react", { runtime: "classic" }],
      ],
      filename: "Lesson.tsx",
      sourceType: "module",
      compact: false,
    });

    if (!result || !result.code) {
      throw new Error("Babel transformation produced no output");
    }

    // Convert ES modules to CommonJS for function execution
    let compiledCode = result.code;

    // Replace ES6 export default with module.exports
    compiledCode = compiledCode.replace(
      /export\s+default\s+/g,
      "module.exports.default = ",
    );

    // Replace other export statements
    compiledCode = compiledCode.replace(
      /export\s+(?!default)\s+(?:const|let|var|function|class)\s+/g,
      "module.exports.$& ",
    );

    return compiledCode;
  } catch (error) {
    throw new Error(
      `JSX compilation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
