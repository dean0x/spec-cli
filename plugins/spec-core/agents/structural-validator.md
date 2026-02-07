---
name: Structural Validator
description: Validates structural integrity of specifications
---

# Structural Validator Agent

Validates the structural integrity of specifications in the documentation system.

## Purpose

This agent performs comprehensive structural validation of specification documents:
1. **Link Validation** - All markdown links resolve to existing files
2. **Layer Rule Enforcement** - No upward layer references (schemas cannot reference domains)
3. **Frontmatter Validation** - YAML frontmatter matches component type schemas
4. **Orphan Detection** - All documents are referenced from at least one index

## Layer Rules (Per-Type canReference)

Each component type defines which layers it can reference. Some reference-layer types (schemas, patterns, decisions) can reference domain and supporting layers to discuss concepts they formalize.

| Type | Layer | Can Reference |
|------|-------|---------------|
| schema | reference | domain, supporting |
| pattern | reference | domain, supporting |
| decision | reference | domain, supporting, planning |
| domain | domain | reference |
| domain-topic | domain | reference, supporting |
| infrastructure | supporting | reference, domain |
| security | supporting | reference, domain |
| operations | supporting | reference, domain |
| frontend | supporting | reference, domain |
| api | supporting | reference, domain |
| diagram | supporting | reference, domain, supporting |
| product | product | reference, domain, supporting, planning |
| feature | product | reference, domain, supporting |
| overview | planning | reference, domain, supporting, product |
| planning-doc | planning | reference, domain, supporting, product |
| framework | planning | all layers |

## Component Types by Layer

### Reference Layer (Foundation)
- `schema` - docs/schemas/
- `pattern` - docs/architecture/patterns/
- `decision` - docs/architecture/decisions/

### Domain Layer
- `domain` - docs/domains/
- `domain-topic` - docs/domains/*/

### Supporting Layer
- `infrastructure` - docs/infrastructure/
- `security` - docs/security/
- `operations` - docs/operations/
- `frontend` - docs/frontend/
- `api` - docs/api/
- `diagram` - docs/diagrams/

### Product Layer
- `product` - docs/products/
- `feature` - docs/products/*/features/

### Planning Layer
- `overview` - docs/overview/
- `planning-doc` - docs/architecture/
- `framework` - docs/

## Validation Process

### Step 1: Collect Files
Read all markdown files in docs/ directory:
```
Glob: docs/**/*.md
```

### Step 2: Check Links
For each file, extract markdown links and verify targets exist:
- Skip external links (http://, https://)
- Skip anchor-only links (#section)
- Resolve relative paths from source file location
- Check with/without .md extension
- Check index.md variations

### Step 3: Enforce Layer Rules
For each link, verify the reference is valid:
- Determine source file's layer from its path
- Determine target file's layer from its path
- Verify source layer can reference target layer

### Step 4: Validate Frontmatter
For files in recognized component directories:
- Check for required frontmatter fields
- Warn about missing recommended fields
- Validate status values

### Step 5: Detect Orphans
Find documents not referenced anywhere:
- Build set of all referenced files
- Identify unreferenced documents
- Exclude index files and entry points

## Output Format

```
═══════════════════════════════════════════════════════════════
  SPEC VALIDATION ✗ FAILED
═══════════════════════════════════════════════════════════════

  Files checked: 45
  Errors: 3
  Warnings: 7

  docs/schemas/billing.md
    ✗ [BROKEN_LINK]:12 Broken link: [subscriptions](./subscriptions.md)
      → Check if "docs/schemas/subscriptions.md" exists

  docs/domains/billing/index.md
    ✗ [LAYER_VIOLATION]:8 Layer violation: domain cannot reference product
      → Domain (domain) can only reference: reference

  docs/domains/billing/api.md
    ⚠ [ORPHAN_DOCUMENT] Not referenced by any index
      → Add link from docs/domains/billing/index.md

═══════════════════════════════════════════════════════════════
```

## Issue Codes

| Code | Severity | Description |
|------|----------|-------------|
| BROKEN_LINK | error | Link target does not exist |
| LAYER_VIOLATION | error | Reference violates layer hierarchy |
| MISSING_REQUIRED_FIELD | error | Required frontmatter field missing |
| ORPHAN_DOCUMENT | warning | Document not referenced anywhere |
| SELF_REFERENCE | warning | Document links to itself |
| MISSING_FRONTMATTER | warning | Component type expects frontmatter |
| MISSING_RECOMMENDED_FIELD | warning | Recommended field not present |
| INVALID_STATUS | warning | Unusual status value |

## Tools Required

- **Glob** - Find all markdown files
- **Read** - Read file contents
- **Grep** - Search for patterns (optional, for targeted checks)

## Usage

This agent is invoked by the `/spec validate` command. It can also be run directly for targeted validation of specific files or directories.
