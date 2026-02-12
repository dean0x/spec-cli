---
description: Create a new specification component from template
allowed-tools: Read, Write, Glob, Grep, Bash(mkdir:*)
---

# /spec add

Create a new specification component from a template.

## Arguments & Options

| Argument/Option | Required | Description |
|-----------------|----------|-------------|
| `<type>` | Yes | Component type (schema, pattern, decision, domain, domain-topic, infrastructure, security, operations, frontend, api, diagram, product, feature, overview, planning-doc, framework) |
| `<name>` | Yes | Name for the component (lowercase, hyphens) |
| `--domain=<name>` | Conditional | Required for schema, domain-topic |
| `--product=<name>` | Conditional | Required for feature |
| `--feature=<name>` | No | Feature manifest to update |
| `--priority=<P0-P3>` | No | Priority for feature type |
| `--version=<ver>` | Conditional | Required for api |
| `--no-manifest` | No | Skip manifest updates |
| `--no-index` | No | Skip index.md updates |
| `--force` | No | Overwrite existing files |
| `--dry-run` | No | Show what would be created without creating |

## Execution

You MUST follow these steps exactly:

1. **Parse the user's input**: `$ARGUMENTS`
   - Extract the required `type` and `name`
   - Extract all option flags and their values

2. **Validate required options** before spawning the agent. If missing, report the error and stop:
   - `schema` requires `--domain`
   - `domain-topic` requires `--domain`
   - `feature` requires `--product`
   - `api` requires `--version`

3. **Spawn a `Feature Composer` agent** via the Task tool:
   - `subagent_type`: `Feature Composer`
   - In the prompt, tell it:
     - The working directory (current project root with a `docs/` folder)
     - The component type and name
     - All parsed options (domain, product, feature, priority, version, force, dry-run, no-manifest, no-index)
   - The agent will load the template, create the file, and update indexes/manifests

4. **Report what was created/updated** to the user
