import { describe, it, expect } from 'vitest';
import { checkDomainCoupling } from './domain-coupling.js';
import { defaultSemanticConfig } from './config.js';
import type { SemanticConfig } from './config.js';

function makeConfig(domains: Record<string, string[]> = {}): SemanticConfig {
  const config = defaultSemanticConfig();
  config.domainCoupling = { domains };
  return config;
}

describe('checkDomainCoupling', () => {
  it('detects coupling when marker term appears in non-domain file', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/onboarding.md',
        '---\ntitle: Onboarding\n---\n# Onboarding\n\nUses Stripe Checkout for payment.',
      ],
    ]);
    const config = makeConfig({ billing: ['Stripe Checkout', 'packageName', 'billing tier'] });

    const issues = checkDomainCoupling(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('DOMAIN_COUPLING');
    expect(issues[0]!.message).toContain('billing');
    expect(issues[0]!.message).toContain('Stripe Checkout');
  });

  it('excludes domain own files from checking', () => {
    const files = new Map([
      [
        'docs/domains/billing/overview.md',
        '---\ntitle: Billing\n---\n# Billing\n\nUses Stripe Checkout for payment processing.',
      ],
    ]);
    const config = makeConfig({ billing: ['Stripe Checkout'] });

    const issues = checkDomainCoupling(files, config);
    expect(issues).toHaveLength(0);
  });

  it('excludes domain schema file from checking', () => {
    const files = new Map([
      [
        'docs/schemas/billing.md',
        '---\ntitle: Billing Schema\n---\n# Schema\n\nUses Stripe Checkout session IDs.',
      ],
    ]);
    const config = makeConfig({ billing: ['Stripe Checkout'] });

    const issues = checkDomainCoupling(files, config);
    expect(issues).toHaveLength(0);
  });

  it('does not flag markdown link targets', () => {
    const files = new Map([
      [
        'docs/overview/architecture.md',
        '---\ntitle: Architecture\n---\n# Arch\n\nSee [billing details](../domains/billing/stripe-checkout.md) for more.',
      ],
    ]);
    const config = makeConfig({ billing: ['stripe-checkout'] });

    const issues = checkDomainCoupling(files, config);
    expect(issues).toHaveLength(0);
  });

  it('skips content inside code fences', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/payments.md',
        '---\ntitle: Payments\n---\n# Payments\n\n```typescript\nconst session = stripeCheckout.create();\n```\n\nSome other text.',
      ],
    ]);
    const config = makeConfig({ billing: ['stripeCheckout'] });

    const issues = checkDomainCoupling(files, config);
    expect(issues).toHaveLength(0);
  });

  it('skips content inside YAML frontmatter', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/payments.md',
        '---\ntitle: Stripe Checkout Integration\n---\n# Payments\n\nSome clean content.',
      ],
    ]);
    const config = makeConfig({ billing: ['Stripe Checkout'] });

    const issues = checkDomainCoupling(files, config);
    expect(issues).toHaveLength(0);
  });

  it('returns empty array when no domains are configured', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/payments.md',
        '---\ntitle: Payments\n---\n# Payments\n\nStripe Checkout is used here.',
      ],
    ]);
    const config = makeConfig({});

    const issues = checkDomainCoupling(files, config);
    expect(issues).toHaveLength(0);
  });
});
