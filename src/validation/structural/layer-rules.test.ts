import { describe, it, expect } from 'vitest';
import { checkFileLayerRules } from './layer-rules.js';

/**
 * Helper: creates minimal markdown with a link to a target path.
 * The source file path determines the source component type/layer.
 * The link target determines the target layer.
 */
function mdWithLink(targetRelativePath: string): string {
  return `---\ntitle: Test\n---\n\nSee [link](${targetRelativePath}) for details.\n`;
}

describe('checkFileLayerRules', () => {
  const existingFiles = new Set<string>();

  describe('same-layer references (always valid)', () => {
    it('schema referencing another schema', () => {
      const issues = checkFileLayerRules(
        'docs/schemas/users.md',
        mdWithLink('./orders.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });

    it('domain-topic referencing another domain-topic', () => {
      const issues = checkFileLayerRules(
        'docs/domains/billing/overview.md',
        mdWithLink('../identity/overview.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });
  });

  describe('allowed cross-layer references', () => {
    it('decision can reference domain (ADR exception)', () => {
      const issues = checkFileLayerRules(
        'docs/architecture/decisions/adr-001.md',
        mdWithLink('../../../docs/domains/billing/overview.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });

    it('decision can reference supporting (ADR exception)', () => {
      const issues = checkFileLayerRules(
        'docs/architecture/decisions/adr-001.md',
        mdWithLink('../../infrastructure/deployment.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });

    it('decision can reference product (ADR exception)', () => {
      const issues = checkFileLayerRules(
        'docs/architecture/decisions/adr-001.md',
        mdWithLink('../../products/dashboard.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });

    it('decision can reference planning (ADR exception)', () => {
      const issues = checkFileLayerRules(
        'docs/architecture/decisions/adr-001.md',
        mdWithLink('../../overview/roadmap.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });

    it('domain can reference reference', () => {
      const issues = checkFileLayerRules(
        'docs/domains/billing/overview.md',
        mdWithLink('../../schemas/billing.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });

    it('supporting can reference domain', () => {
      const issues = checkFileLayerRules(
        'docs/infrastructure/deployment.md',
        mdWithLink('../domains/billing/overview.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });

    it('product can reference supporting', () => {
      const issues = checkFileLayerRules(
        'docs/products/dashboard.md',
        mdWithLink('../infrastructure/deployment.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });
  });

  describe('disallowed cross-layer references (violations)', () => {
    it('schema cannot reference domain', () => {
      const issues = checkFileLayerRules(
        'docs/schemas/users.md',
        mdWithLink('../domains/identity/overview.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('LAYER_VIOLATION');
      expect(issues[0]!.severity).toBe('error');
    });

    it('schema cannot reference supporting', () => {
      const issues = checkFileLayerRules(
        'docs/schemas/users.md',
        mdWithLink('../infrastructure/deployment.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('LAYER_VIOLATION');
    });

    it('pattern cannot reference domain', () => {
      const issues = checkFileLayerRules(
        'docs/architecture/patterns/cqrs.md',
        mdWithLink('../../../docs/domains/billing/overview.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('LAYER_VIOLATION');
    });

    it('pattern cannot reference supporting', () => {
      const issues = checkFileLayerRules(
        'docs/architecture/patterns/cqrs.md',
        mdWithLink('../../infrastructure/deployment.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('LAYER_VIOLATION');
    });

    it('domain-topic cannot reference supporting', () => {
      const issues = checkFileLayerRules(
        'docs/domains/billing/overview.md',
        mdWithLink('../../infrastructure/deployment.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('LAYER_VIOLATION');
    });

    it('domain-topic cannot reference product', () => {
      const issues = checkFileLayerRules(
        'docs/domains/billing/overview.md',
        mdWithLink('../../products/dashboard.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('LAYER_VIOLATION');
      expect(issues[0]!.severity).toBe('error');
    });

    it('domain cannot reference planning', () => {
      const issues = checkFileLayerRules(
        'docs/domains/overview.md',
        mdWithLink('../overview/roadmap.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('LAYER_VIOLATION');
    });

    it('product cannot reference planning', () => {
      const issues = checkFileLayerRules(
        'docs/products/dashboard.md',
        mdWithLink('../overview/roadmap.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('LAYER_VIOLATION');
    });

    it('infrastructure (supporting) cannot reference product', () => {
      const issues = checkFileLayerRules(
        'docs/infrastructure/deployment.md',
        mdWithLink('../products/dashboard.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('LAYER_VIOLATION');
    });
  });

  describe('edge cases', () => {
    it('unrecognized source file produces no issues', () => {
      const issues = checkFileLayerRules(
        'README.md',
        mdWithLink('./docs/schemas/users.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });

    it('link to unrecognized target produces no issues', () => {
      // Link resolves outside 'docs/' entirely — no component type match
      const issues = checkFileLayerRules(
        'docs/schemas/users.md',
        mdWithLink('../../README.md'),
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });

    it('file with no links produces no issues', () => {
      const issues = checkFileLayerRules(
        'docs/schemas/users.md',
        '---\ntitle: Test\n---\n\nNo links here.\n',
        existingFiles,
      );
      expect(issues).toHaveLength(0);
    });
  });
});
