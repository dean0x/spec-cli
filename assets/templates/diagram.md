---
title: {{name}}
description: {{description}}
type: architecture
format: mermaid
---

# {{name}}

{{description}}

## Diagram

```mermaid
graph TB
    subgraph "Component A"
        A1[Service 1]
        A2[Service 2]
    end

    subgraph "Component B"
        B1[Service 3]
    end

    A1 --> B1
    A2 --> B1
```

## Components

### Component A

Description of component A and its role.

### Component B

Description of component B and its role.

## Data Flow

1. Data enters through...
2. Processed by...
3. Stored in...

## Key Interactions

| From | To | Protocol | Description |
|------|-----|----------|-------------|
| Service 1 | Service 3 | gRPC | Description |

## Related

- [Domain](../domains/{{domain}}/index.md)
- [Infrastructure](../infrastructure/{{infra}}.md)
