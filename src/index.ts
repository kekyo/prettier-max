// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import type { Logger, Plugin } from 'vite';
import type { PrettierMaxOptions, ErrorReporter } from './types.js';
import { ConsoleReporter } from './reporters/console.js';
import {
  runPrettierFormatProject,
  getPrettierVersion,
  getTypeScriptVersion,
  runTypeScriptCheck,
} from './checker.js';
import { version, git_commit_hash } from './generated/packageMetadata.js';

/**
 * Prettier automatic formatting plugin for Vite
 */
const prettierMax = (options: PrettierMaxOptions = {}): Plugin => {
  const {
    configPath = undefined,
    reporter: customReporter = undefined,
    formatOnBuild = true,
    failOnError = true,
    typescript = true,
  } = options;

  let reporter: ErrorReporter;
  let rootDir: string;
  let logger: Logger | undefined = undefined;
  let isFormatting = false;

  return {
    name: 'prettier-max',

    configResolved: async (config) => {
      rootDir = config.root;
      logger = config.customLogger ?? config.logger;
      reporter = customReporter ?? new ConsoleReporter(rootDir);

      logger?.info(`[prettier-max]: ${version}-${git_commit_hash}: Started.`);

      // Check if prettier is available
      const prettierVersion = await getPrettierVersion();
      if (!prettierVersion) {
        logger?.error(
          '[prettier-max]: \x1b[31m✗\x1b[0m Prettier is not available. Please install prettier as a dependency.'
        );
      } else {
        logger?.info(`[prettier-max]: Detected prettier: ${prettierVersion}`);
        logger?.info('[prettier-max]: Automatic formatting enabled on build');
      }

      // Check if TypeScript is available when validation is enabled
      if (typescript) {
        const typeScriptVersion = await getTypeScriptVersion();
        if (!typeScriptVersion) {
          logger?.warn(
            '[prettier-max]: \x1b[33m⚠\x1b[0m TypeScript is not available. TypeScript validation will be skipped.'
          );
        } else {
          logger?.info(
            `[prettier-max]: Detected TypeScript: ${typeScriptVersion}`
          );
          logger?.info(
            '[prettier-max]: TypeScript validation enabled on build'
          );
        }
      }
    },

    configureServer: (devServer) => {
      // Store logger reference
      logger = devServer.config.logger;

      // Log plugin activation
      logger?.info('[prettier-max]: Automatic formatting plugin loaded');
      if (formatOnBuild) {
        logger?.info(
          `[prettier-max]: \x1b[90m  Will format files on build start\x1b[0m`
        );
      }
      logger?.info(
        `[prettier-max]: \x1b[90m  Using .prettierignore patterns\x1b[0m`
      );
      if (configPath) {
        logger?.info(`[prettier-max]: \x1b[90m  Config: ${configPath}\x1b[0m`);
      }
    },

    buildStart: async () => {
      // Only run formatting if formatOnBuild is enabled
      if (!formatOnBuild) {
        return;
      }

      // Prevent concurrent formatting
      if (isFormatting) {
        logger?.info(
          '[prettier-max]: Formatting already in progress, skipping...'
        );
        return;
      }

      isFormatting = true;
      logger?.info('[prettier-max]: Formatting files before build...');

      // Set build mode and logger for console reporter
      if (reporter instanceof ConsoleReporter && logger) {
        reporter.setBuildMode(true);
        reporter.setLogger(logger);
      }

      try {
        // Run prettier format on the entire project
        const result = await runPrettierFormatProject(rootDir, configPath);

        if (result.errors.length > 0) {
          // Report errors using the configured reporter
          reporter.report(result.errors);

          logger?.error(
            `[prettier-max]: \x1b[31m✗\x1b[0m Failed to format ${result.errors.length} file${result.errors.length === 1 ? '' : 's'}`
          );

          if (failOnError) {
            // Throw error to stop the build
            throw new Error(
              `Prettier formatting failed: ${result.errors.length} file${result.errors.length === 1 ? '' : 's'} could not be formatted.`
            );
          } else {
            logger?.warn(
              '[prettier-max]: \x1b[33m⚠\x1b[0m Build continuing despite formatting errors'
            );
          }
        } else if (result.formattedFiles.length > 0) {
          logger?.info(
            `[prettier-max]: \x1b[32m✓\x1b[0m Formatted ${result.formattedFiles.length} file${result.formattedFiles.length === 1 ? '' : 's'}`
          );
          // Log the formatted files
          for (const file of result.formattedFiles) {
            const relativePath = file.replace(rootDir + '/', '');
            logger?.info(`[prettier-max]:   \x1b[90m${relativePath}\x1b[0m`);
          }
        } else {
          logger?.info(
            '[prettier-max]: \x1b[32m✓\x1b[0m All files are already properly formatted'
          );
        }

        logger?.info(
          `[prettier-max]: \x1b[90mFormatting completed in ${result.duration}ms\x1b[0m`
        );

        // Run TypeScript validation if enabled and formatting was successful
        if (typescript && result.errors.length === 0) {
          const tsVersion = await getTypeScriptVersion();
          if (tsVersion) {
            logger?.info('[prettier-max]: Running TypeScript validation...');
            const tsResult = await runTypeScriptCheck(rootDir);

            if (tsResult.errors.length > 0) {
              logger?.error(
                `[prettier-max]: \x1b[31m✗\x1b[0m TypeScript validation failed: ${tsResult.errors.length} error${tsResult.errors.length === 1 ? '' : 's'}`
              );

              // Log each error
              for (const error of tsResult.errors) {
                const relativePath = error.file.replace(rootDir + '/', '');
                if (error.line && error.column) {
                  logger?.error(
                    `[prettier-max]:   \x1b[31m${relativePath}:${error.line}:${error.column}\x1b[0m - ${error.message}`
                  );
                } else {
                  logger?.error(
                    `[prettier-max]:   \x1b[31m${relativePath}\x1b[0m - ${error.message}`
                  );
                }
              }

              if (failOnError) {
                throw new Error(
                  `TypeScript validation failed: ${tsResult.errors.length} error${tsResult.errors.length === 1 ? '' : 's'} found.`
                );
              } else {
                logger?.warn(
                  '[prettier-max]: \x1b[33m⚠\x1b[0m Build continuing despite TypeScript errors'
                );
              }
            } else {
              logger?.info(
                '[prettier-max]: \x1b[32m✓\x1b[0m TypeScript validation passed'
              );
            }

            logger?.info(
              `[prettier-max]: \x1b[90mTypeScript validation completed in ${tsResult.duration}ms\x1b[0m`
            );
          }
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('Prettier formatting failed')
        ) {
          // Re-throw our own error
          throw error;
        }
        // Log other errors but don't fail the build unless failOnError is true
        if (error instanceof Error) {
          logger?.error(
            `[prettier-max]: Error running prettier format: ${error.message}`
          );
        } else {
          logger?.error(
            `[prettier-max]: Error running prettier format: ${String(error)}`
          );
        }
        if (failOnError) {
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
