// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { existsSync } from 'fs';
import { readFile, readdir, writeFile } from 'fs/promises';
import { join, relative, extname } from 'path';
import ignore, { type Ignore } from 'ignore';

import type { Logger } from './logger.js';

const BANNER_FILENAME = '.prettierbanner';
const PRETTIER_IGNORE_FILENAME = '.prettierignore';
const MAX_BANNER_LINES = 20;
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const;
const SKIP_DIRECTORIES = new Set(['node_modules', '.git']);

type BannerAction = 'inserted' | 'replaced';

interface BannerSummary {
  total: number;
  inserted: number;
  replaced: number;
}

interface ApplyBannerOptions {
  rootDir: string;
  logger: Logger;
  extensions?: string[];
}

interface BannerCandidate {
  content: string;
  consumed: number;
}

/**
 * Normalize relative paths so the ignore engine sees a consistent format.
 */
const normalizeRelativePath = (input: string): string =>
  input.split('\\').join('/');

/**
 * Detect which newline sequence is predominant in the provided banner text.
 */
const detectPreferredNewline = (content: string): string =>
  content.includes('\r\n') ? '\r\n' : '\n';

/**
 * Count banner lines while ignoring the injected trailing separator.
 */
const countLogicalLines = (content: string): number => {
  const normalized = content.replace(/\r/g, '');
  const segments = normalized.split('\n');
  if (segments.length > 0 && segments[segments.length - 1] === '') {
    segments.pop();
  }
  return segments.length;
};

/**
 * Ensure canonical banner representation ends with a blank line.
 */
const ensureTrailingBlankLine = (content: string): string => {
  // Make sure every banner snapshot ends with an explicit blank line so the
  // insertion logic can treat EOF like "blank separator" even when the source
  // banner omits it.
  const newline = detectPreferredNewline(content);
  let canonical = content;

  if (!canonical.endsWith('\n')) {
    canonical += newline;
  }

  const normalized = canonical.replace(/\r/g, '');
  const segments = normalized.split('\n');
  const hasTrailingBlank =
    segments.length >= 2 &&
    segments[segments.length - 1] === '' &&
    segments[segments.length - 2] === '';

  if (!hasTrailingBlank) {
    canonical += newline;
  }

  return canonical;
};

/**
 * Load ignore patterns from .prettierignore if the file exists.
 */
const loadIgnoreMatcher = async (
  rootDir: string
): Promise<Ignore | undefined> => {
  // Mirror Prettier's ignore behaviour by reusing patterns from .prettierignore if present.
  const ignorePath = join(rootDir, PRETTIER_IGNORE_FILENAME);
  try {
    const raw = await readFile(ignorePath, 'utf8');
    return ignore().add(raw);
  } catch (error) {
    const err = error as NodeJS.ErrnoException | undefined;
    if (err && err.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
};

/**
 * Test whether a file or directory should be excluded via ignore patterns.
 */
const isPathIgnored = (
  matcher: Ignore | undefined,
  relativePath: string,
  isDirectory: boolean
): boolean => {
  if (!matcher || relativePath.length === 0) {
    return false;
  }
  const normalized = normalizeRelativePath(relativePath);
  if (isDirectory) {
    // ignore() expects a trailing slash to classify entries as directories.
    return matcher.ignores(`${normalized}/`);
  }
  return matcher.ignores(normalized);
};

/**
 * Traverse the project tree gathering files that meet the configured criteria.
 */
const collectTargetFiles = async (
  rootDir: string,
  extensions: Set<string>,
  matcher: Ignore | undefined
): Promise<string[]> => {
  const files: string[] = [];
  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      const relPath = relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        // Skip directories that are globally excluded or ignored by Prettier.
        if (SKIP_DIRECTORIES.has(entry.name)) {
          continue;
        }
        if (isPathIgnored(matcher, relPath, true)) {
          continue;
        }
        queue.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (!extensions.has(extension)) {
        // Skip early so we avoid even evaluating ignore rules for files the
        // user never intends to bannerise.
        continue;
      }
      if (isPathIgnored(matcher, relPath, false)) {
        continue;
      }
      files.push(fullPath);
    }
  }

  files.sort();
  return files;
};

/**
 * Validate that every banner line complies with the documented constraints.
 */
const validateBannerShape = (content: string): void => {
  // Enforce the contract: banner lines are comment-style or whitespace-only.
  const normalized = content.replace(/\r/g, '');
  const lines = normalized.split('\n');

  const hasNonEmptyLine = lines.some((line) => line.length > 0);
  if (!hasNonEmptyLine) {
    throw new Error('.prettierbanner must not be empty.');
  }

  for (const line of lines) {
    if (line.length === 0) {
      continue;
    }
    if (line.startsWith('//')) {
      continue;
    }
    if (/^\s+$/.test(line)) {
      continue;
    }
    throw new Error(
      '.prettierbanner can only contain lines that start with // or whitespace-only lines.'
    );
  }
};

/**
 * Load and canonicalise the banner, enforcing line count and formatting rules.
 */
const loadBanner = async (rootDir: string): Promise<string | undefined> => {
  const bannerPath = join(rootDir, BANNER_FILENAME);
  if (!existsSync(bannerPath)) {
    // Absence of the configuration file means the feature is disabled silently.
    return undefined;
  }
  const rawContent = await readFile(bannerPath, 'utf8');
  validateBannerShape(rawContent);
  const canonical = ensureTrailingBlankLine(rawContent);
  if (countLogicalLines(canonical) > MAX_BANNER_LINES) {
    throw new Error(
      `.prettierbanner must not exceed ${MAX_BANNER_LINES} lines (including the terminating blank line).`
    );
  }
  return canonical;
};

/**
 * Attempt to read a banner-like prefix from file content.
 */
const extractBannerCandidate = (
  content: string
): BannerCandidate | undefined => {
  // Scan the file prefix and collect at most MAX_BANNER_LINES lines that look like a banner.
  if (content.length === 0) {
    return undefined;
  }

  let cursor = 0;
  let linesRead = 0;
  let lastSegmentEnd = 0;
  let terminatorReached = false;

  while (linesRead < MAX_BANNER_LINES && cursor < content.length) {
    const nextNewline = content.indexOf('\n', cursor);
    const segmentEnd = nextNewline === -1 ? content.length : nextNewline + 1;
    let lineEnd = nextNewline === -1 ? content.length : nextNewline;
    if (lineEnd > cursor && content[lineEnd - 1] === '\r') {
      lineEnd -= 1;
    }
    const line = content.slice(cursor, lineEnd);

    const isWhitespace = line.trim().length === 0;
    const isComment = line.startsWith('//');

    if (!isComment && !isWhitespace) {
      break;
    }

    linesRead += 1;
    lastSegmentEnd = segmentEnd;
    cursor = segmentEnd;

    if (line.length === 0 || nextNewline === -1) {
      terminatorReached = true;
      break;
    }
  }

  // If we never hit the terminator, the prefix either exceeded MAX_BANNER_LINES
  // or contained real code before a blank separator, so we treat it as "no banner".
  if (!terminatorReached || linesRead === 0) {
    return undefined;
  }

  return {
    content: content.slice(0, lastSegmentEnd),
    consumed: lastSegmentEnd,
  };
};

/**
 * Split content into optional shebang line and remaining body.
 */
const separateShebang = (
  content: string
): { shebang: string; rest: string } => {
  if (!content.startsWith('#!')) {
    return { shebang: '', rest: content };
  }

  const newlineIndex = content.indexOf('\n');
  if (newlineIndex === -1) {
    return { shebang: content, rest: '' };
  }
  return {
    shebang: content.slice(0, newlineIndex + 1),
    rest: content.slice(newlineIndex + 1),
  };
};

/**
 * Insert or replace the banner inside a single file.
 */
const processFile = async (
  filePath: string,
  bannerContent: string
): Promise<BannerAction | undefined> => {
  // Insert or replace banner material while preserving the original shebang if present.
  const original = await readFile(filePath, 'utf8');
  const { shebang, rest } = separateShebang(original);

  let body = rest;
  const candidate = extractBannerCandidate(body);

  if (candidate && candidate.content === bannerContent) {
    return undefined;
  }

  let action: BannerAction = 'inserted';
  if (candidate) {
    // Drop however many bytes the candidate consumed; this cuts out the old
    // banner including its trailing separator.
    body = body.slice(candidate.consumed);
    action = 'replaced';
  }

  const newContent = shebang + bannerContent + body;
  if (newContent === original) {
    return undefined;
  }

  await writeFile(filePath, newContent, 'utf8');
  return action;
};

/**
 * Apply the banner to all eligible files under rootDir.
 */
export const applyBanner = async (
  options: ApplyBannerOptions
): Promise<BannerSummary | undefined> => {
  const { rootDir, logger, extensions } = options;
  const banner = await loadBanner(rootDir);
  if (!banner) {
    return undefined;
  }

  // Build ignore matcher and enumerate candidate files before we touch anything on disk.
  const matcher = await loadIgnoreMatcher(rootDir);
  const extensionSet = new Set(
    (extensions ?? Array.from(DEFAULT_EXTENSIONS)).map((ext) =>
      ext.toLowerCase()
    )
  );

  if (extensionSet.size === 0) {
    // With no extensions there is nothing meaningful to scan, so warn and
    // bail out early to avoid walking the filesystem.
    logger.warn(
      'Banner insertion skipped because no target extensions are configured.'
    );
    return undefined;
  }

  const targetFiles = await collectTargetFiles(rootDir, extensionSet, matcher);
  if (targetFiles.length === 0) {
    logger.debug('No files matched for banner insertion.');
    return { total: 0, inserted: 0, replaced: 0 };
  }

  const summary: BannerSummary = {
    total: targetFiles.length,
    inserted: 0,
    replaced: 0,
  };

  const touched: { file: string; action: BannerAction }[] = [];

  for (const file of targetFiles) {
    const action = await processFile(file, banner);
    if (!action) {
      // No change required; leave the file untouched to avoid triggering
      // watchers or unnecessary writes.
      continue;
    }
    touched.push({ file, action });
    if (action === 'inserted') {
      summary.inserted += 1;
    } else {
      summary.replaced += 1;
    }
  }

  if (touched.length > 0) {
    // Provide a concise diff-style log to help users see what changed.
    logger.info(
      `\x1b[32m✓\x1b[0m Banner applied to ${touched.length} file${touched.length === 1 ? '' : 's'}`
    );
    for (const { file, action } of touched) {
      const rel = normalizeRelativePath(relative(rootDir, file));
      logger.info(
        `  \x1b[90m${action === 'inserted' ? '+' : '~'} ${rel}\x1b[0m`
      );
    }
  } else {
    logger.debug('All banner targets already up-to-date.');
  }

  return summary;
};

export const DEFAULT_BANNER_EXTENSIONS = Array.from(DEFAULT_EXTENSIONS);
