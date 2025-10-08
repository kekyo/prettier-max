// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { promises as fs } from 'fs';
import * as path from 'path';
import type { Logger } from './logger.js';
import { prettierrcTemplate, prettierignoreTemplate } from './templates.js';

// Prettier supports these configuration entry points. If any of them are present,
// we should not add another config file automatically.
const PRETTIER_CONFIG_FILES = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.json5',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.ts',
  '.prettierrc.cts',
  '.prettierrc.mts',
  '.prettierrc.toml',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
  'prettier.config.cts',
  'prettier.config.mts',
] as const;

const PACKAGE_MANIFEST_FILES = ['package.json', 'package.yaml', 'package.yml'];

/**
 * Check if a file exists
 */
const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const findExistingPrettierConfig = async (
  rootDir: string,
  logger: Logger
): Promise<string | undefined> => {
  // Check known config files first
  for (const fileName of PRETTIER_CONFIG_FILES) {
    const configPath = path.join(rootDir, fileName);
    if (await fileExists(configPath)) {
      return configPath;
    }
  }

  // Check package manifests for embedded prettier config
  for (const manifestName of PACKAGE_MANIFEST_FILES) {
    const manifestPath = path.join(rootDir, manifestName);
    if (!(await fileExists(manifestPath))) {
      continue;
    }

    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      if (manifestName.endsWith('.json')) {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(parsed, 'prettier')) {
          return manifestPath;
        }
      } else {
        const hasPrettierEntry = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .some((line) => /^['"]?prettier['"]?\s*:/.test(line));

        if (hasPrettierEntry) {
          return manifestPath;
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug(
        `Failed to inspect ${manifestName} for prettier config: ${errorMessage}`
      );
    }
  }

  return undefined;
};

/**
 * Generate prettier config files if they don't exist
 */
export const generatePrettierConfigFiles = async (
  rootDir: string,
  logger: Logger
): Promise<void> => {
  const prettierrcPath = path.join(rootDir, '.prettierrc');
  const prettierignorePath = path.join(rootDir, '.prettierignore');

  let filesGenerated = false;

  const existingPrettierConfigPath = await findExistingPrettierConfig(
    rootDir,
    logger
  );

  // Generate .prettierrc if it doesn't exist
  if (!existingPrettierConfigPath) {
    try {
      const content = JSON.stringify(prettierrcTemplate, null, 2) + '\n';
      await fs.writeFile(prettierrcPath, content, 'utf-8');
      logger.info(
        '\x1b[32m✓\x1b[0m Generated .prettierrc file with default configuration'
      );
      filesGenerated = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        `\x1b[33m⚠\x1b[0m Failed to generate .prettierrc: ${errorMessage}`
      );
    }
  } else {
    const relative = path.relative(rootDir, existingPrettierConfigPath);
    const descriptor =
      relative === '' ? path.basename(existingPrettierConfigPath) : relative;
    logger.info(
      `\x1b[90mExisting Prettier config detected (${descriptor}). Skipping .prettierrc generation.\x1b[0m`
    );
  }

  // Generate .prettierignore if it doesn't exist
  const prettierignoreExists = await fileExists(prettierignorePath);
  if (!prettierignoreExists) {
    try {
      await fs.writeFile(prettierignorePath, prettierignoreTemplate, 'utf-8');
      logger.info(
        '\x1b[32m✓\x1b[0m Generated .prettierignore file with default patterns'
      );
      filesGenerated = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        `\x1b[33m⚠\x1b[0m Failed to generate .prettierignore: ${errorMessage}`
      );
    }
  }

  if (filesGenerated) {
    logger.info(
      '\x1b[90mPrettier config files have been generated. You can customize them as needed.\x1b[0m'
    );
  }
};
