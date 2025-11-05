export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };
