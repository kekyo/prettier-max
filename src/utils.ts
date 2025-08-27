// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { relative, sep, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import ignore, { Ignore } from 'ignore';

/**
 * Create a debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = undefined;
    }, delay);
  };
};

/**
 * Default ignore patterns (Prettier defaults)
 */
const DEFAULT_IGNORE_PATTERNS = [
  '.git',
  '.svn',
  '.hg',
  '.jj',
  '.sl',
  'node_modules',
  '**/.git',
  '**/.svn',
  '**/.hg',
  '**/.jj',
  '**/.sl',
  '**/node_modules',
];

/**
 * Create ignore instance from .prettierignore and .gitignore
 */
export const createIgnoreFilter = async (rootDir: string): Promise<Ignore> => {
  const ig = ignore();

  // Add default patterns
  ig.add(DEFAULT_IGNORE_PATTERNS);

  // Load .gitignore
  try {
    const gitignorePath = join(rootDir, '.gitignore');
    const content = await readFile(gitignorePath, 'utf-8');
    ig.add(content);
  } catch {
    // File doesn't exist, ignore
  }

  // Load .prettierignore
  try {
    const prettierignorePath = join(rootDir, '.prettierignore');
    const content = await readFile(prettierignorePath, 'utf-8');
    ig.add(content);
  } catch {
    // File doesn't exist, ignore
  }

  return ig;
};

/**
 * Create ignore instance from custom targets (include patterns)
 */
export const createTargetsFilter = (targets: string[]): Ignore => {
  const ig = ignore();

  // For include patterns, we need to invert the logic:
  // 1. First ignore everything
  // 2. Then un-ignore (include) the specified patterns

  // Start by ignoring all files (but keep directories for traversal)
  ig.add(['*', '!*/']);

  // Add each target as an un-ignore pattern
  targets.forEach((pattern) => {
    if (!pattern.startsWith('!')) {
      // This is an include pattern, so we un-ignore it
      ig.add(`!${pattern}`);
    } else {
      // This is already an exclude pattern (starts with !)
      // Remove the ! to make it an ignore pattern
      ig.add(pattern.substring(1));
    }
  });

  return ig;
};

/**
 * Check if file should be processed
 */
export const shouldProcessFile = (
  filePath: string,
  filter: Ignore | null,
  rootDir: string
): boolean => {
  const relativePath = relative(rootDir, filePath);

  // Skip files outside project
  if (relativePath.startsWith('..') || relativePath.startsWith(sep + '..')) {
    return false;
  }

  if (!filter) {
    return true; // No filter means process all files
  }

  // Check if the file is ignored
  return !filter.ignores(relativePath);
};

/**
 * Normalize targets - returns null if no custom targets
 */
export const normalizeTargets = (
  targets: string[] | undefined
): string[] | null => {
  return targets && targets.length > 0 ? targets : null;
};
