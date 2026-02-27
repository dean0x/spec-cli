---
title: {{name}}
domain: {{domain}}
status: draft
description: {{description}}
---

# {{name}}

{{description}}

> **Content guidelines:** This file should contain DDL, constraints, indexes, RLS, and reference data only. Workflows, state machines, behavioral descriptions, and domain logic belong in domain files.

## Tables

### {{table_name}}

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary identifier |
| organization_id | uuid | FK, NOT NULL | Organization reference |
| created_at | timestamp | NOT NULL | Creation timestamp |
| updated_at | timestamp | NOT NULL | Last update timestamp |

## Relationships

- **belongs_to**: [related-schema](./related-schema.md)

## Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| {{table_name}}_pkey | id | PRIMARY | Primary key |
| {{table_name}}_organization_id_idx | organization_id | BTREE | Organization lookup |

## Constraints

- `organization_id` must reference a valid organization
- `created_at` cannot be modified after creation

## Usage

```typescript
// Example usage in code
import { {{name}} } from 'your-org/database';
```

## Related Schemas

- [related-schema](./related-schema.md) - Organization ownership
