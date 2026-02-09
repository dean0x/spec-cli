import { describe, it, expect } from 'vitest';
import {
  checkScopeConsistency,
  checkErrorCodeUniqueness,
  checkStateConsistency,
  checkCrossReferences,
} from './cross-reference.js';
import { defaultSemanticConfig } from './config.js';
import type { SemanticConfig } from './config.js';

describe('checkScopeConsistency', () => {
  it('detects scope used but not in type definition', () => {
    const typeFile = [
      '## API Scopes',
      '',
      "```typescript",
      "type ApiScope = 'read:properties' | 'write:properties' | 'read:tenants'",
      "```",
    ].join('\n');

    const endpointFile = [
      '## Endpoints',
      '',
      '| Method | Path | Scope |',
      '|--------|------|-------|',
      '| GET | /properties | read:properties |',
      '| POST | /alerts/ack | write:alerts |',
    ].join('\n');

    const files = new Map([
      ['docs/security/rbac.md', typeFile],
      ['docs/api/properties.md', endpointFile],
    ]);

    const issues = checkScopeConsistency(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('SCOPE_NOT_IN_TYPE');
    expect(issues[0]!.message).toContain('write:alerts');
  });

  it('passes when all scopes are defined', () => {
    const typeFile = "type ApiScope = 'read:properties' | 'write:properties'";
    const endpointFile = '| GET | /props | read:properties |';

    const files = new Map([
      ['docs/security/rbac.md', typeFile],
      ['docs/api/properties.md', endpointFile],
    ]);

    const issues = checkScopeConsistency(files);
    expect(issues).toHaveLength(0);
  });

  it('returns nothing when no type definition found', () => {
    const files = new Map([
      ['docs/api/properties.md', '| GET | /props | read:properties |'],
    ]);

    const issues = checkScopeConsistency(files);
    expect(issues).toHaveLength(0);
  });

  it('does not flag job names or non-scope colon patterns in tables', () => {
    const typeFile = "type ApiScope = 'read:properties' | 'write:properties'";
    const endpointFile = [
      '## Job Schedule',
      '',
      '| Job | Schedule | Description |',
      '|-----|----------|-------------|',
      '| cleanup:webhook-logs | Daily | Removes old webhook logs |',
      '| tenant:usage-reset | Monthly | Resets usage counters |',
      '| analytics:daily-rollup | Daily | Aggregates daily stats |',
    ].join('\n');

    const files = new Map([
      ['docs/security/rbac.md', typeFile],
      ['docs/operations/jobs.md', endpointFile],
    ]);

    const issues = checkScopeConsistency(files);
    expect(issues).toHaveLength(0);
  });
});

describe('checkErrorCodeUniqueness', () => {
  it('detects same error code with different descriptions', () => {
    const fileA = [
      '## Error Responses',
      '',
      '| Code | Description |',
      '|------|-------------|',
      '| QUOTA_EXCEEDED | Property limit reached |',
    ].join('\n');

    const fileB = [
      '## Error Responses',
      '',
      '| Code | Description |',
      '|------|-------------|',
      '| QUOTA_EXCEEDED | Billing quota exceeded |',
    ].join('\n');

    const files = new Map([
      ['docs/api/properties.md', fileA],
      ['docs/api/billing.md', fileB],
    ]);

    const issues = checkErrorCodeUniqueness(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('ERROR_CODE_OVERLOADED');
    expect(issues[0]!.message).toContain('QUOTA_EXCEEDED');
  });

  it('passes when error code descriptions match', () => {
    const fileA = [
      '| Code | Description |',
      '|------|-------------|',
      '| NOT_FOUND | Resource not found |',
    ].join('\n');

    const fileB = [
      '| Code | Description |',
      '|------|-------------|',
      '| NOT_FOUND | Resource not found |',
    ].join('\n');

    const files = new Map([
      ['docs/api/properties.md', fileA],
      ['docs/api/billing.md', fileB],
    ]);

    const issues = checkErrorCodeUniqueness(files);
    expect(issues).toHaveLength(0);
  });

  it('handles error codes in separate files', () => {
    const fileA = [
      '| Code | Description |',
      '|------|-------------|',
      '| INVALID_INPUT | Bad input data |',
    ].join('\n');

    const fileB = [
      '| Code | Description |',
      '|------|-------------|',
      '| AUTH_FAILED | Authentication failed |',
    ].join('\n');

    const files = new Map([
      ['docs/api/a.md', fileA],
      ['docs/api/b.md', fileB],
    ]);

    const issues = checkErrorCodeUniqueness(files);
    expect(issues).toHaveLength(0);
  });
});

describe('checkStateConsistency', () => {
  it('detects conflicting state descriptions across files', () => {
    const fileA = [
      '## Subscription States',
      '',
      '| State | Access |',
      '|-------|--------|',
      '| past_due | Full access during grace period |',
    ].join('\n');

    const fileB = [
      '## Billing States',
      '',
      '| State | Access |',
      '|-------|--------|',
      '| past_due | Read-only access |',
    ].join('\n');

    const files = new Map([
      ['docs/billing/subscriptions.md', fileA],
      ['docs/billing/edge-cases.md', fileB],
    ]);

    const issues = checkStateConsistency(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('STATE_DESCRIPTION_CONFLICT');
    expect(issues[0]!.message).toContain('past_due');
  });

  it('passes when state descriptions are consistent', () => {
    const fileA = [
      '| State | Access |',
      '|-------|--------|',
      '| active | Full access |',
    ].join('\n');

    const fileB = [
      '| State | Access |',
      '|-------|--------|',
      '| active | Full access |',
    ].join('\n');

    const files = new Map([
      ['docs/billing/a.md', fileA],
      ['docs/billing/b.md', fileB],
    ]);

    const issues = checkStateConsistency(files);
    expect(issues).toHaveLength(0);
  });
});

describe('checkCrossReferences', () => {
  it('respects config enable/disable for sub-checks', () => {
    const typeFile = "type ApiScope = 'read:properties'";
    const endpointFile = '| GET | /alerts | write:alerts |';

    const files = new Map([
      ['docs/security/rbac.md', typeFile],
      ['docs/api/alerts.md', endpointFile],
    ]);

    const config: SemanticConfig = {
      ...defaultSemanticConfig(),
      crossReference: {
        scopeConsistency: false,
        stateConsistency: true,
        errorCodeUniqueness: true,
      },
    };

    const issues = checkCrossReferences(files, config);
    // Scope check disabled — should not find scope issues
    expect(issues.filter((i) => i.code === 'SCOPE_NOT_IN_TYPE')).toHaveLength(0);
  });

  it('skips ignored files', () => {
    const typeFile = "type ApiScope = 'read:properties'";
    const endpointFile = '| GET | /alerts | write:alerts |';

    const files = new Map([
      ['docs/security/rbac.md', typeFile],
      ['docs/drafts/api.md', endpointFile],
    ]);

    const config: SemanticConfig = {
      ...defaultSemanticConfig(),
      ignore: ['**/drafts/**'],
    };

    const issues = checkCrossReferences(files, config);
    // The draft file is ignored, so scope type from rbac.md is found
    // but no usages from the draft file — no issues expected
    expect(issues.filter((i) => i.code === 'SCOPE_NOT_IN_TYPE')).toHaveLength(0);
  });
});
