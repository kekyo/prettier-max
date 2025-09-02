// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { promises as fs } from 'fs';
import * as path from 'path';
import type { Logger } from './logger.js';
import { prettierrcTemplate, prettierignoreTemplate } from './templates.js';

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

  // Generate .prettierrc if it doesn't exist
  const prettierrcExists = await fileExists(prettierrcPath);
  if (!prettierrcExists) {
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
