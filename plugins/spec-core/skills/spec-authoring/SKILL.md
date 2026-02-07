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
/spec add feature user-alerts --product=web --priority=P1
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
domain: billing|auth|properties|...
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
Uses the [billing schema](../../schemas/billing.md).

<!-- Bad: duplicating schema content -->
The billing table has columns: id, tenant_id, amount...
```

## Feature Manifests

Located in `.manifests/features/<name>.yaml`:

```yaml
feature: billing
status: active
description: Subscription billing and payment processing
owns:
  schemas: [billing]
  domains: [billing]
  diagrams: [billing-flow]
uses:
  schemas: [tenants, users]
  patterns: [result-types, tenant-context]
```

### Owns vs Uses
- **owns**: This feature is responsible for these components. Removing the feature removes these.
- **uses**: This feature depends on these components but doesn't own them.

### Updating Manifests

When creating components with `/spec add`, use `--feature=<name>` to automatically update the manifest:

```
/spec add schema invoices --domain=billing --feature=billing
```

## Commands Reference

| Command | Purpose |
|---------|---------|
| `/spec add <type> <name>` | Create new component from template |
| `/spec validate` | Check links, layers, frontmatter |
| `/spec graph [file]` | Analyze dependencies |
| `/spec remove <feature>` | Remove feature and owned components |

## Validation

Run `/spec validate` to check:
- All links resolve
- No layer violations
- Required frontmatter present
- No orphan documents

Fix issues before committing.

### Semantic Validation

Add `--semantic` for LLM-powered content analysis:

```
/spec validate --semantic
```

Checks for:
- **Contradictions** - Conflicting claims between specs
- **Completeness** - Missing required sections
- **Terminology** - Inconsistent naming
- **Staleness** - Outdated references

Semantic findings are advisory only (warnings, not errors).

## Dependency Analysis

Use `/spec graph` to understand relationships between specs:

### Show What Depends on a File
```
/spec graph docs/schemas/billing.md
```

### Impact Analysis (Before Removal)
```
/spec graph --impact docs/schemas/billing.md
```

Shows what would break if this file were removed.

### Show Dependencies of a File
```
/spec graph --dependencies docs/products/web/features/billing.md
```

### Feature Dependencies
```
/spec graph --feature billing
```

Shows all dependencies for the billing feature.

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
/spec graph --mermaid docs/schemas/billing.md
```

### Graph Statistics
```
/spec graph --stats
```

## Feature Removal

Use `/spec remove` to safely remove features and their owned components.

### Preview Removal
```
/spec remove billing --dry-run
```

Shows what would be deleted and what references would be marked.

### Execute Removal
```
/spec remove billing
```

This will:
1. Show impact analysis
2. Ask for confirmation
3. Mark breaking references with `[REMOVED: billing]`
4. Delete owned files
5. Remove the feature manifest

### Removal Markers

When references break, they're marked:
```markdown
<!-- Before -->
See the [billing schema](../schemas/billing.md).

<!-- After -->
See the [REMOVED: billing] <!-- was: [billing schema](../schemas/billing.md) -->.
```

### After Removal
1. Search for `[REMOVED: billing]` markers
2. Update or remove those references
3. Run `/spec validate` to verify

## Workflow

1. **Create component**: `/spec add <type> <name> [options]`
2. **Fill in template**: Replace TODO sections with real content
3. **Add references**: Link to schemas, patterns, etc.
4. **Validate**: `/spec validate`
5. **Commit**: Include manifest updates
