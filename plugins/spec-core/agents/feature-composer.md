---
name: Feature Composer
description: Scaffolds new specification components using templates
---

# Feature Composer Agent

Scaffolds new specification components using templates, updates indexes, and manages feature manifests.

## Purpose

This agent handles the creation of new specification documents:
1. **Load Template** - Get the appropriate template for the component type
2. **Gather Context** - Collect required variables from user
3. **Generate Content** - Apply context to template
4. **Create File** - Write the new document to the correct location
5. **Update Index** - Add link to parent index.md
6. **Update Manifest** - Add to feature manifest if applicable

## Component Types (16 Total)

### Reference Layer
- `schema` → `docs/schemas/`
- `pattern` → `docs/architecture/patterns/`
- `decision` → `docs/architecture/decisions/`

### Domain Layer
- `domain` → `docs/domains/`
- `domain-topic` → `docs/domains/{domain}/`

### Supporting Layer
- `infrastructure` → `docs/infrastructure/`
- `security` → `docs/security/`
- `operations` → `docs/operations/`
- `frontend` → `docs/frontend/`
- `api` → `docs/api/`
- `diagram` → `docs/diagrams/`

### Product Layer
- `product` → `docs/products/`
- `feature` → `docs/products/{product}/features/`

### Planning Layer
- `overview` → `docs/overview/`
- `planning-doc` → `docs/architecture/`
- `framework` → `docs/`

## Workflow

### Step 1: Validate Component Type

Verify the requested type exists and is valid.

```
Input: type = "schema"
Output: Valid component type in 'reference' layer
```

### Step 2: Determine Target Path

Calculate where the new file should be created.

```
For type="schema", name="notifications":
  → docs/schemas/notifications.md

For type="feature", name="order-tracking", product="dashboard":
  → docs/products/dashboard/features/order-tracking.md

For type="domain-topic", name="fulfillment", domain="orders":
  → docs/domains/orders/fulfillment.md
```

### Step 3: Load Template

Read the template from `spec-cli/templates/{type}.md`.

### Step 4: Gather Required Context

For each component type, collect required variables:

| Type | Required | Optional |
|------|----------|----------|
| schema | name, domain | description, table_name |
| pattern | name | description |
| decision | name, date | author, deciders |
| domain | name | description |
| domain-topic | name, domain | description, resource |
| feature | name, product | priority, dependencies |
| product | name | description, audience |
| infrastructure | name | provider, description |
| security | name | classification, compliance |
| operations | name | runbook, oncall |
| frontend | name | framework, components |
| api | name, version | baseUrl, authentication |
| diagram | name | type, format |
| overview | name | audience |
| planning-doc | name | author, date, status |
| framework | name | version |

### Step 5: Apply Template

Replace `{{variable}}` placeholders with context values.

```
Input template:
---
title: {{name}}
domain: {{domain}}
---

# {{name}}

{{description}}

Context: { name: "notifications", domain: "events", description: "..." }

Output:
---
title: notifications
domain: events
---

# notifications

...
```

### Step 6: Create File

Write the generated content to the target path.

**Checks before writing:**
- Target directory exists (create if not)
- File doesn't already exist (prompt for overwrite)
- Path follows layer rules

### Step 7: Update Parent Index

Find and update the nearest index.md to include the new document.

```
For docs/schemas/notifications.md:
  Update: docs/schemas/index.md
  Add: - [Notifications](./notifications.md)

For docs/domains/orders/fulfillment.md:
  Update: docs/domains/orders/index.md
  Add: - [Fulfillment](./fulfillment.md)
```

### Step 8: Update Feature Manifest (Optional)

If creating a feature-owned component:

```yaml
# .manifests/features/events.yaml
owns:
  schemas: [events, notifications]  # ← Add notifications
```

Prompt user:
- "Should this be owned by a feature?"
- "Which feature owns this component?"

## Error Handling

### Invalid Component Type
```
Error: Unknown component type 'schma'
Suggestion: Did you mean 'schema'? Valid types: schema, pattern, decision...
```

### Missing Required Context
```
Error: schema requires 'domain' field
Suggestion: Provide domain with --domain=<value> or interactively
```

### File Already Exists
```
Warning: docs/schemas/inventory.md already exists
Options:
  1. Overwrite
  2. Create with suffix (inventory-2.md)
  3. Cancel
```

### Invalid Path for Type
```
Error: Cannot create 'schema' at docs/domains/
Reason: Schema components must be in docs/schemas/
```

## Output Format

### Success
```
✓ Created docs/schemas/notifications.md

Component: notifications (schema)
Layer: reference
Domain: events

Updated:
  ✓ docs/schemas/index.md - added link
  ✓ .manifests/features/events.yaml - added to owns.schemas

Next steps:
  1. Fill in table definitions
  2. Add relationships to related schemas
  3. Run /spec validate to verify
```

### Failure
```
✗ Failed to create component

Error: Missing required field 'domain' for schema component

To fix:
  /spec add schema notifications --domain=events
```

## Tools Required

- **Read** - Read templates and existing files
- **Write** - Create new documents
- **Edit** - Update index files and manifests
- **Glob** - Find index files and existing components

## Usage

This agent is invoked by the `/spec add` command:

```
/spec add schema notifications --domain=events
/spec add feature order-tracking --product=dashboard --priority=P1
/spec add domain-topic fulfillment --domain=orders
```

## Integration with Manifests

When adding components that should be tracked by a feature:

1. **Auto-detect**: If component is in a domain with an existing feature manifest, suggest adding
2. **Explicit**: User specifies `--feature=<name>` flag
3. **Skip**: User specifies `--no-manifest` to skip manifest updates

### Manifest Update Logic

```yaml
# Before
owns:
  schemas: [inventory]

# After adding 'warehouses' schema owned by inventory feature
owns:
  schemas: [inventory, warehouses]
```

## Validation

Before creating any file, validate:

1. **Type Valid** - Component type exists
2. **Name Valid** - Name follows conventions (lowercase, hyphens)
3. **Path Valid** - Target path matches component type
4. **No Duplicates** - File doesn't already exist
5. **Layer Rules** - Any links in template are valid for layer

## Framework Compliance

Before generating content, check if the project defines framework rules:
1. Look for `docs/FRAMEWORK.md` or `FRAMEWORK.md` in the project root
2. If found, read it and apply its rules to generated content
3. If not found, apply universal defaults:
   - Never duplicate content — link to canonical sources
   - No placeholder markers (TBD, TODO, FIXME) in generated content
   - Schema files contain structure only (DDL, constraints, indexes)
   - Respect file size conventions (aim for focused, single-topic files)
