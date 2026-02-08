import { describe, it, expect } from 'vitest';
import { checkStaleness } from './staleness.js';
import { defaultSemanticConfig } from './config.js';
import type { SemanticConfig } from './config.js';

function enabledConfig(): SemanticConfig {
  return defaultSemanticConfig();
}

function disabledConfig(): SemanticConfig {
  return {
    ...defaultSemanticConfig(),
    staleness: { flagUndatedEstimates: false },
  };
}

describe('checkStaleness', () => {
  it('flags undated monetary estimate', () => {
    const files = new Map([
      ['docs/infrastructure/gcp.md', '## Costs\n\nCompute Engine: $150/month\nCloud SQL: $80/month'],
    ]);

    const issues = checkStaleness(files, enabledConfig());
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.code).toBe('UNDATED_ESTIMATE');
  });

  it('does not flag when date context is present nearby', () => {
    const content = [
      '## Costs',
      '',
      'Estimates as of 2025-01',
      '',
      'Compute Engine: $150/month',
    ].join('\n');

    const files = new Map([['docs/infrastructure/gcp.md', content]]);

    const issues = checkStaleness(files, enabledConfig());
    expect(issues).toHaveLength(0);
  });

  it('does not flag when "as of" is in context window', () => {
    const lines = ['## Costs', ''];
    // Add some content lines
    for (let i = 0; i < 10; i++) {
      lines.push(`Some info line ${i}`);
    }
    lines.push('Pricing as of Q1 2025');
    for (let i = 0; i < 5; i++) {
      lines.push(`More info line ${i}`);
    }
    lines.push('Instance cost: $200/month');

    const files = new Map([['docs/infra.md', lines.join('\n')]]);

    const issues = checkStaleness(files, enabledConfig());
    expect(issues).toHaveLength(0);
  });

  it('does not flag when disabled in config', () => {
    const files = new Map([
      ['docs/infrastructure/gcp.md', 'Compute Engine: $150/month'],
    ]);

    const issues = checkStaleness(files, disabledConfig());
    expect(issues).toHaveLength(0);
  });

  it('skips ignored files', () => {
    const files = new Map([
      ['docs/drafts/costs.md', 'Total: $500/month'],
    ]);

    const config: SemanticConfig = {
      ...enabledConfig(),
      ignore: ['**/drafts/**'],
    };

    const issues = checkStaleness(files, config);
    expect(issues).toHaveLength(0);
  });

  it('reports correct line number for the monetary value', () => {
    const files = new Map([
      ['docs/infra.md', 'Line 1\nLine 2\nCost: $100\nLine 4'],
    ]);

    const issues = checkStaleness(files, enabledConfig());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.line).toBe(3);
  });
});
