import { describe, it, expect } from 'vitest';
import { checkFileSizes, getLineLimit, FILE_SIZE_LIMITS } from './file-size-checker.js';

describe('getLineLimit', () => {
  it('returns 400 for schema', () => {
    expect(getLineLimit('schema')).toBe(400);
  });

  it('returns 300 for pattern', () => {
    expect(getLineLimit('pattern')).toBe(300);
  });

  it('returns 500 for domain-topic', () => {
    expect(getLineLimit('domain-topic')).toBe(500);
  });

  it('returns 400 for feature', () => {
    expect(getLineLimit('feature')).toBe(400);
  });

  it('returns 500 (default) for unlisted types', () => {
    expect(getLineLimit('infrastructure')).toBe(500);
    expect(getLineLimit('decision')).toBe(500);
    expect(getLineLimit('overview')).toBe(500);
  });
});

describe('checkFileSizes', () => {
  function makeContent(lineCount: number): string {
    return Array.from({ length: lineCount }, (_, i) => `Line ${i + 1}`).join('\n');
  }

  it('does not flag a schema file at exactly the limit', () => {
    const files = new Map([
      ['docs/schemas/users.md', makeContent(400)],
    ]);

    const issues = checkFileSizes(files);
    expect(issues).toHaveLength(0);
  });

  it('flags a schema file over the limit', () => {
    const files = new Map([
      ['docs/schemas/users.md', makeContent(401)],
    ]);

    const issues = checkFileSizes(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('FILE_SIZE_EXCEEDED');
    expect(issues[0]!.message).toContain('401');
    expect(issues[0]!.message).toContain('400');
  });

  it('does not flag a file under the limit', () => {
    const files = new Map([
      ['docs/schemas/users.md', makeContent(100)],
    ]);

    const issues = checkFileSizes(files);
    expect(issues).toHaveLength(0);
  });

  it('uses the default limit for unlisted types', () => {
    const files = new Map([
      ['docs/infrastructure/gcp.md', makeContent(501)],
    ]);

    const issues = checkFileSizes(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('500');
  });

  it('does not flag unlisted types at default limit', () => {
    const files = new Map([
      ['docs/infrastructure/gcp.md', makeContent(500)],
    ]);

    const issues = checkFileSizes(files);
    expect(issues).toHaveLength(0);
  });

  it('uses pattern limit of 300', () => {
    const files = new Map([
      ['docs/architecture/patterns/cqrs.md', makeContent(301)],
    ]);

    const issues = checkFileSizes(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('300');
  });

  it('uses domain-topic limit of 500', () => {
    const files = new Map([
      ['docs/domains/billing/model.md', makeContent(501)],
    ]);

    const issues = checkFileSizes(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('500');
  });

  it('uses feature limit of 400', () => {
    const files = new Map([
      ['docs/products/web/features/alerts.md', makeContent(401)],
    ]);

    const issues = checkFileSizes(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('400');
  });
});
