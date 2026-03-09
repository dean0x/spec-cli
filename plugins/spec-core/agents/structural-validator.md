---
name: Structural Validator
description: Runs spec-cli validation and interprets results
allowed-tools: Read, Glob, Grep, Bash
---

# Structural Validator Agent

Runs the spec-cli CLI to validate specification documents and interprets the results.

## Purpose

This agent executes the spec-cli `validate` command and presents results with explanations. The CLI performs all deterministic checks — this agent does NOT manually reimplement them.

## Workflow

### Step 1: Locate the CLI

Try these in order:

1. **`npx spec validate [flags]`** — works if spec-cli is installed as a dependency or globally
2. If npx fails, search for the CLI binary:
   ```
   Glob: **/dist/cli/index.js
   ```
   Check the project root and parent directories.
3. If found, run: `node <path>/dist/cli/index.js validate [flags]`
4. If nothing found, report error: "spec-cli not found. Install with `npm install -g @spec-cli/core` or ensure it's a project dependency."

### Step 2: Run Validation

Execute the CLI via Bash with the flags provided by the validate command:

```bash
npx spec validate [--semantic] [--strict] [--json]
```

Capture both stdout and stderr.

### Step 3: Interpret Results

Parse the CLI output and present findings with explanations:

- **Errors** — must be fixed before the spec is valid
- **Warnings** — should be addressed but don't block validity
- **Semantic advisories** (with `--semantic`) — suggestions for content improvement

For each finding, explain what the issue means and suggest how to fix it.

## Check Reference

The CLI runs these checks. This section documents them for reference when explaining findings to the user.

### Structural Checks (7)

| Code | Severity | Description |
|------|----------|-------------|
| `BROKEN_LINK` | error | Link target does not exist |
| `LAYER_VIOLATION` | error | Reference violates layer hierarchy |
| `MISSING_REQUIRED_FIELD` | error | Required frontmatter field missing |
| `MISSING_FRONTMATTER` | warning | Component type expects frontmatter |
| `MISSING_RECOMMENDED_FIELD` | warning | Recommended field not present |
| `INVALID_STATUS` | warning | Unusual status value |
| `ORPHAN_DOCUMENT` | warning | Document not referenced anywhere |
| `SELF_REFERENCE` | warning | Document links to itself |
| `DUPLICATE_DDL` | warning | CREATE TABLE in non-schema file when canonical schema exists |
| `FILE_SIZE_EXCEEDED` | warning | File exceeds line limit for its type |

### Semantic Checks (7, with `--semantic`)

| Code | Severity | Description |
|------|----------|-------------|
| `TERMINOLOGY_INCONSISTENCY` | advisory | Term doesn't match glossary in spec.semantic.json |
| `UNDATED_ESTIMATE` | advisory | Time estimate without a date anchor |
| `MISSING_REQUIRED_SECTION` | advisory | Expected section not found |
| `SCOPE_NOT_IN_TYPE` | advisory | Scope prefix not defined in type |
| `ERROR_CODE_OVERLOADED` | advisory | Same error code used in multiple contexts |
| `STATE_DESCRIPTION_CONFLICT` | advisory | Conflicting state descriptions |
| `UNHEALTHY_DEPENDENCY` | advisory | Dependency on unhealthy domain |
| `MISSING_DEPENDENCY` | advisory | Frontmatter dependency references non-existent domain |
| `CIRCULAR_DEPENDENCY` | advisory | Circular dependency between domains |
| `DOMAIN_COUPLING` | advisory | Domain-specific term used outside domain boundary |
| `PLACEHOLDER_MARKER` | advisory | TBD/TODO/FIXME/HACK/PLACEHOLDER found |

## Layer Rules (Strict Hierarchy)

Dependencies flow downward only. Each layer can reference its own layer and any layer below it:

| Layer | Can Reference (other layers) |
|-------|----------------------------|
| reference | (none — foundation only) |
| domain | reference |
| supporting | reference, domain |
| product | reference, domain, supporting |
| planning | reference, domain, supporting, product |

**Exception:** `decision` type (reference layer) can reference all layers — ADRs are cross-cutting documents that inherently discuss domain, supporting, product, and planning concerns.

> Source of truth: `COMPONENT_TYPES` in `src/core/types.ts`

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

## Output Format Example

```
═══════════════════════════════════════════════════════════════
  SPEC VALIDATION ✗ FAILED
═══════════════════════════════════════════════════════════════

  Files checked: 45
  Errors: 3
  Warnings: 7

  docs/schemas/inventory.md
    ✗ [BROKEN_LINK]:12 Broken link: [stock-levels](./stock-levels.md)
      → Check if "docs/schemas/stock-levels.md" exists

  docs/domains/inventory/index.md
    ✗ [LAYER_VIOLATION]:8 Layer violation: domain cannot reference product
      → Domain (domain) can only reference: reference

  docs/domains/inventory/warehouses.md
    ⚠ [ORPHAN_DOCUMENT] Not referenced by any index
      → Add link from docs/domains/inventory/index.md

═══════════════════════════════════════════════════════════════
```
