---
user-invocable: false
---

# Spec Authoring Skill

Guidance for authoring specifications that follow the composable specification framework.

## When to Activate

Activate this skill when:
- Creating new specification documents
- Editing existing specifications
- Adding links between documents
- Working with feature manifests

## Quick Start: Creating Components

Use `/spec add` to create new components from templates:

```
/spec add schema notifications --domain=events
/spec add feature order-tracking --product=dashboard --priority=P1
/spec add decision use-redis-for-caching
```

## Layer Rules

**Per-type canReference.** Before adding a link, verify the reference is valid for the specific component type:

| Type | Layer | Can Reference |
|------|-------|---------------|
| schema | reference | domain, supporting |
| pattern | reference | domain, supporting |
| decision | reference | domain, supporting, planning |
| domain | domain | reference |
| domain-topic | domain | reference, supporting |
| infrastructure, security, operations, frontend, api | supporting | reference, domain |
| diagram | supporting | reference, domain, supporting |
| product | product | reference, domain, supporting, planning |
| feature | product | reference, domain, supporting |
| overview, planning-doc | planning | reference, domain, supporting, product |
| framework | planning | all layers |

**Key:** Reference-layer types (schema, pattern, decision) can reference domain and supporting layers to discuss the concepts they formalize.

### Layer Locations

| Layer | Directories |
|-------|-------------|
| reference | docs/schemas/, docs/architecture/patterns/, docs/architecture/decisions/ |
| domain | docs/domains/ |
| supporting | docs/infrastructure/, docs/security/, docs/operations/, docs/api/, docs/frontend/, docs/diagrams/ |
| product | docs/products/ |
| planning | docs/, docs/overview/, docs/architecture/ (non-pattern/decision) |

## Component Types (16 Total)

### Reference Layer

**Schema** (`docs/schemas/*.md`)
```yaml
---
title: Schema Name
domain: inventory|users|orders|...
description: Brief description
---
```
Create: `/spec add schema <name> --domain=<domain>`

**Pattern** (`docs/architecture/patterns/*.md`)
```yaml
---
title: Pattern Name
status: active|deprecated
description: What problem this solves
---
```
Create: `/spec add pattern <name>`

**Decision** (`docs/architecture/decisions/*.md`)
```yaml
---
title: ADR Title
status: proposed|accepted|deprecated|superseded
date: YYYY-MM-DD
deciders: [names]
---
```
Create: `/spec add decision <name>`

### Domain Layer

**Domain** (`docs/domains/<name>/index.md`)
```yaml
---
title: Domain Name
description: Domain responsibility
---
```
Create: `/spec add domain <name>`

**Domain Topic** (`docs/domains/<domain>/<topic>.md`)
```yaml
---
title: Topic Title
domain: parent-domain
---
```
Create: `/spec add domain-topic <name> --domain=<parent>`

### Supporting Layer

**Infrastructure** (`docs/infrastructure/*.md`)
Create: `/spec add infrastructure <name>`

**Security** (`docs/security/*.md`)
Create: `/spec add security <name>`

**Operations** (`docs/operations/*.md`)
Create: `/spec add operations <name>`

**Frontend** (`docs/frontend/*.md`)
Create: `/spec add frontend <name>`

**API** (`docs/api/*.md`)
```yaml
---
title: API Name
version: "1.0"
---
```
Create: `/spec add api <name> --version=1.0`

**Diagram** (`docs/diagrams/*.md`)
Create: `/spec add diagram <name>`

### Product Layer

**Product** (`docs/products/<name>/index.md`)
Create: `/spec add product <name>`

**Feature** (`docs/products/<product>/features/<name>.md`)
```yaml
---
title: Feature Name
status: planned|active|deprecated
priority: P0|P1|P2|P3
product: parent-product
---
```
Create: `/spec add feature <name> --product=<parent>`

### Planning Layer

**Overview** (`docs/overview/*.md`)
Create: `/spec add overview <name>`

**Planning Doc** (`docs/architecture/*.md`)
Create: `/spec add planning-doc <name>`

**Framework** (`docs/*.md`)
Create: `/spec add framework <name>`

## Linking Best Practices

### Use Relative Paths
```markdown
<!-- Good -->
See [Result Types](../../architecture/patterns/result-types.md)

<!-- Avoid absolute paths -->
See [Result Types](/docs/architecture/patterns/result-types.md)
```

### Link to Specific Sections
```markdown
See [error handling](./api.md#error-responses)
```

### Reference Schemas, Don't Duplicate
```markdown
<!-- Good -->
Uses the [inventory schema](../../schemas/inventory.md).

<!-- Bad: duplicating schema content -->
The inventory table has columns: id, organization_id, quantity...
```

## Feature Manifests

Located in `.manifests/features/<name>.yaml`:

```yaml
feature: inventory
status: active
description: Inventory tracking and warehouse management
owns:
  schemas: [inventory]
  domains: [inventory]
  diagrams: [inventory-flow]
uses:
  schemas: [users, orders]
  patterns: [result-types, organization-context]
```

### Owns vs Uses
- **owns**: This feature is responsible for these components. Removing the feature removes these.
- **uses**: This feature depends on these components but doesn't own them.

### Updating Manifests

When creating components with `/spec add`, use `--feature=<name>` to automatically update the manifest:

```
/spec add schema warehouses --domain=inventory --feature=inventory
```

## Commands Reference

| Command | Purpose |
|---------|---------|
| `/spec add <type> <name>` | Create new component from template |
| `/spec validate` | Check links, layers, frontmatter |
| `/spec graph [file]` | Analyze dependencies |
| `/spec remove <feature>` | Remove feature and owned components |

## Validation

Run `/spec validate` to check structural integrity.

### Structural Checks (always run)

| Check | Codes | Description |
|-------|-------|-------------|
| Link validation | `BROKEN_LINK` | All markdown links resolve to existing files |
| Layer enforcement | `LAYER_VIOLATION` | No upward layer references |
| Frontmatter | `MISSING_FRONTMATTER`, `MISSING_REQUIRED_FIELD`, `MISSING_RECOMMENDED_FIELD`, `INVALID_STATUS` | YAML frontmatter matches component type |
| Orphan detection | `ORPHAN_DOCUMENT` | All documents referenced from at least one index |
| Self-reference | `SELF_REFERENCE` | Documents don't link to themselves |
| DDL duplication | `DUPLICATE_DDL` | CREATE TABLE only in canonical schema files |
| File size | `FILE_SIZE_EXCEEDED` | Files within line limits for their type |

Fix errors before committing. Warnings should be addressed but don't block validity.

### Deterministic Semantic Checks (`--semantic`)

```
/spec validate --semantic
```

| Check | Codes | Description |
|-------|-------|-------------|
| Terminology | `TERMINOLOGY_INCONSISTENCY` | Terms match glossary in spec.semantic.json |
| Staleness | `UNDATED_ESTIMATE` | Time estimates have date anchors |
| Completeness | `MISSING_REQUIRED_SECTION` | Expected sections present |
| Cross-references | `SCOPE_NOT_IN_TYPE`, `ERROR_CODE_OVERLOADED`, `STATE_DESCRIPTION_CONFLICT` | Consistent cross-file references |
| Dependency health | `UNHEALTHY_DEPENDENCY`, `MISSING_DEPENDENCY`, `CIRCULAR_DEPENDENCY` | Frontmatter dependencies valid |
| Domain coupling | `DOMAIN_COUPLING` | Domain terms stay within boundaries |
| Placeholders | `PLACEHOLDER_MARKER` | No TBD/TODO/FIXME/HACK markers |

Semantic findings are advisory only (never affect exit code).

### LLM Semantic Checks (`--deep`)

```
/spec validate --deep
```

| Check | Description |
|-------|-------------|
| Contradictions | Conflicting claims about the same concept across files |
| Coherence | Logical gaps, missing transitions, undefined states |
| Implicit dependencies | Cross-domain references without explicit links |
| Schema purity | Behavioral content in schema files |

LLM findings are advisory and may vary between runs.

## Dependency Analysis

Use `/spec graph` to understand relationships between specs:

### Show What Depends on a File
```
/spec graph docs/schemas/inventory.md
```

### Impact Analysis (Before Removal)
```
/spec graph --impact docs/schemas/inventory.md
```

Shows what would break if this file were removed.

### Show Dependencies of a File
```
/spec graph --dependencies docs/products/dashboard/features/order-tracking.md
```

### Feature Dependencies
```
/spec graph --feature inventory
```

Shows all dependencies for the inventory feature.

### Find Layer Violations
```
/spec graph --violations
```

### Find Orphan Files
```
/spec graph --orphans
```

### Generate Mermaid Diagram
```
/spec graph --mermaid docs/schemas/inventory.md
```

### Graph Statistics
```
/spec graph --stats
```

## Feature Removal

Use `/spec remove` to safely remove features and their owned components.

### Preview Removal
```
/spec remove inventory --dry-run
```

Shows what would be deleted and what references would be marked.

### Execute Removal
```
/spec remove inventory
```

This will:
1. Show impact analysis
2. Ask for confirmation
3. Mark breaking references with `[REMOVED: inventory]`
4. Delete owned files
5. Remove the feature manifest

### Removal Markers

When references break, they're marked:
```markdown
<!-- Before -->
See the [inventory schema](../schemas/inventory.md).

<!-- After -->
See the [REMOVED: inventory] <!-- was: [inventory schema](../schemas/inventory.md) -->.
```

### After Removal
1. Search for `[REMOVED: inventory]` markers
2. Update or remove those references
3. Run `/spec validate` to verify

## Workflow

1. **Create component**: `/spec add <type> <name> [options]`
2. **Fill in template**: Replace TODO sections with real content
3. **Add references**: Link to schemas, patterns, etc.
4. **Validate**: `/spec validate`
5. **Commit**: Include manifest updates
