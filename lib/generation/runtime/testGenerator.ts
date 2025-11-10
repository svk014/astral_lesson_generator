import { stripJsonFence } from '../../utils';
import { geminiModel } from '../../gemini/client';
import { runtimeTestPlanSchema, type RuntimeTestPlan } from '../schemas';

export const generationConfig = {
  responseMimeType: 'application/json',
};

/**
 * Uses Gemini to generate a runtime test plan for validating JSX component
 */
export async function generateRuntimeTestPlan(jsx: string): Promise<RuntimeTestPlan> {
  const instructions = `You are validating a JSX lesson component. Produce between 1 and 3 runtime tests.

Return strictly minified JSON matching:
{ "tests": [ { "name": string, "extractionPrompt": string, "assertion": { "type": "equals" | "contains" | "not_empty", "expected"?: string } } ] }

Guidelines:
- Test ONLY the initial rendered content on page load. Do NOT test outcomes of user interactions (form submissions, button clicks, state changes, multi-step workflows).
- Do NOT assert on content inside conditionally rendered sections that might not be visible by default.
- Do NOT assert on outcomes of animations or transitions.
- Focus on verifying meaningful UI text that is present without any user action required.
- Prompts will be executed via Stagehand's extract(textPrompt, z.string()). Ask for concise answers.
- Use "equals" only for short, standalone strings such as button labels or titles that appear exactly as-is. If there is any chance of surrounding context, punctuation, or multi-line layout, use "contains" instead.
- Use "not_empty" when checking presence without specific value.
- Do NOT include explanations or markdown.

JSX to inspect:
${jsx}`;

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: instructions }] }],
    generationConfig,
  });

  const raw = result?.response?.text();
  if (!raw) {
    throw new Error('Gemini did not return runtime validation tests.');
  }

  const sanitized = stripJsonFence(raw);
  const parseResult = runtimeTestPlanSchema.safeParse(JSON.parse(sanitized));
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid runtime test plan: ${issues}`);
  }

  return parseResult.data;
}
