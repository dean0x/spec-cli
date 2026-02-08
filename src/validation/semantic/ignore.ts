/**
 * Ignore Pattern Matching
 *
 * Matches file paths against glob-style ignore patterns.
 * Supports ** (any depth), * (single segment), and ? (single char).
 */

/**
 * Converts a simple glob pattern to a RegExp.
 * Supports: ** (any path segments), * (any chars in segment), ? (single char)
 */
function globToRegex(pattern: string): RegExp {
  let regex = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*' && pattern[i + 1] === '*') {
      // ** matches any number of path segments
      regex += '.*';
      i += 2;
      // Skip trailing /
      if (pattern[i] === '/') i++;
    } else if (char === '*') {
      // * matches anything except /
      regex += '[^/]*';
      i++;
    } else if (char === '?') {
      regex += '[^/]';
      i++;
    } else if (char === '.') {
      regex += '\\.';
      i++;
    } else {
      regex += char;
      i++;
    }
  }

  return new RegExp(`^${regex}$`);
}

/**
 * Checks if a file path matches any of the given ignore patterns.
 */
export function matchesIgnorePattern(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;

  const normalized = filePath.replace(/\\/g, '/');

  for (const pattern of patterns) {
    const regex = globToRegex(pattern);
    if (regex.test(normalized)) return true;
  }

  return false;
}
