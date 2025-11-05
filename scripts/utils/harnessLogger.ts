export type ValidationErrors = string[] | undefined;

export class HarnessLogger {
  constructor(
    private readonly outputFile: string,
    private readonly maxAttempts: number,
  ) {}

  showUsage(): void {
    console.error('Usage: bun run validate-and-fix-harness <jsx-file-path>');
  }

  readFailure(err: unknown): void {
    console.error('Failed to read JSX file:', err);
  }

  staticSuccess(currentAttempt: number): void {
    const message =
      currentAttempt === 0
        ? 'Static validation passed. Running runtime checks powered by Gemini + Stagehand...'
        : 'Static validation passed after fixes. Re-running runtime checks powered by Gemini + Stagehand...';
    console.log(message);
  }

  staticFailure(currentAttempt: number, errors: ValidationErrors): boolean {
    if (currentAttempt === this.maxAttempts) {
      console.error('Static validation failed after maximum fix attempts:');
      this.printErrors(errors);
      return true;
    }

    console.log('Static validation failed. Attempting to fix with Gemini...');
    return false;
  }

  runtimeFailure(currentAttempt: number, errors: ValidationErrors): boolean {
    if (currentAttempt === this.maxAttempts) {
      console.error('Runtime validation failed after maximum fix attempts:');
      this.printErrors(errors);
      return true;
    }

    console.error('Runtime validation failed:');
    this.printErrors(errors);
    console.log('Attempting to repair runtime issues with Gemini...');
    return false;
  }

  runtimeSuccess(): void {
    console.log('Runtime tests passed. JSX is ready.');
  }

  savedCandidate(attemptNumber: number): void {
    console.log(`Attempt ${attemptNumber}: candidate written to ${this.outputFile}`);
  }

  exhaustedAttempts(): void {
    console.error('Exceeded maximum fix attempts.');
  }

  private printErrors(errors: ValidationErrors): void {
    for (const error of errors ?? []) {
      console.error(`• ${error}`);
    }
  }
}
