import { describe, it, expect } from 'vitest';
import { resolveLinkPath, extractMarkdownLinks } from './link-checker.js';

describe('resolveLinkPath', () => {
  describe('relative links', () => {
    it('resolves sibling-relative link from subdirectory', () => {
      expect(resolveLinkPath('docs/index.md', './schemas/users.md')).toBe(
        'docs/schemas/users.md',
      );
    });

    it('resolves parent-relative link', () => {
      expect(resolveLinkPath('docs/foo/bar.md', '../baz.md')).toBe('docs/baz.md');
    });

    it('strips trailing slash (directory reference)', () => {
      expect(resolveLinkPath('docs/index.md', './schemas/')).toBe('docs/schemas');
    });

    it('normalizes double slashes', () => {
      expect(resolveLinkPath('docs/foo/bar.md', './a//b.md')).toBe('docs/foo/a/b.md');
    });
  });

  describe('absolute links', () => {
    it('resolves absolute link relative to docs root', () => {
      expect(resolveLinkPath('docs/deep/nested/file.md', '/schemas/users.md')).toBe(
        'schemas/users.md',
      );
    });

    it('strips trailing slash on absolute link', () => {
      expect(resolveLinkPath('docs/anything.md', '/schemas/')).toBe('schemas');
    });
  });

  describe('edge cases', () => {
    it('handles traversal past docs root', () => {
      expect(resolveLinkPath('docs/foo/bar.md', '../../outside.md')).toBe('outside.md');
    });

    it('handles traversal to root (produces dot)', () => {
      expect(resolveLinkPath('docs/foo/bar.md', '../../')).toBe('.');
    });

    it('handles root-level source file', () => {
      expect(resolveLinkPath('README.md', './other.md')).toBe('other.md');
    });
  });
});

describe('extractMarkdownLinks', () => {
  it('extracts standard markdown links', () => {
    const content = 'See [the guide](./guide.md) and [API docs](../api/index.md).';
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([
      { text: 'the guide', link: './guide.md', line: 1 },
      { text: 'API docs', link: '../api/index.md', line: 1 },
    ]);
  });

  it('skips image links', () => {
    const content = '![logo](./logo.png)\n[real link](./page.md)';
    const links = extractMarkdownLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.link).toBe('./page.md');
  });

  it('skips external URLs', () => {
    const content = '[site](https://example.com)\n[other](http://foo.com)\n[local](./page.md)';
    const links = extractMarkdownLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.link).toBe('./page.md');
  });

  it('skips anchor-only links', () => {
    const content = '[section](#heading)\n[file](./page.md)';
    const links = extractMarkdownLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.link).toBe('./page.md');
  });

  it('strips anchor from file links', () => {
    const content = '[section](./page.md#heading)';
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([{ text: 'section', link: './page.md', line: 1 }]);
  });

  it('reports correct line numbers', () => {
    const content = 'line 1\n[link1](./a.md)\nline 3\n[link2](./b.md)';
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([
      { text: 'link1', link: './a.md', line: 2 },
      { text: 'link2', link: './b.md', line: 4 },
    ]);
  });
});
