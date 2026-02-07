---
description: Remove a feature and its owned components
allowed-tools: Read, Write, Edit, Glob, Grep, Task, Bash(rm:*), Bash(git status:*)
---

# /spec remove

Remove a feature and its owned components.

## Usage

```
/spec remove <feature> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `feature` | Yes | Name of the feature to remove (matches manifest name) |

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `--dry-run` | `-n` | Preview removal without making changes |
| `--force` | `-f` | Skip confirmation prompt |
| `--no-markers` | | Delete broken references instead of marking |
| `--keep-manifest` | | Don't delete the feature manifest file |
| `--json` | `-j` | Output removal plan as JSON |

## Examples

### Preview Removal (Dry Run)

```
/spec remove billing --dry-run
```

Output:
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
  - web
  - properties

[DRY RUN - No changes made]
```

### Remove Feature

```
/spec remove billing
```

Output:
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
  - docs/domains/properties/pricing.md:45
  - docs/overview/architecture.md:78

⚠️  This will:
  - Delete 5 files
  - Mark 3 references as [REMOVED: billing]
  - Affect 2 other features

Proceed with removal? [y/N] y

Removing...
  ✓ Updated docs/products/web/features/billing.md
  ✓ Updated docs/domains/properties/pricing.md
  ✓ Updated docs/overview/architecture.md
  ✓ Deleted docs/schemas/billing.md
  ✓ Deleted docs/domains/billing/index.md
  ✓ Deleted docs/domains/billing/subscriptions.md
  ✓ Deleted docs/domains/billing/invoices.md
  ✓ Deleted docs/diagrams/billing-flow.md
  ✓ Deleted .manifests/features/billing.yaml

Removal complete!

Next steps:
  1. Review files with [REMOVED: billing] markers
  2. Run /spec validate to check for remaining issues
  3. Commit your changes
```

### Force Remove (Skip Confirmation)

```
/spec remove billing --force
```

Executes immediately without prompting.

### JSON Output

```
/spec remove billing --dry-run --json
```

Output:
```json
{
  "featureName": "billing",
  "filesToDelete": [
    "docs/schemas/billing.md",
    "docs/domains/billing/index.md",
    "docs/domains/billing/subscriptions.md"
  ],
  "breakingReferences": [
    {
      "sourceFile": "docs/products/web/features/billing.md",
      "line": 12,
      "linkText": "billing schema",
      "targetFile": "docs/schemas/billing.md"
    }
  ],
  "dependentFeatures": ["web", "properties"],
  "stats": {
    "filesDeleted": 5,
    "referencesMarked": 3,
    "featuresAffected": 2
  }
}
```

## Workflow

When you run `/spec remove`:

1. **Loads manifest** - Reads `.manifests/features/{feature}.yaml`
2. **Identifies files** - Maps owned components to file paths
3. **Analyzes impact** - Finds breaking references via dependency graph
4. **Shows plan** - Displays what will be changed
5. **Confirms** - Asks for user approval (unless --force)
6. **Updates files** - Adds removal markers to files with broken links
7. **Deletes files** - Removes owned files
8. **Cleans up** - Removes manifest, updates indexes

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
- Which feature was removed
- What the original link was
- That this is intentional, not a bug

## Error Messages

### Feature Not Found

```
Error: No manifest found for feature 'billing'

Available features:
  - auth (.manifests/features/auth.yaml)
  - properties (.manifests/features/properties.yaml)
  - rules (.manifests/features/rules.yaml)
```

### No Files to Remove

```
Warning: Feature 'billing' owns no files in the codebase.

Manifest claims to own:
  schemas: [billing]
  domains: [billing]

But no matching files were found. The feature may have already been removed.
```

### Removal Failed

```
Error: Failed during removal

Successfully completed:
  ✓ Updated docs/products/web/features/billing.md
  ✓ Deleted docs/schemas/billing.md

Failed:
  ✗ docs/domains/billing/index.md: Permission denied

Manual cleanup required for remaining files.
```

## Safety

### Before Removal

The command encourages committing first:
```
⚠️  Recommended: Commit your current changes before removing.
    This allows you to easily revert if needed.
```

### Validation After

Run validation after removal:
```
/spec validate
```

This will catch any remaining broken links or issues.

### Undo

To undo a removal:
```bash
git checkout -- .
```

Or if already committed:
```bash
git revert HEAD
```

## Tips

### Check Dependencies First

Before removing:
```
/spec graph --feature billing
```

Shows what depends on the feature.

### Staged Removal

For large features, consider:
1. First deprecate: Update manifest `status: deprecated`
2. Update dependent features to remove references
3. Then remove the feature

### Cleanup Markers

After removal, search for markers:
```
grep -r "REMOVED:" docs/
```

Decide for each:
- Update the text to remove the reference
- Add new content to replace it
- Remove the paragraph entirely

## Related Commands

- `/spec graph --feature` - View feature dependencies
- `/spec graph --impact` - Analyze removal impact
- `/spec validate` - Check for broken links
- `/spec add` - Create new components
