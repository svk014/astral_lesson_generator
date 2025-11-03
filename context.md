# Project Context

## Snapshot
- **App**: Next.js + Bun workspace for generating and viewing “astral lessons”.
- **Key Services**: Google Gemini for JSX generation, Supabase for storage, Temporal for orchestration.
- **CLI Harness**: `bun run harness --outline "<lesson outline>"` drives generation via `scripts/generation-harness.ts` and logs to `sandbox/logs.json`.

## Gemini Integration
- Client defined in `lib/gemini/client.ts`.
- `.env` must define `GEMINI_API_KEY`; the harness imports `dotenv/config` so `.env` entries are loaded automatically.
- **Current model policy**: `supportedModels` now contains only `gemini-2.5-pro`, per the latest manual change. Any other value (including the earlier 1.5 series) will trigger a warning and silently fall back to `gemini-1.5-pro`.
- **Docs/UI**: README and `.env.example` have been updated outside this session to advertise `gemini-2.5-pro` as the default.
- **Compatibility note**: The Google Generative Language v1beta API officially lists the `gemini-1.5-*` family for `generateContent`. Calling `gemini-2.5-pro` may work only for allowlisted projects; for broader portability we previously recommended the `1.5` models.
- Unsupported identifiers still trigger a console warning and fallback path to prevent the harness from hanging after `refinePrompt`.

## Generation Pipeline Highlights
1. **Prompt refinement** → `refinePromptWithSystemMessage` frames the request.
2. **Gemini call** → `generateJSXWithGemini` requests minified JSON (`{ jsx, notes }`), strips fences, and validates with Zod.
3. **Static validation** → Transpiles JSX using TypeScript; errors reformat into readable diagnostics.
4. **Iterative repair** → `fixIssuesWithGemini` loops with diagnostics when static validation fails.
5. **Storage (optional)** → `storeJSX` saves to Supabase bucket `lessons` under `lessonId/<uuid>.jsx`.
6. **Logging** → Each step recorded via hooks; artifacts written to `sandbox/logs.json` during harness runs.

## Recent Changes
- Model allowlist now hard-codes `gemini-2.5-pro` as the only explicitly supported identifier; fallback still resolves to `gemini-1.5-pro` when an unknown model is supplied.
- Documentation (`README.md`) and sample env file (`.env.example`) were manually updated to highlight `gemini-2.5-pro` as the default setting.
- Harness environment loading is handled via `import "dotenv/config"` in `scripts/generation-harness.ts` (already merged earlier).

## Open Questions / Observations
- Runtime validation (`validateJSXRuntime`) is currently a stub; consider adding a lightweight render test (e.g., via Playwright or React Testing Library).
- Temporal workflow integration reuses the same generation runner; ensure Temporal workers pick up the new model fallback once deployed.
- `sandbox/output.jsx` is only created on successful generation; none exists yet for the latest run because the harness never reached completion.

## Next Steps
1. **Confirm API access**: Verify the current credentials are authorized to call `gemini-2.5-pro` (ListModels via Google AI Studio or a curl probe) to avoid silent fallbacks.
2. **Smoke test**: Re-run `bun run harness --outline "Summarize the phases of the moon for middle schoolers."` and confirm `sandbox/output.jsx` and `logs.json` show a completed flow when the 2.5 model is active.
3. **Monitor fallback warning**: Watch terminal output for the `[Gemini] Unsupported model` warning; if it appears, the request actually used `gemini-1.5-pro`.
4. **Build check** *(optional but recommended)*: `bun run build` to ensure Next.js compiles cleanly with the environment changes.
5. **Extend validation** *(future work)*: Implement runtime JSX validation and corresponding tests.
6. **Document deployment** *(future work)*: Confirm Temporal and Supabase environments mirror the chosen model configuration and update ops runbooks if needed.
