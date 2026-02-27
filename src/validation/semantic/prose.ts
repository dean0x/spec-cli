/**
 * Prose Line Detection
 *
 * Shared utility for identifying non-prose lines (code fences, YAML frontmatter)
 * that should be skipped during content analysis.
 */

/**
 * Returns line indices that are inside fenced code blocks or YAML frontmatter.
 * Code fences start/end with ```. Frontmatter is a `---` block at line 0.
 */
export function getNonProseLines(lines: string[]): Set<number> {
  const excluded = new Set<number>();

  // Frontmatter: must start at line 0 with `---`
  if (lines[0]?.trimEnd() === '---') {
    excluded.add(0);
    for (let i = 1; i < lines.length; i++) {
      excluded.add(i);
      if (lines[i]?.trimEnd() === '---') break;
    }
  }

  // Code fences
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (excluded.has(i)) continue;
    const trimmed = lines[i]?.trimStart() ?? '';
    if (trimmed.startsWith('```')) {
      excluded.add(i);
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      excluded.add(i);
    }
  }

  return excluded;
}
