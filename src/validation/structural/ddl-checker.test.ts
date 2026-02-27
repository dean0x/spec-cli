import { describe, it, expect } from 'vitest';
import { extractTableNames, checkDdlDuplication } from './ddl-checker.js';

describe('extractTableNames', () => {
  it('extracts basic CREATE TABLE', () => {
    const content = 'CREATE TABLE users (\n  id uuid PRIMARY KEY\n);';
    const result = extractTableNames(content);
    expect(result).toHaveLength(1);
    expect(result[0]!.tableName).toBe('users');
    expect(result[0]!.line).toBe(1);
  });

  it('extracts CREATE TABLE IF NOT EXISTS', () => {
    const content = 'CREATE TABLE IF NOT EXISTS users (\n  id uuid\n);';
    const result = extractTableNames(content);
    expect(result).toHaveLength(1);
    expect(result[0]!.tableName).toBe('users');
  });

  it('extracts schema-qualified table names', () => {
    const content = 'CREATE TABLE public.users (\n  id uuid\n);';
    const result = extractTableNames(content);
    expect(result).toHaveLength(1);
    expect(result[0]!.tableName).toBe('users');
  });

  it('extracts multiple tables from same content', () => {
    const content = 'CREATE TABLE users (\n  id uuid\n);\n\nCREATE TABLE roles (\n  id uuid\n);';
    const result = extractTableNames(content);
    expect(result).toHaveLength(2);
    expect(result[0]!.tableName).toBe('users');
    expect(result[1]!.tableName).toBe('roles');
  });

  it('returns empty array when no DDL present', () => {
    const content = '# Users\n\nThis document describes the users domain.';
    const result = extractTableNames(content);
    expect(result).toHaveLength(0);
  });
});

describe('checkDdlDuplication', () => {
  it('flags non-schema files that duplicate canonical DDL', () => {
    const files = new Map([
      ['docs/schemas/users.md', '```sql\nCREATE TABLE users (\n  id uuid\n);\n```'],
      ['docs/architecture/decisions/001-user-model.md', '```sql\nCREATE TABLE users (\n  id uuid\n);\n```'],
    ]);

    const issues = checkDdlDuplication(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('DUPLICATE_DDL');
    expect(issues[0]!.file).toBe('docs/architecture/decisions/001-user-model.md');
  });

  it('does not flag DDL only in schema files', () => {
    const files = new Map([
      ['docs/schemas/users.md', '```sql\nCREATE TABLE users (\n  id uuid\n);\n```'],
    ]);

    const issues = checkDdlDuplication(files);
    expect(issues).toHaveLength(0);
  });

  it('does not flag DDL only in non-schema files (no canonical source)', () => {
    const files = new Map([
      ['docs/architecture/decisions/001-user-model.md', '```sql\nCREATE TABLE users (\n  id uuid\n);\n```'],
      ['docs/domains/auth/overview.md', '```sql\nCREATE TABLE users (\n  id uuid\n);\n```'],
    ]);

    const issues = checkDdlDuplication(files);
    expect(issues).toHaveLength(0);
  });

  it('flags multiple non-schema duplicates of the same table', () => {
    const files = new Map([
      ['docs/schemas/users.md', '```sql\nCREATE TABLE users (\n  id uuid\n);\n```'],
      ['docs/architecture/decisions/001.md', '```sql\nCREATE TABLE users (\n  id uuid\n);\n```'],
      ['docs/domains/auth/overview.md', '```sql\nCREATE TABLE users (\n  id uuid\n);\n```'],
    ]);

    const issues = checkDdlDuplication(files);
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.code === 'DUPLICATE_DDL')).toBe(true);
  });

  it('uses case-insensitive table name comparison', () => {
    const files = new Map([
      ['docs/schemas/users.md', '```sql\nCREATE TABLE Users (\n  id uuid\n);\n```'],
      ['docs/architecture/decisions/001.md', '```sql\nCREATE TABLE USERS (\n  id uuid\n);\n```'],
    ]);

    const issues = checkDdlDuplication(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('DUPLICATE_DDL');
  });
});
