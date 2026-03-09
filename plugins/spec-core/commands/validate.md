---
description: Validate specification structure, links, layers, and frontmatter
allowed-tools: Read, Glob, Grep, Task
---

# /spec validate

Validate the structural and semantic integrity of specification documents.

## Options

| Option | Description |
|--------|-------------|
| `--semantic` | Include deterministic semantic checks (terminology, staleness, completeness, etc.) |
| `--deep` | Run LLM-powered semantic analysis (contradictions, coherence, implicit deps) |
| `--strict` | Fail on warnings (not just errors) |
| `--json` | Output results as JSON |

## Execution

You MUST follow these steps exactly:

1. **Parse options** from the user's input: `$ARGUMENTS`
   - Identify flags: `--semantic`, `--deep`, `--strict`, `--json`

2. **Build CLI flags** to pass through to the Structural Validator:
   - If `--semantic` or `--deep` is present, pass `--semantic` to the CLI
   - If `--strict` is present, pass `--strict` to the CLI
   - If `--json` is present, pass `--json` to the CLI
   - Note: `--deep` is NOT a CLI flag — it controls whether the LLM agent is spawned

3. **Always spawn the Structural Validator agent** via the Task tool:
   - `subagent_type`: `Structural Validator`
   - In the prompt, tell it:
     - The working directory (current project root with a `docs/` folder)
     - The CLI flags to pass through (`--semantic`, `--strict`, `--json`)
   - The agent will run the spec-cli CLI and return structured results

4. **If `--deep` was specified**, also spawn the **Semantic Validator** agent in parallel:
   - `subagent_type`: `Semantic Validator`
   - In the prompt, tell it the working directory
   - It performs LLM comprehension checks: contradictions, coherence gaps, implicit dependencies, schema purity
   - Its results are advisory only — never blocking

5. **Report combined results** to the user:
   - CLI results first (errors, warnings, and semantic advisories if `--semantic`)
   - LLM findings second (if `--deep`)
   - If `--json`, combine both into a single JSON object: `{ structural: {...}, semantic: {...} }`
