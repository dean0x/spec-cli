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
| `--no-semantic` | Skip semantic validation |
| `--json` | Output results as JSON |

## Execution

You MUST follow these steps exactly:

1. **Parse options** from the user's input: `$ARGUMENTS`
   - Identify any `--no-*` flags (skip checks for those categories)
   - Check for `--json` flag

2. **Spawn BOTH agents in parallel** via the Task tool:

   a. **Structural Validator** agent:
      - `subagent_type`: `Structural Validator`
      - In the prompt, tell it:
        - The working directory (current project root with a `docs/` folder)
        - Which checks to skip based on `--no-*` flags
        - Whether to output JSON or text
      - The agent will scan `docs/**/*.md`, run all enabled checks (links, layers, frontmatter, orphans), and return results

   b. **Semantic Validator** agent (unless `--no-semantic` was specified):
      - `subagent_type`: `Semantic Validator`
      - In the prompt, tell it the working directory
      - It will run terminology, staleness, completeness, and cross-reference checks
      - Its results are advisory only — never blocking

3. **Report combined results** to the user:
   - Structural results first (errors and warnings)
   - Semantic results second (advisory warnings)
   - If `--json`, combine both into a single JSON object: `{ structural: {...}, semantic: {...} }`
