import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  isClaudeCliAvailable,
  getPluginSourceDir,
  getSettingsPath,
  registerMarketplace,
  installManual,
  copyDir,
} from './plugin.js';

/**
 * Create a temporary directory with a unique prefix.
 */
function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'spec-plugin-test-'));
}

/**
 * Create a fake plugin source directory matching the expected structure:
 *   commands/validate.md
 *   commands/add.md
 *   agents/structural-validator.md
 *   skills/spec-authoring/SKILL.md
 */
function createPluginSourceDir(base: string): void {
  mkdirSync(join(base, 'commands'), { recursive: true });
  writeFileSync(join(base, 'commands', 'validate.md'), '# validate command');
  writeFileSync(join(base, 'commands', 'add.md'), '# add command');

  mkdirSync(join(base, 'agents'), { recursive: true });
  writeFileSync(join(base, 'agents', 'structural-validator.md'), '# validator agent');

  mkdirSync(join(base, 'skills', 'spec-authoring'), { recursive: true });
  writeFileSync(join(base, 'skills', 'spec-authoring', 'SKILL.md'), '# spec authoring skill');
}

describe('isClaudeCliAvailable', () => {
  it('returns a boolean', () => {
    const result = isClaudeCliAvailable();
    expect(typeof result).toBe('boolean');
  });
});

describe('getPluginSourceDir', () => {
  it('returns a path ending with plugins/spec-core', () => {
    const dir = getPluginSourceDir();
    expect(dir).toMatch(/plugins[/\\]spec-core$/);
  });
});

describe('getSettingsPath', () => {
  it('user scope returns path under homedir/.claude/', () => {
    const result = getSettingsPath('user', '/some/project');
    expect(result).toContain('.claude');
    expect(result).toMatch(/settings\.json$/);
    expect(result).not.toContain('/some/project');
  });

  it('project scope returns projectRoot/.claude/settings.json', () => {
    const result = getSettingsPath('project', '/my/project');
    expect(result).toBe(join('/my/project', '.claude', 'settings.json'));
  });

  it('local scope returns projectRoot/.claude/settings.local.json', () => {
    const result = getSettingsPath('local', '/my/project');
    expect(result).toBe(join('/my/project', '.claude', 'settings.local.json'));
  });
});

describe('copyDir', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('copies all files from source to dest', () => {
    tmpDir = makeTmpDir();
    const src = join(tmpDir, 'src');
    const dest = join(tmpDir, 'dest');

    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.md'), 'content-a');
    writeFileSync(join(src, 'b.md'), 'content-b');

    const result = copyDir(src, dest, false);

    expect(result.installed).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(readFileSync(join(dest, 'a.md'), 'utf-8')).toBe('content-a');
    expect(readFileSync(join(dest, 'b.md'), 'utf-8')).toBe('content-b');
  });

  it('creates nested directories and copies recursively', () => {
    tmpDir = makeTmpDir();
    const src = join(tmpDir, 'src');
    const dest = join(tmpDir, 'dest');

    mkdirSync(join(src, 'sub', 'deep'), { recursive: true });
    writeFileSync(join(src, 'top.md'), 'top');
    writeFileSync(join(src, 'sub', 'mid.md'), 'mid');
    writeFileSync(join(src, 'sub', 'deep', 'bottom.md'), 'bottom');

    const result = copyDir(src, dest, false);

    expect(result.installed).toHaveLength(3);
    expect(readFileSync(join(dest, 'sub', 'deep', 'bottom.md'), 'utf-8')).toBe('bottom');
  });

  it('skips existing files when force=false', () => {
    tmpDir = makeTmpDir();
    const src = join(tmpDir, 'src');
    const dest = join(tmpDir, 'dest');

    mkdirSync(src, { recursive: true });
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(src, 'a.md'), 'new-content');
    writeFileSync(join(dest, 'a.md'), 'old-content');

    const result = copyDir(src, dest, false);

    expect(result.installed).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(readFileSync(join(dest, 'a.md'), 'utf-8')).toBe('old-content');
  });

  it('overwrites existing files when force=true', () => {
    tmpDir = makeTmpDir();
    const src = join(tmpDir, 'src');
    const dest = join(tmpDir, 'dest');

    mkdirSync(src, { recursive: true });
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(src, 'a.md'), 'new-content');
    writeFileSync(join(dest, 'a.md'), 'old-content');

    const result = copyDir(src, dest, true);

    expect(result.installed).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(readFileSync(join(dest, 'a.md'), 'utf-8')).toBe('new-content');
  });

  it('returns empty arrays when source dir does not exist', () => {
    tmpDir = makeTmpDir();
    const result = copyDir(join(tmpDir, 'nonexistent'), join(tmpDir, 'dest'), false);

    expect(result.installed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });
});

describe('installManual', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('installs all files to correct target paths', () => {
    tmpDir = makeTmpDir();
    const pluginSrc = join(tmpDir, 'plugin-src');
    const projectRoot = join(tmpDir, 'project');

    createPluginSourceDir(pluginSrc);
    mkdirSync(projectRoot, { recursive: true });

    const result = installManual('project', pluginSrc, projectRoot, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.method).toBe('manual');
    expect(result.value.scope).toBe('project');
    expect(result.value.installed).toHaveLength(4);
    expect(result.value.skipped).toHaveLength(0);

    // Verify files landed in the right subdirectories
    const claudeDir = join(projectRoot, '.claude');
    expect(readFileSync(join(claudeDir, 'commands', 'spec', 'validate.md'), 'utf-8')).toBe('# validate command');
    expect(readFileSync(join(claudeDir, 'commands', 'spec', 'add.md'), 'utf-8')).toBe('# add command');
    expect(readFileSync(join(claudeDir, 'agents', 'spec', 'structural-validator.md'), 'utf-8')).toBe('# validator agent');
    expect(readFileSync(join(claudeDir, 'skills', 'spec-authoring', 'SKILL.md'), 'utf-8')).toBe('# spec authoring skill');
  });

  it('returns error when plugin source dir does not exist', () => {
    tmpDir = makeTmpDir();
    const result = installManual('project', join(tmpDir, 'nonexistent'), tmpDir, false);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Plugin source directory not found');
  });

  it('project scope targets projectRoot/.claude/', () => {
    tmpDir = makeTmpDir();
    const pluginSrc = join(tmpDir, 'plugin-src');
    const projectRoot = join(tmpDir, 'project');

    createPluginSourceDir(pluginSrc);
    mkdirSync(projectRoot, { recursive: true });

    const result = installManual('project', pluginSrc, projectRoot, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All installed paths should be under projectRoot/.claude/
    for (const path of result.value.installed) {
      expect(path).toContain(join(projectRoot, '.claude'));
    }
  });

  it('local scope also targets projectRoot/.claude/', () => {
    tmpDir = makeTmpDir();
    const pluginSrc = join(tmpDir, 'plugin-src');
    const projectRoot = join(tmpDir, 'project');

    createPluginSourceDir(pluginSrc);
    mkdirSync(projectRoot, { recursive: true });

    const result = installManual('local', pluginSrc, projectRoot, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const path of result.value.installed) {
      expect(path).toContain(join(projectRoot, '.claude'));
    }
  });
});

describe('registerMarketplace', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('creates new settings file with marketplace entry', () => {
    tmpDir = makeTmpDir();
    const projectRoot = join(tmpDir, 'project');
    mkdirSync(projectRoot, { recursive: true });

    const result = registerMarketplace('project', projectRoot);

    expect(result.ok).toBe(true);

    const settingsPath = join(projectRoot, '.claude', 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
    const marketplaces = settings['extraKnownMarketplaces'] as Record<string, unknown>;

    expect(marketplaces).toBeDefined();
    expect(marketplaces['spec-cli']).toEqual({
      source: { source: 'github', repo: 'dean0x/spec-cli' },
    });
  });

  it('merges into existing settings file preserving other keys', () => {
    tmpDir = makeTmpDir();
    const projectRoot = join(tmpDir, 'project');
    const claudeDir = join(projectRoot, '.claude');
    mkdirSync(claudeDir, { recursive: true });

    const existingSettings = { someKey: 'someValue', anotherKey: 42 };
    writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify(existingSettings));

    const result = registerMarketplace('project', projectRoot);

    expect(result.ok).toBe(true);

    const settings = JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf-8')) as Record<string, unknown>;
    expect(settings['someKey']).toBe('someValue');
    expect(settings['anotherKey']).toBe(42);
    expect(settings['extraKnownMarketplaces']).toBeDefined();
  });

  it('creates parent directories if needed', () => {
    tmpDir = makeTmpDir();
    const projectRoot = join(tmpDir, 'deep', 'nested', 'project');
    // Do NOT create projectRoot/.claude — let registerMarketplace handle it

    const result = registerMarketplace('project', projectRoot);

    expect(result.ok).toBe(true);

    const settingsPath = join(projectRoot, '.claude', 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
    expect(settings['extraKnownMarketplaces']).toBeDefined();
  });
});
