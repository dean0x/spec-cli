---
description: Validate specification structure, links, layers, and frontmatter
allowed-tools: Read, Glob, Grep, Task
---

# /spec validate

Validate the structural and semantic integrity of specification documents.

## Options

| Option | Description |
|--------|-------------|
| `--no-links` | Skip link validation |
| `--no-layers` | Skip layer rule enforcement |
| `--no-frontmatter` | Skip frontmatter validation |
| `--no-orphans` | Skip orphan detection |
| `--semantic` | Also run semantic validation (advisory only) |
| `--json` | Output results as JSON |

## Execution

You MUST follow these steps exactly:

1. **Parse options** from the user's input: `$ARGUMENTS`
   - Identify any `--no-*` flags (skip checks for those categories)
   - Check for `--semantic` flag
   - Check for `--json` flag

2. **Spawn a `Structural Validator` agent** via the Task tool:
   - `subagent_type`: `Structural Validator`
   - In the prompt, tell it:
     - The working directory (current project root with a `docs/` folder)
     - Which checks to skip based on `--no-*` flags
     - Whether to output JSON or text
   - The agent will scan `docs/**/*.md`, run all enabled checks (links, layers, frontmatter, orphans), and return results

3. **If `--semantic` was specified**, ALSO spawn a `Semantic Validator` agent via the Task tool (run in parallel with step 2):
   - `subagent_type`: `Semantic Validator`
   - In the prompt, tell it the working directory
   - It will run terminology, staleness, completeness, and cross-reference checks
   - Its results are advisory only — never blocking

4. **Report combined results** to the user:
   - Show structural results first (errors and warnings)
   - Show semantic results second (advisory warnings) if `--semantic` was requested
   - If `--json`, combine both into a single JSON object: `{ structural: {...}, semantic: {...} }`
