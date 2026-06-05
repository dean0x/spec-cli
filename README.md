# specflow

Composable specification framework for managing layered technical documentation as code.

## Features

- **16 Component Types** - Schemas, patterns, decisions, domains, features, and more
- **Layer Enforcement** - Dependencies flow down only (reference → domain → supporting → product)
- **Structural Validation** - Broken links, frontmatter schemas, orphan detection
- **Feature Manifests** - Track ownership and dependencies between components
- **Template System** - Scaffold new components with consistent structure
- **Claude Code Plugin** - Integrated `/spec` commands and agents

## Installation

```bash
npm install -g @spec-cli/core
```

## Quick Start

```bash
# Initialize in your project
spec init

# Validate documentation structure
spec validate

# Create a new component
# (via Claude Code: /spec add schema billing)
```

## Commands

| Command | Description |
|---------|-------------|
| `spec init` | Initialize spec in current project |
| `spec validate` | Run structural validation on docs |
| `spec validate --json` | Output results as JSON |

## Component Types

| Layer | Types |
|-------|-------|
| Reference | schema, pattern, decision |
| Domain | domain, domain-topic |
| Supporting | infrastructure, security, operations, frontend, api, diagram |
| Product | product, feature |
| Planning | overview, planning-doc, framework |

## Claude Code Integration

Install as a Claude Code plugin for integrated commands:

- `/spec validate` - Run validation with agent support
- `/spec add <type> <name>` - Create components from templates
- `/spec graph` - Analyze dependencies
- `/spec remove <feature>` - Safe feature removal

## Configuration

Create `spec.config.yaml` in your project root:

```yaml
docsDir: docs
manifestDir: .manifests/features
```

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
```

## License

MIT
