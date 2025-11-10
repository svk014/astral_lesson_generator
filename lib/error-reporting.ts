type ErrorContext = {
  component?: string;
  userId?: string;
  lessonId?: string;
  [key: string]: unknown;
};

export function reportError(error: Error, context?: ErrorContext): void {
  const errorReport = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    context,
  };

  console.error('[ErrorReporter]', errorReport);

  // TODO: Connect to Sentry/DataDog in production
}

export function reportMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
  console.log(`[ErrorReporter] ${level.toUpperCase()}: ${message}`, context);

  // TODO: Connect to Sentry/DataDog in production
}
