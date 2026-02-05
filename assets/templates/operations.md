---
title: {{name}}
description: {{description}}
runbook: false
oncall: platform-team
---

# {{name}}

{{description}}

## Overview

High-level description of this operational topic.

## Responsibilities

- Responsibility 1
- Responsibility 2

## Procedures

### Procedure 1

1. Step 1
2. Step 2
3. Step 3

### Procedure 2

1. Step 1
2. Step 2

## Monitoring

### Key Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| metric_name | < 100ms | > 200ms | > 500ms |

### Dashboards

- [Dashboard Name](https://monitoring.example.com/dashboard)

## Alerts

### Alert 1

**Trigger**: When condition is met
**Severity**: Warning
**Response**: What to do

### Alert 2

**Trigger**: When condition is met
**Severity**: Critical
**Response**: What to do

## Incident Response

### Escalation Path

1. On-call engineer
2. Team lead
3. Engineering manager

### Communication

- Slack: #incidents
- PagerDuty: team-oncall

## Related

- [Infrastructure](../../infrastructure/{{infra}}.md)
- [Runbook](./runbooks/{{name}}.md)
