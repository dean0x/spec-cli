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
| `--semantic` | Run semantic validation (LLM-powered, advisory only) |
| `--json` | Output results as JSON |
| `--fix` | Auto-fix simple issues (not yet implemented) |

## What It Validates

### Structural Validation (Default)

#### 1. Links (BROKEN_LINK)
- All markdown links `[text](path)` resolve to existing files
- Relative paths resolved from source file location
- External links (http/https) are skipped

#### 2. Layer Rules (LAYER_VIOLATION)
Enforces per-type dependency rules. Each component type defines which layers it can reference:
- **Reference layer** types (schema, pattern) can reference domain and supporting
- **Decision** (reference) can also reference planning
- **Domain** types reference only reference (domain-topic also references supporting)
- **Supporting** types reference reference and domain (diagram also references supporting)
- **Product** types reference reference, domain, and supporting (product also references planning)
- **Planning** types reference all lower layers (framework references all layers)

#### 3. Frontmatter (MISSING_REQUIRED_FIELD, MISSING_FRONTMATTER)
- Schema components require: title, domain, status
- Pattern components require: title, status
- Decision components require: title, status, date
- Feature components require: title, status

#### 4. Orphans (ORPHAN_DOCUMENT)
- Warns about documents not referenced from any index or parent
- Excludes index.md, README.md, and entry-point files

### Semantic Validation (--semantic)

When `--semantic` is specified, additional LLM-powered checks run:

#### 1. Contradictions
Detects specs that make conflicting claims:
```
⚠️ SEMANTIC: Potential contradiction
  docs/domains/billing/subscriptions.md:15
    "Subscriptions are billed monthly on the 1st"
  docs/domains/billing/invoices.md:32
    "Invoices are generated on anniversary date"
```

#### 2. Completeness
Identifies missing required sections:
```
⚠️ SEMANTIC: Incomplete specification
  docs/schemas/billing.md
    Missing: Error handling section
```

#### 3. Terminology
Detects inconsistent naming:
```
⚠️ SEMANTIC: Terminology inconsistency
  Concept appears as: "tenant", "organization", "account"
  Consider standardizing on a single term.
```

#### 4. Staleness
Identifies potentially outdated content:
```
⚠️ SEMANTIC: Potentially stale
  docs/architecture/decisions/adr-003.md
    References: RabbitMQ
    Codebase uses: BullMQ
```

**Important:** Semantic validation is advisory only:
- Results are suggestions, not blocking errors
- Should not fail CI pipelines by itself
- May have false positives
- Requires human judgment

## Examples

### Basic validation
```
/spec validate
```

### Skip orphan warnings
```
/spec validate --no-orphans
```

### JSON output for CI
```
/spec validate --json
```

### With semantic validation
```
/spec validate --semantic
```

Output:
```
Structural Validation
=====================
✓ Links: 423 checked, 0 broken
✓ Layers: 423 checked, 0 violations
✓ Frontmatter: 156 checked, 2 warnings
⚠ Orphans: 12 unreferenced files

Semantic Validation (Advisory)
==============================
⚠ Contradictions: 1 potential issue
⚠ Terminology: 2 inconsistencies
✓ Completeness: All required sections present
✓ Staleness: No outdated content detected

Summary: 0 errors, 17 warnings
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed (or only warnings) |
| 1 | Structural errors found (broken links, layer violations) |

Warnings (including all semantic findings) do not cause non-zero exit.

## Implementation

This command invokes the `structural-validator` agent which:

1. **Collects files**: `Glob docs/**/*.md`
2. **Reads each file**: Extracts content and metadata
3. **Runs validators**: Link checker, layer rules, frontmatter, orphan detector
4. **Reports results**: Formatted output with file:line references

When `--semantic` is specified, additionally invokes `semantic-validator` agent:

1. **Groups specs**: By domain for context
2. **Analyzes content**: LLM-powered coherence checks
3. **Cross-references**: Terminology and consistency
4. **Reports warnings**: Advisory findings only

## Integration

### CI Pipeline
```yaml
validate-specs:
  script:
    - claude-code "/spec validate --json" > validation.json
    - exit $(jq '.stats.errors' validation.json)
```

### Pre-commit Hook
```bash
#!/bin/bash
claude-code "/spec validate --no-orphans"
```
