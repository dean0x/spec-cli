---
description: Remove a feature and its owned components
allowed-tools: Read, Write, Edit, Glob, Grep, Task, Bash(rm:*), Bash(git status:*)
---

# /spec remove

Remove a feature and its owned components with impact analysis.

## Arguments & Options

| Argument/Option | Required | Description |
|-----------------|----------|-------------|
| `<feature>` | Yes | Name of the feature to remove (matches manifest name) |
| `--dry-run`, `-n` | No | Preview removal without making changes |
| `--force`, `-f` | No | Skip confirmation prompt |
| `--no-markers` | No | Delete broken references instead of marking them |
| `--keep-manifest` | No | Don't delete the feature manifest file |
| `--json`, `-j` | No | Output removal plan as JSON |

## Execution

You MUST follow these steps exactly:

1. **Parse the user's input**: `$ARGUMENTS`
   - Extract the required feature name
   - Identify all flags: `--dry-run`, `--force`, `--no-markers`, `--keep-manifest`, `--json`

2. **Spawn a `Feature Remover` agent** via the Task tool:
   - `subagent_type`: `Feature Remover`
   - In the prompt, tell it:
     - The working directory (current project root with a `docs/` folder)
     - The feature name
     - All parsed flags
   - The agent will load the manifest, analyze impact, and execute removal (or show the dry-run plan)

3. **Report results** to the user:
   - What was deleted
   - What references were marked/updated
   - Next steps (review markers, run validate, commit)
