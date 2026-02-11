---
description: Validate specification structure, links, layers, and frontmatter
allowed-tools: Read, Glob, Grep, Task
---

# /spec validate

Validates the structural and semantic integrity of specification documents.

## Usage

```
/spec validate [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--no-links` | Skip link validation |
| `--no-layers` | Skip layer rule enforcement |
| `--no-frontmatter` | Skip frontmatter validation |
| `--no-orphans` | Skip orphan detection |
| `--no-semantic` | Skip semantic validation (structural only) |
| `--json` | Output results as JSON |

## What It Validates

### Structural (structural-validator agent)

Deterministic checks that produce consistent, reproducible results:

1. **Links** (BROKEN_LINK) — All markdown links resolve to existing files
2. **Layer Rules** (LAYER_VIOLATION) — Dependencies flow downward only through the layer hierarchy
3. **Frontmatter** (MISSING_REQUIRED_FIELD, MISSING_FRONTMATTER) — Required YAML frontmatter per component type
4. **Orphans** (ORPHAN_DOCUMENT) — Documents not referenced from any index or parent

### Semantic (semantic-validator agent)

LLM-powered analysis that catches what deterministic checks cannot:

1. **Contradictions** — Conflicting claims about the same concept across documents
2. **Coherence** — Logical gaps, incomplete state machines, unexplained references within documents
3. **Implicit Dependencies** — Cross-document relationships with no explicit links
4. **Missing Information** — Gaps in coverage that aren't about missing headings or sections

Semantic findings are always **advisory** — they never block or affect exit codes.

## Implementation

This command orchestrates two agents:

### 1. Structural Validation

Invoke the **structural-validator** agent:

- Globs `docs/**/*.md`
- Reads each file
- Checks links, layer rules, frontmatter, orphans
- Reports errors and warnings with file:line references

### 2. Semantic Validation

Invoke the **semantic-validator** agent (unless `--no-semantic`):

- Reads `spec.semantic.json` for ignore patterns
- Globs `docs/**/*.md`, filters ignored files
- Groups files by domain
- Analyzes contradictions, coherence, implicit dependencies, missing information
- Reports advisory findings

### 3. Summary

Combine results from both agents:

```
Structural Validation
=====================
Links: <checked> checked, <broken> broken
Layers: <checked> checked, <violations> violations
Frontmatter: <checked> checked, <issues> issues
Orphans: <unreferenced> unreferenced files

Semantic Validation (Advisory)
==============================
Contradictions: <count>
Coherence: <count>
Implicit Dependencies: <count>
Missing Information: <count>

Summary: <errors> errors, <warnings> warnings, <semantic> semantic findings (advisory)
```

## Examples

### Full validation (structural + semantic)
```
/spec validate
```

### Structural only
```
/spec validate --no-semantic
```

### Skip orphan warnings
```
/spec validate --no-orphans
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All structural checks passed (or only warnings/semantic findings) |
| 1 | Structural errors found (broken links, layer violations, missing required fields) |

Semantic findings never cause non-zero exit.

## CLI vs Agentic Validation

This command (`/spec validate`) is the **agentic path** — LLM agents read files directly and analyze content.

For **deterministic, CI-friendly validation**, use the CLI:

```bash
spec validate                # Structural checks (TypeScript, fast, reproducible)
spec validate --semantic     # Structural + deterministic semantic (terminology, staleness, completeness)
```

The CLI and this command are independent paths. The CLI is better for CI pipelines (deterministic, fast). This command is better for deep analysis (catches prose contradictions, logical gaps).
