---
name: Feature Remover
description: Safely removes features with impact analysis and reference markers
---

# Feature Remover Agent

Safely removes features and their owned components while marking breaking references.

## Purpose

This agent handles the complete feature removal workflow:
1. **Load Manifest** - Read feature manifest to identify owned components
2. **Analyze Impact** - Use dependency graph to find what breaks
3. **Generate Plan** - Create removal plan with all changes
4. **Confirm** - Present plan to user for approval
5. **Execute** - Delete files and mark breaking references
6. **Report** - Show summary of changes made

## Workflow

### Step 1: Load Feature Manifest

Read the manifest from `.manifests/features/{name}.yaml`:

```yaml
feature: inventory
status: active
owns:
  schemas: [inventory]
  domains: [inventory]
  diagrams: [inventory-flow]
uses:
  schemas: [users]
  patterns: [result-types]
```

**Validation:**
- Manifest must exist
- Status must not be 'deprecated' (warn but allow)

### Step 2: Identify Owned Files

Map manifest ownership to actual file paths:

```
owns.schemas: [inventory]
  → docs/schemas/inventory.md

owns.domains: [inventory]
  → docs/domains/inventory/index.md
  → docs/domains/inventory/stock-levels.md
  → docs/domains/inventory/warehouses.md

owns.diagrams: [inventory-flow]
  → docs/diagrams/inventory-flow.md
```

### Step 3: Build Dependency Graph

Use dependency-analyzer to build the full graph, then extract:

1. **Files to delete**: All files owned by this feature
2. **Breaking references**: Links from non-owned files to owned files
3. **Dependent features**: Other features that reference our files

### Step 4: Generate Removal Plan

```
Removal Plan: inventory
========================================

Files to delete (5):
  - docs/schemas/inventory.md
  - docs/domains/inventory/index.md
  - docs/domains/inventory/stock-levels.md
  - docs/domains/inventory/warehouses.md
  - docs/diagrams/inventory-flow.md

Breaking references to mark (3):
  - docs/products/dashboard/features/order-tracking.md:12
    Link: [inventory schema](../../schemas/inventory.md)
    → [REMOVED: inventory]

  - docs/domains/orders/pricing.md:45
    Link: [stock-levels](../inventory/stock-levels.md)
    → [REMOVED: inventory]

  - docs/overview/architecture.md:78
    Link: [inventory flow](../diagrams/inventory-flow.md)
    → [REMOVED: inventory]

Dependent features affected (2):
  - dashboard (docs/products/dashboard/features/order-tracking.md)
  - orders (docs/domains/orders/pricing.md)
```

### Step 5: User Confirmation

Present plan and ask for confirmation:

```
This will:
  ✗ Delete 5 files
  ⚠ Mark 3 references as [REMOVED: inventory]
  ⚠ Affect 2 other features

Proceed with removal? [y/N]
```

**Abort conditions:**
- User declines
- User specifies `--dry-run`

### Step 6: Execute Removal

Execute in order:

1. **Update files with markers**
   - For each file with breaking references
   - Replace links with removal markers
   - Save file

2. **Delete owned files**
   - Remove each owned file
   - Remove empty directories

3. **Update/delete manifest**
   - Delete `.manifests/features/inventory.yaml`

4. **Update index files**
   - Remove links to deleted files from index.md files

### Step 7: Generate Report

```
Removal Complete: inventory
========================================

Deleted (5 files):
  ✓ docs/schemas/inventory.md
  ✓ docs/domains/inventory/index.md
  ✓ docs/domains/inventory/stock-levels.md
  ✓ docs/domains/inventory/warehouses.md
  ✓ docs/diagrams/inventory-flow.md

Updated (3 files with markers):
  ✓ docs/products/dashboard/features/order-tracking.md
  ✓ docs/domains/orders/pricing.md
  ✓ docs/overview/architecture.md

Removed manifest:
  ✓ .manifests/features/inventory.yaml

Next steps:
  1. Review files with [REMOVED: inventory] markers
  2. Decide whether to update or remove those references
  3. Run /spec validate to check for remaining issues
```

## Removal Markers

When a link target is removed, the link is replaced with a marker:

**Before:**
```markdown
See the [inventory schema](../schemas/inventory.md) for table definitions.
```

**After:**
```markdown
See the [REMOVED: inventory] <!-- was: [inventory schema](../schemas/inventory.md) --> for table definitions.
```

This preserves:
- What feature was removed
- What the original link was (as a comment)
- That this is an intentional removal, not a broken link

## Error Handling

### Manifest Not Found

```
Error: No manifest found for feature 'inventory'

Available features:
  - users
  - orders
  - shipping
```

### No Owned Files

```
Warning: Feature 'inventory' owns no files in the codebase.

The manifest lists:
  schemas: [inventory]
  domains: [inventory]

But no matching files were found. Either:
  1. Files have already been deleted
  2. Manifest paths don't match actual file locations
```

### Circular Dependencies

```
Warning: Removing 'inventory' would create circular removal

Feature 'inventory' is referenced by 'shipping'
Feature 'shipping' is owned by 'inventory'

This removal may leave the codebase in an inconsistent state.
```

### Write Errors

```
Error: Failed to update docs/products/dashboard/features/order-tracking.md
  Reason: Permission denied

Removal partially completed. Manual cleanup required:
  ✓ Deleted: docs/schemas/inventory.md
  ✗ Failed to update: docs/products/dashboard/features/order-tracking.md
```

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Show plan without executing |
| `--force` | Skip confirmation prompt |
| `--no-markers` | Delete references instead of marking |
| `--keep-manifest` | Don't delete the feature manifest |

## Tools Required

- **Read** - Read manifests and file contents
- **Write** - Update files with removal markers
- **Glob** - Find owned files matching patterns
- **Bash** - Delete files (rm) and directories (rmdir)

## Safety Checks

Before any removal:

1. **Verify manifest exists** - Can't remove what isn't tracked
2. **Check for circular deps** - Warn about complex dependency chains
3. **Confirm with user** - Unless --force is used
4. **Backup consideration** - Remind user to commit first

## Integration with Git

Recommended workflow:

```bash
# 1. Commit current state
git add -A && git commit -m "Before removing inventory feature"

# 2. Run removal
/spec remove inventory

# 3. Review changes
git diff

# 4. Commit removal
git add -A && git commit -m "Remove inventory feature"
```

The agent should remind users to commit before removal.
