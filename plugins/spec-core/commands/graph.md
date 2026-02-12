---
description: Analyze and visualize specification dependencies
allowed-tools: Read, Glob, Grep, Task
---

# /spec graph

Analyze and visualize specification dependencies.

## Arguments & Options

| Argument/Option | Description |
|-----------------|-------------|
| `[file]` | Optional target file to analyze. Without it, shows overall stats. |
| `--impact`, `-i` | Full impact analysis (what breaks if file removed) |
| `--dependents`, `-d` | Files that reference this file |
| `--dependencies`, `-D` | Files this file references |
| `--feature=<name>`, `-f` | Analyze files owned by a feature |
| `--violations`, `-v` | List all layer violations |
| `--orphans` | List files with no references |
| `--unreferenced` | List files not referenced by anything |
| `--mermaid`, `-m` | Output as Mermaid diagram |
| `--json`, `-j` | Output as JSON |
| `--max-depth=<n>` | Limit traversal depth (default: 3) |
| `--stats`, `-s` | Show graph statistics |

## Execution

You MUST follow these steps exactly:

1. **Parse the user's input**: `$ARGUMENTS`
   - Extract the optional file path argument
   - Identify all flags: `--impact`, `--dependents`, `--dependencies`, `--feature`, `--violations`, `--orphans`, `--unreferenced`, `--mermaid`, `--json`, `--max-depth`, `--stats`

2. **Spawn a `Dependency Analyzer` agent** via the Task tool:
   - `subagent_type`: `Dependency Analyzer`
   - In the prompt, tell it:
     - The working directory (current project root with a `docs/` folder)
     - The target file path (if provided)
     - All parsed flags and their values
   - The agent will scan `docs/`, build the dependency graph, and perform the requested analysis

3. **Report the agent's results** to the user in the requested format (text tree, mermaid, or JSON)
