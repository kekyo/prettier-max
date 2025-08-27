// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import type { Logger, Plugin } from 'vite';
import type { PrettierMaxOptions, ErrorReporter } from './types.js';
import type { Ignore } from 'ignore';
import { ConsoleReporter } from './reporters/console.js';
import {
  runPrettierFormat,
  runPrettierFormatProject,
  getPrettierVersion,
} from './checker.js';
import {
  createTargetsFilter,
  createIgnoreFilter,
  normalizeTargets,
} from './utils.js';

/**
 * Prettier automatic formatting plugin for Vite
 */
const prettierMax = (options: PrettierMaxOptions = {}): Plugin => {
  const {
    targets = undefined,
    configPath = undefined,
    reporter: customReporter = undefined,
    formatOnBuild = true,
    failOnFormatError = false,
  } = options;

  let reporter: ErrorReporter;
  let rootDir: string;
  let logger: Logger = undefined;
  let isFormatting = false;
  const recentlyFormattedFiles = new Map<string, number>();

  // Filter for file matching
  let fileFilter: Ignore | null = null;
  let useTargets = false;

  return {
    name: 'prettier-max',
    enforce: 'pre',

    configResolved: async (config) => {
      rootDir = config.root;
      logger = config.customLogger ?? config.logger;
      reporter = customReporter ?? new ConsoleReporter(rootDir);

      const normalizedTargets = normalizeTargets(targets);

      if (normalizedTargets) {
        // Use custom targets (ignore .prettierignore)
        fileFilter = createTargetsFilter(normalizedTargets);
        useTargets = true;
      } else {
        // Use .prettierignore and .gitignore
        fileFilter = await createIgnoreFilter(rootDir);
        useTargets = false;
      }

      // Check if prettier is available
      const prettierVersion = await getPrettierVersion();
      if (!prettierVersion) {
        logger.error(
          '[prettier-max] \x1b[31m✗\x1b[0m Prettier is not available. Please install prettier as a dependency.'
        );
      } else {
        logger.info(`[prettier-max] Detected prettier: ${prettierVersion}`);
        logger.info('[prettier-max] Automatic formatting enabled on build');
      }
    },

    configureServer: (devServer) => {
      // Store logger reference
      logger = devServer.config.logger;

      // Log plugin activation
      logger.info('[prettier-max] Automatic formatting plugin loaded');
      if (formatOnBuild) {
        logger.info(
          `[prettier-max] \x1b[90m  Will format files on build start\x1b[0m`
        );
      }
      if (useTargets) {
        logger.info(
          `[prettier-max] \x1b[90m  Using custom targets (gitignore syntax)\x1b[0m`
        );
      } else {
        logger.info(
          `[prettier-max] \x1b[90m  Using .prettierignore patterns\x1b[0m`
        );
      }
      if (configPath) {
        logger.info(`[prettier-max] \x1b[90m  Config: ${configPath}\x1b[0m`);
      }
    },

    handleHotUpdate: ({ file }) => {
      // Check if this file was recently formatted to prevent infinite loops
      const formattedTime = recentlyFormattedFiles.get(file);
      if (formattedTime && Date.now() - formattedTime < 5000) {
        // Ignore files that were formatted in the last 5 seconds
        recentlyFormattedFiles.delete(file);
        return [];
      }

      // Let Vite continue with HMR
      return;
    },

    buildStart: async () => {
      // Only run formatting if formatOnBuild is enabled
      if (!formatOnBuild) {
        return;
      }

      // Prevent concurrent formatting
      if (isFormatting) {
        logger.info(
          '[prettier-max] Formatting already in progress, skipping...'
        );
        return;
      }

      isFormatting = true;
      logger.info('[prettier-max] Formatting files before build...');

      // Set build mode and logger for console reporter
      if (reporter instanceof ConsoleReporter) {
        reporter.setBuildMode(true);
        reporter.setLogger(logger);
      }

      try {
        // Run prettier format on the entire project
        const result = await runPrettierFormatProject(
          rootDir,
          configPath,
          fileFilter
        );

        // Track formatted files to prevent infinite loops
        const now = Date.now();
        for (const file of result.formattedFiles) {
          recentlyFormattedFiles.set(file, now);
        }

        // Clean up old entries after 10 seconds
        setTimeout(() => {
          const cutoff = Date.now() - 10000;
          for (const [file, time] of recentlyFormattedFiles.entries()) {
            if (time < cutoff) {
              recentlyFormattedFiles.delete(file);
            }
          }
        }, 10000);

        if (result.errors.length > 0) {
          // Report errors using the configured reporter
          reporter.report(result.errors);

          logger.error(
            `[prettier-max] \x1b[31m✗\x1b[0m Failed to format ${result.errors.length} file${result.errors.length === 1 ? '' : 's'}`
          );

          if (failOnFormatError) {
            // Throw error to stop the build
            throw new Error(
              `Prettier formatting failed: ${result.errors.length} file${result.errors.length === 1 ? '' : 's'} could not be formatted.`
            );
          } else {
            logger.warn(
              '[prettier-max] \x1b[33m⚠\x1b[0m Build continuing despite formatting errors'
            );
          }
        } else if (result.formattedFiles.length > 0) {
          logger.info(
            `[prettier-max] \x1b[32m✓\x1b[0m Formatted ${result.formattedFiles.length} file${result.formattedFiles.length === 1 ? '' : 's'}`
          );
          // Log the formatted files
          for (const file of result.formattedFiles) {
            const relativePath = file.replace(rootDir + '/', '');
            logger.info(`[prettier-max]   \x1b[90m${relativePath}\x1b[0m`);
          }
        } else {
          logger.info(
            '[prettier-max] \x1b[32m✓\x1b[0m All files are already properly formatted'
          );
        }

        logger.info(
          `[prettier-max] \x1b[90mFormatting completed in ${result.duration}ms\x1b[0m`
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('Prettier formatting failed')
        ) {
          // Re-throw our own error
          throw error;
        }
        // Log other errors but don't fail the build unless failOnFormatError is true
        logger.error('[prettier-max] Error running prettier format:', error);
        if (failOnFormatError) {
          throw error;
        }
      } finally {
        isFormatting = false;
      }
    },
  };
};

export default prettierMax;
export type {
  PrettierMaxOptions,
  PrettierError,
  ErrorReporter,
} from './types.js';
