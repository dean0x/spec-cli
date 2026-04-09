---
description: Validate specification structure, links, layers, and frontmatter
allowed-tools: Read, Glob, Grep, Task
---

# /spec validate

Validate the structural and semantic integrity of specification documents.

This command orchestrates a comprehensive "agentic validation" — running all available validation agents in parallel for maximum coverage.

## Options

| Option | Description |
|--------|-------------|
| `--strict` | Fail on warnings (not just errors) |
| `--json` | Output results as JSON |

Note: `--semantic` and `--deep` flags are accepted for backward compatibility but have no effect — all validation modes always run.

## Execution

You MUST follow these steps exactly:

1. **Parse options** from the user's input: `$ARGUMENTS`
   - Identify flags: `--strict`, `--json`

2. **Spawn all three validation agents in parallel** via the Agent tool:

   **Agent 1 — Structural Validator** (`subagent_type: Structural Validator`):
   - Runs the spec-cli CLI with `--semantic` flag (always includes deterministic semantic checks)
   - Pass `--strict` and `--json` flags if specified by the user
   - This covers: broken links, layer violations, frontmatter, orphans, DDL, file size, self-refs, terminology, staleness, completeness, cross-refs, dependency health, domain coupling, placeholders

   **Agent 2 — Semantic Validator** (`subagent_type: Semantic Validator`):
   - LLM-powered comprehension analysis (non-deterministic)
   - Checks: prose contradictions, coherence gaps, implicit dependencies, schema purity
   - Results are advisory only — never blocking

   **Agent 3 — Dependency Analyzer** (`subagent_type: Dependency Analyzer`):
   - Builds the full dependency graph from markdown links
   - Reports: layer violations, circular dependencies, orphan files, unreferenced files, graph statistics
   - Pass `--violations` and `--stats` flags to get comprehensive output

   All three agents MUST be spawned in a single message (parallel execution).

3. **Report combined results** to the user:

   Present results in three sections:

   ```
   ══════════════════════════════════════
   1. CLI Validation (Structural + Semantic)
   ══════════════════════════════════════
   <Structural Validator results>

   ══════════════════════════════════════
   2. LLM Analysis (Advisory)
   ══════════════════════════════════════
   <Semantic Validator findings>

   ══════════════════════════════════════
   3. Dependency Graph Analysis
   ══════════════════════════════════════
   <Dependency Analyzer results>
   ```

   If `--json`, combine all three into a single JSON object:
   ```json
   {
     "structural": { ... },
     "semantic": { ... },
     "dependencies": { ... }
   }
   ```

## Why All Three?

Each agent catches different classes of issues:

| Agent | What it catches | Deterministic? |
|-------|----------------|----------------|
| Structural Validator | Broken links, layer violations, missing frontmatter, terminology | Yes |
| Semantic Validator | Prose contradictions, coherence gaps, implicit deps | No (LLM) |
| Dependency Analyzer | Graph-level issues, circular deps, orphans, impact | Yes |

Running only one or two leaves blind spots. The full suite provides comprehensive validation.
