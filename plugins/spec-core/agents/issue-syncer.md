---
name: Issue Syncer
description: Syncs feature manifests to GitHub issues via gh CLI
allowed-tools: Read, Glob, Grep, Bash
---

# Issue Syncer

Syncs feature manifests to GitHub issues using the spec-cli `issues` command.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`)
- Feature manifests exist in `.manifests/features/`
- If syncing to a different repo, `github.repo` configured in `spec.config.yaml`

## Workflow

### Step 1: Verify Prerequisites

```bash
gh auth status
```

If not authenticated, inform the user to run `gh auth login`.

### Step 2: Check Manifest Status

```bash
node <cli-path> issues status
```

Review which features have existing issue numbers and which are new.

### Step 3: Execute Sync

For a dry run first:
```bash
node <cli-path> issues --dry-run
```

Then for real:
```bash
node <cli-path> issues
```

### Step 4: Report Results

Show the user:
- How many issues were created/updated
- Links to created issues
- Any errors encountered

## Error Handling

- **gh not authenticated**: Ask user to run `gh auth login`
- **Rate limited**: Wait and retry, or suggest `--force` later
- **Repo not found**: Check `github.repo` in spec.config.yaml
