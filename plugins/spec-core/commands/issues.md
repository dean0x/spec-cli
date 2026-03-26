---
description: Sync feature manifests to GitHub issues
allowed-tools: Read, Glob, Grep, Bash
---

# /spec issues

Sync feature manifests to GitHub issues using the `gh` CLI.

## Usage

```
/spec issues [feature] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `(no args)` | Sync all manifests |
| `<feature>` | Sync a single feature |
| `status` | Show sync status table |
| `--dry-run` | Preview without creating/updating |
| `--json` | JSON output |
| `--force` | Re-sync even if unchanged |

## Execution

1. Locate the spec-cli CLI at `../spec-cli/dist/cli/index.js` or via `npx spec`
2. Run: `node <cli-path> issues [args]`
3. Report the results to the user

### Status Check
If the user asks for status:
```bash
node <cli-path> issues status
```

### Sync
```bash
node <cli-path> issues [feature] [--dry-run] [--json] [--force]
```

### Output
- `+` = created new issue
- `~` = updated existing issue
- `=` = unchanged
- `!` = error
