# /spec add

Creates a new specification component from a template.

## Usage

```
/spec add <type> <name> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `type` | Yes | Component type (see types below) |
| `name` | Yes | Name for the new component (lowercase, hyphens) |

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `--domain=<name>` | `-d` | Domain for schema/domain-topic types |
| `--product=<name>` | `-p` | Product for feature type |
| `--feature=<name>` | `-f` | Feature manifest to update |
| `--priority=<P0-P3>` | | Priority for feature type |
| `--version=<ver>` | `-v` | Version for api type |
| `--no-manifest` | | Skip manifest updates |
| `--no-index` | | Skip index.md updates |
| `--force` | | Overwrite existing files |
| `--dry-run` | | Show what would be created without creating |

## Component Types

### Reference Layer (Foundation)

| Type | Directory | Required Options |
|------|-----------|------------------|
| `schema` | docs/schemas/ | `--domain` |
| `pattern` | docs/architecture/patterns/ | - |
| `decision` | docs/architecture/decisions/ | - |

### Domain Layer

| Type | Directory | Required Options |
|------|-----------|------------------|
| `domain` | docs/domains/ | - |
| `domain-topic` | docs/domains/{domain}/ | `--domain` |

### Supporting Layer

| Type | Directory | Required Options |
|------|-----------|------------------|
| `infrastructure` | docs/infrastructure/ | - |
| `security` | docs/security/ | - |
| `operations` | docs/operations/ | - |
| `frontend` | docs/frontend/ | - |
| `api` | docs/api/ | `--version` |
| `diagram` | docs/diagrams/ | - |

### Product Layer

| Type | Directory | Required Options |
|------|-----------|------------------|
| `product` | docs/products/ | - |
| `feature` | docs/products/{product}/features/ | `--product` |

### Planning Layer

| Type | Directory | Required Options |
|------|-----------|------------------|
| `overview` | docs/overview/ | - |
| `planning-doc` | docs/architecture/ | - |
| `framework` | docs/ | - |

## Examples

### Create a schema

```
/spec add schema notifications --domain=events
```

Creates `docs/schemas/notifications.md` with:
- Frontmatter with title and domain
- Table structure template
- Relationships section

### Create a feature

```
/spec add feature user-alerts --product=web --priority=P1 --feature=alerts
```

Creates `docs/products/web/features/user-alerts.md` and updates:
- `docs/products/web/features/index.md`
- `.manifests/features/alerts.yaml`

### Create a domain topic

```
/spec add domain-topic scanning --domain=properties
```

Creates `docs/domains/properties/scanning.md` with:
- Link to parent domain
- Reference to related schemas

### Create an ADR

```
/spec add decision use-bullmq-for-jobs
```

Creates `docs/architecture/decisions/use-bullmq-for-jobs.md` with:
- Status: proposed
- Date: today
- ADR template sections

### Dry run

```
/spec add schema billing --domain=billing --dry-run
```

Shows what would be created without making changes:
```
Would create:
  docs/schemas/billing.md

Would update:
  docs/schemas/index.md - add link
```

## Workflow

When you run `/spec add`:

1. **Validates type** - Checks component type exists
2. **Validates name** - Ensures lowercase, no special chars
3. **Checks requirements** - Verifies required options are provided
4. **Loads template** - Reads from spec-cli/templates/{type}.md
5. **Gathers context** - Prompts for missing optional fields
6. **Generates content** - Applies context to template
7. **Creates file** - Writes to target path
8. **Updates index** - Adds link to parent index.md
9. **Updates manifest** - Adds to feature manifest if specified

## Error Messages

### Unknown type
```
Error: Unknown component type 'schma'

Did you mean 'schema'?

Valid types:
  Reference: schema, pattern, decision
  Domain: domain, domain-topic
  Supporting: infrastructure, security, operations, frontend, api, diagram
  Product: product, feature
  Planning: overview, planning-doc, framework
```

### Missing required option
```
Error: schema requires --domain option

Usage:
  /spec add schema <name> --domain=<domain>

Example:
  /spec add schema notifications --domain=events
```

### File exists
```
Error: docs/schemas/billing.md already exists

To overwrite, use --force:
  /spec add schema billing --domain=billing --force
```

### Invalid name
```
Error: Invalid name 'User Alerts'

Names must be:
  - Lowercase
  - Use hyphens for spaces
  - No special characters

Try: user-alerts
```

## Implementation

This command invokes the `feature-composer` agent which:

1. Reads template from `spec-cli/templates/{type}.md`
2. Applies variable substitution
3. Creates file at correct path
4. Updates related indexes and manifests

## Tips

### Naming conventions

- Use **lowercase with hyphens**: `user-alerts`, `billing-schema`
- Match domain/product names exactly: `--domain=billing` not `--domain=Billing`
- Keep names concise but descriptive

### Organizing features

- Group related features under the same product
- Use consistent naming across schema, domain, and feature

### After creation

1. Fill in the TODO sections in the generated template
2. Update links to related components
3. Run `/spec validate` to check for issues

## Related Commands

- `/spec validate` - Validate all specifications
- `/spec graph` - View dependency graph (Phase 3)
- `/spec remove` - Remove a feature (Phase 4)
