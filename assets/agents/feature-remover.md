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
feature: billing
status: active
owns:
  schemas: [billing]
  domains: [billing]
  diagrams: [billing-flow]
uses:
  schemas: [tenants]
  patterns: [result-types]
```

**Validation:**
- Manifest must exist
- Status must not be 'deprecated' (warn but allow)

### Step 2: Identify Owned Files

Map manifest ownership to actual file paths:

```
owns.schemas: [billing]
  → docs/schemas/billing.md

owns.domains: [billing]
  → docs/domains/billing/index.md
  → docs/domains/billing/subscriptions.md
  → docs/domains/billing/invoices.md

owns.diagrams: [billing-flow]
  → docs/diagrams/billing-flow.md
```

### Step 3: Build Dependency Graph

Use dependency-analyzer to build the full graph, then extract:

1. **Files to delete**: All files owned by this feature
2. **Breaking references**: Links from non-owned files to owned files
3. **Dependent features**: Other features that reference our files

### Step 4: Generate Removal Plan

```
Removal Plan: billing
========================================

Files to delete (5):
  - docs/schemas/billing.md
  - docs/domains/billing/index.md
  - docs/domains/billing/subscriptions.md
  - docs/domains/billing/invoices.md
  - docs/diagrams/billing-flow.md

Breaking references to mark (3):
  - docs/products/web/features/billing.md:12
    Link: [billing schema](../../schemas/billing.md)
    → [REMOVED: billing]

  - docs/domains/properties/pricing.md:45
    Link: [subscriptions](../billing/subscriptions.md)
    → [REMOVED: billing]

  - docs/overview/architecture.md:78
    Link: [billing flow](../diagrams/billing-flow.md)
    → [REMOVED: billing]

Dependent features affected (2):
  - web (docs/products/web/features/billing.md)
  - properties (docs/domains/properties/pricing.md)
```

### Step 5: User Confirmation

Present plan and ask for confirmation:

```
This will:
  ✗ Delete 5 files
  ⚠ Mark 3 references as [REMOVED: billing]
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
   - Delete `.manifests/features/billing.yaml`

4. **Update index files**
   - Remove links to deleted files from index.md files

### Step 7: Generate Report

```
Removal Complete: billing
========================================

Deleted (5 files):
  ✓ docs/schemas/billing.md
  ✓ docs/domains/billing/index.md
  ✓ docs/domains/billing/subscriptions.md
  ✓ docs/domains/billing/invoices.md
  ✓ docs/diagrams/billing-flow.md

Updated (3 files with markers):
  ✓ docs/products/web/features/billing.md
  ✓ docs/domains/properties/pricing.md
  ✓ docs/overview/architecture.md

Removed manifest:
  ✓ .manifests/features/billing.yaml

Next steps:
  1. Review files with [REMOVED: billing] markers
  2. Decide whether to update or remove those references
  3. Run /spec validate to check for remaining issues
```

## Removal Markers

When a link target is removed, the link is replaced with a marker:

**Before:**
```markdown
See the [billing schema](../schemas/billing.md) for table definitions.
```

**After:**
```markdown
See the [REMOVED: billing] <!-- was: [billing schema](../schemas/billing.md) --> for table definitions.
```

This preserves:
- What feature was removed
- What the original link was (as a comment)
- That this is an intentional removal, not a broken link

## Error Handling

### Manifest Not Found

```
Error: No manifest found for feature 'billing'

Available features:
  - auth
  - properties
  - rules
```

### No Owned Files

```
Warning: Feature 'billing' owns no files in the codebase.

The manifest lists:
  schemas: [billing]
  domains: [billing]

But no matching files were found. Either:
  1. Files have already been deleted
  2. Manifest paths don't match actual file locations
```

### Circular Dependencies

```
Warning: Removing 'billing' would create circular removal

Feature 'billing' is referenced by 'payments'
Feature 'payments' is owned by 'billing'

This removal may leave the codebase in an inconsistent state.
```

### Write Errors

```
Error: Failed to update docs/products/web/features/billing.md
  Reason: Permission denied

Removal partially completed. Manual cleanup required:
  ✓ Deleted: docs/schemas/billing.md
  ✗ Failed to update: docs/products/web/features/billing.md
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
git add -A && git commit -m "Before removing billing feature"

# 2. Run removal
/spec remove billing

# 3. Review changes
git diff

# 4. Commit removal
git add -A && git commit -m "Remove billing feature"
```

The agent should remind users to commit before removal.
