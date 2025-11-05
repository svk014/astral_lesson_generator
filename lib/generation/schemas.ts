import { z } from 'zod';

export const equalsAssertionSchema = z.object({
  type: z.literal('equals'),
  expected: z.string().min(1, 'equals assertion requires expected value'),
});

export const containsAssertionSchema = z.object({
  type: z.literal('contains'),
  expected: z.string().min(1, 'contains assertion requires expected value'),
});

export const notEmptyAssertionSchema = z.object({
  type: z.literal('not_empty'),
  expected: z.undefined().optional(),
});

export const runtimeAssertionSchema = z.discriminatedUnion('type', [
  equalsAssertionSchema,
  containsAssertionSchema,
  notEmptyAssertionSchema,
]);

export const runtimeTestCaseSchema = z.object({
  name: z.string().min(1, 'Test name is required'),
  extractionPrompt: z.string().min(1, 'Extraction prompt is required'),
  assertion: runtimeAssertionSchema,
});

export const runtimeTestPlanSchema = z.object({
  tests: z.array(runtimeTestCaseSchema).min(1, 'At least one test is required').max(5, 'Maximum 5 tests allowed'),
});

export const jsxResponseSchema = z.object({
  jsx: z.string().min(1, 'Gemini returned an empty JSX payload'),
  notes: z.string().optional(),
});

export const validationResultSuccessSchema = z.object({
  valid: z.literal(true),
});

export const validationResultFailureSchema = z.object({
  valid: z.literal(false),
  errors: z.array(z.string()).min(1, 'At least one error required when invalid'),
});

export const validationResultSchema = z.discriminatedUnion('valid', [
  validationResultSuccessSchema,
  validationResultFailureSchema,
]);

export type RuntimeAssertion = z.infer<typeof runtimeAssertionSchema>;
export type EqualsAssertion = z.infer<typeof equalsAssertionSchema>;
export type ContainsAssertion = z.infer<typeof containsAssertionSchema>;
export type NotEmptyAssertion = z.infer<typeof notEmptyAssertionSchema>;
export type RuntimeTestCase = z.infer<typeof runtimeTestCaseSchema>;
export type RuntimeTestPlan = z.infer<typeof runtimeTestPlanSchema>;
export type JsxResponse = z.infer<typeof jsxResponseSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
