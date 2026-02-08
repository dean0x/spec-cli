---
title: {{name}}
domain: {{domain}}
status: draft
description: {{description}}
---

# {{name}}

{{description}}

## Tables

### {{table_name}}

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary identifier |
| tenant_id | uuid | FK, NOT NULL | Tenant reference |
| created_at | timestamp | NOT NULL | Creation timestamp |
| updated_at | timestamp | NOT NULL | Last update timestamp |

## Relationships

- **belongs_to**: [related-schema](./related-schema.md)

## Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| {{table_name}}_pkey | id | PRIMARY | Primary key |
| {{table_name}}_tenant_id_idx | tenant_id | BTREE | Tenant lookup |

## Constraints

- `tenant_id` must reference a valid tenant
- `created_at` cannot be modified after creation

## Usage

```typescript
// Example usage in code
import { {{name}} } from 'your-org/database';
```

## Related Schemas

- [related-schema](./related-schema.md) - Tenant ownership
