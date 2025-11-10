# Runtime Validation Module Structure

## Overview
The runtime validation module has been refactored from a single 430-line file into a modular structure with clear separation of concerns.

## File Structure

```
lib/generation/
├── runtimeValidation.ts (79 lines) - Main orchestrator
└── runtime/
    ├── index.ts (10 lines) - Module exports
    ├── jsxRenderer.ts (118 lines) - JSX compilation & rendering
    ├── previewServer.ts (46 lines) - HTTP server for testing
    ├── testGenerator.ts (51 lines) - Gemini test generation
    ├── testExecutor.ts (136 lines) - Stagehand test execution
    └── browserCleanup.ts (65 lines) - Browser resource management
```

**Total: 505 lines (distributed across 7 focused files)**
**Previously: 430 lines (in 1 monolithic file)**

## Module Responsibilities

### 1. `runtimeValidation.ts` (Main Orchestrator)
**Purpose**: Coordinates the entire runtime validation process

**Key Function**:
- `validateJSXRuntime(jsx: string): Promise<RuntimeValidationResult>`

**Flow**:
1. Generate test plan using Gemini
2. Render JSX to static HTML
3. Start preview server
4. Acquire browser from pool
5. Execute tests
6. Return results
7. Cleanup resources

### 2. `runtime/jsxRenderer.ts`
**Purpose**: Compiles and renders JSX components to HTML

**Key Functions**:
- `renderJsxToStaticPage(jsx: string): string`
- Internal: `compileJsxToComponent()`, `ensureDefaultExport()`

**Responsibilities**:
- TypeScript transpilation
- Component execution in Node.js context
- React server-side rendering
- Template injection

### 3. `runtime/previewServer.ts`
**Purpose**: Manages temporary HTTP server for Stagehand testing

**Key Functions**:
- `startRuntimePreviewServer(html: string): Promise<PreviewServer>`

**Responsibilities**:
- Start ephemeral HTTP server on random port
- Serve rendered HTML to browser
- Graceful shutdown

### 4. `runtime/testGenerator.ts`
**Purpose**: Generates runtime test plans using Gemini AI

**Key Functions**:
- `generateRuntimeTestPlan(jsx: string): Promise<RuntimeTestPlan>`

**Responsibilities**:
- Construct Gemini prompt for test generation
- Parse and validate test plan JSON
- Schema validation with Zod

### 5. `runtime/testExecutor.ts`
**Purpose**: Executes runtime tests using Stagehand

**Key Functions**:
- `executeRuntimeTests(stagehand, previewUrl, testPlan): Promise<TestExecutionResult>`
- Internal: `evaluateRuntimeAssertion()`, `isRateLimitError()`

**Responsibilities**:
- Navigate browser to preview URL
- Execute Stagehand extraction tests
- Evaluate assertions (equals, contains, not_empty)
- Retry logic for rate limits
- Collect pass/fail results

### 6. `runtime/browserCleanup.ts`
**Purpose**: Safely cleanup browser resources and release back to pool

**Key Functions**:
- `cleanupBrowserAndRelease(stagehand: Stagehand | null): Promise<void>`

**Responsibilities**:
- Close pages with aggressive timeouts (2s per page)
- Overall cleanup timeout (4s max)
- **Guaranteed browser release** via nested try-finally
- Prevent hanging on page close
- Pool state management

### 7. `runtime/index.ts`
**Purpose**: Central export point for runtime module

**Exports**: All public functions and types from the module

## Benefits of Refactoring

### 1. **Separation of Concerns**
Each file has a single, well-defined responsibility:
- JSX rendering is separate from test execution
- Browser cleanup is isolated from test generation
- HTTP server management is independent

### 2. **Improved Testability**
- Each module can be unit tested independently
- Mock boundaries are clear (e.g., mock `stagehandPool` in tests)
- Easier to test error scenarios

### 3. **Better Maintainability**
- Smaller files are easier to understand
- Changes to browser cleanup don't affect test generation
- Clear dependency graph

### 4. **Enhanced Reusability**
- `jsxRenderer` can be used for other rendering needs
- `previewServer` can serve any HTML content
- `testExecutor` can run tests from any source

### 5. **Clearer Error Boundaries**
- Errors in rendering vs. testing vs. cleanup are isolated
- Stack traces point to specific responsibilities
- Easier debugging

### 6. **Progressive Enhancement**
- Can swap out Stagehand for another browser automation tool
- Can replace Gemini with another test generator
- Can add new assertion types in one place

## Import Patterns

### External Usage (Recommended)
```typescript
import { validateJSXRuntime } from './generation/runtimeValidation';

// Main function - handles everything
const result = await validateJSXRuntime(jsx);
```

### Direct Module Access (Advanced)
```typescript
import { 
  generateRuntimeTestPlan,
  executeRuntimeTests,
  renderJsxToStaticPage 
} from './generation/runtime';

// Use individual functions for custom workflows
const testPlan = await generateRuntimeTestPlan(jsx);
const html = renderJsxToStaticPage(jsx);
// ... etc
```

## Critical Design Decisions

### 1. Nested try-finally for Browser Release
```typescript
try {
  // Page cleanup
} catch {
  // Log errors
} finally {
  // GUARANTEED browser release
  stagehandPool.release(stagehand);
}
```

This ensures the browser is **always** released back to the pool, even if:
- Page cleanup times out
- Unexpected errors occur
- JavaScript runtime issues happen

### 2. Promise-Based Timeouts That Always Resolve
```typescript
const closePageSafely = (page) => {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => resolve(), 2000);
    page.close()
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        resolve();
      });
  });
};
```

This prevents Promise.race rejections that could block the workflow.

### 3. Aggressive Timeouts
- **Per-page**: 2 seconds
- **Overall cleanup**: 4 seconds

These aggressive timeouts prevent hanging while being generous enough for normal operations.

## Migration Notes

### Backward Compatibility
All existing imports continue to work:
```typescript
// Still works
import { validateJSXRuntime } from './generation/runtimeValidation';
```

### No API Changes
The public API (`validateJSXRuntime`) remains identical:
- Same function signature
- Same return type
- Same error handling behavior

### Internal Implementation Only
This refactoring only changes **how** runtime validation is organized internally, not **what** it does.

## Future Enhancements

### Possible Additions
1. **Health checks** - Periodic browser health validation
2. **Metrics** - Track test execution times and success rates
3. **Parallel testing** - Run multiple tests concurrently
4. **Custom assertions** - Add more assertion types beyond equals/contains/not_empty
5. **Screenshot capture** - Visual regression testing
6. **Network mocking** - Mock API responses for tests

### Performance Improvements
1. **Browser warming** - Pre-navigate to blank page
2. **Page pooling** - Reuse pages instead of closing/opening
3. **Caching** - Cache compiled components
4. **Batch testing** - Test multiple lessons in one browser session
