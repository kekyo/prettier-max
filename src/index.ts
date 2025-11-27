// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import type { Plugin } from 'vite';
import { resolve, relative } from 'path';
import type {
  PrettierMaxOptions,
  ErrorReporter,
  PrettierError,
} from './types.js';
import type { Logger } from './logger.js';
import { createViteLoggerAdapter, createConsoleLogger } from './logger.js';
import { ConsoleReporter } from './reporters/console.js';
import {
  runPrettierFormatProject,
  getPrettierVersion,
  getTypeScriptVersion,
  runTypeScriptCheck,
} from './checker.js';
import { generatePrettierConfigFiles } from './configGenerator.js';
import { version, git_commit_hash } from './generated/packageMetadata.js';
import { applyBanner } from './banner.js';

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
    generatePrettierConfig = true,
    detectDeprecated = true,
    bannerExtensions = undefined,
  } = options;

  let reporter: ErrorReporter;
  let rootDir: string;
  let logger: Logger = createConsoleLogger('prettier-max');
  let isFormatting = false;
  let resolvedTsconfigPaths: string[] | undefined;

  return {
    name: 'prettier-max',

    configResolved: async (config) => {
      rootDir = config.root;
      // Create logger adapter based on Vite's logger
      const viteLogger = config.customLogger ?? config.logger;
      if (viteLogger) {
        logger = createViteLoggerAdapter(
          viteLogger,
          config.logLevel ?? 'info',
          'prettier-max'
        );
      }
      reporter = customReporter ?? new ConsoleReporter(rootDir);
      resolvedTsconfigPaths =
        typeof typescript === 'string'
          ? [resolve(rootDir, typescript)]
          : Array.isArray(typescript)
            ? typescript
                .filter((tsconfigPath) => tsconfigPath)
                .map((tsconfigPath) => resolve(rootDir, tsconfigPath))
            : undefined;
      if (resolvedTsconfigPaths?.length) {
        resolvedTsconfigPaths = Array.from(new Set(resolvedTsconfigPaths));
      }

      logger.info(`${version}-${git_commit_hash}: Started.`);

      // Generate prettier config files if enabled
      if (generatePrettierConfig) {
        await generatePrettierConfigFiles(rootDir, logger);
      }

      // Check if prettier is available
      const prettierVersion = await getPrettierVersion(rootDir);
      if (!prettierVersion) {
        logger.error(
          '\x1b[31m✗\x1b[0m Prettier is not available. Please install prettier as a dependency.'
        );
      } else {
        logger.debug(`Detected prettier: ${prettierVersion}`);
        logger.info('Automatic formatting enabled on build');
      }

      // Check if TypeScript is available when validation is enabled
      if (typescript) {
        const typeScriptVersion = await getTypeScriptVersion();
        if (!typeScriptVersion) {
          logger.warn(
            '\x1b[33m⚠\x1b[0m TypeScript is not available. TypeScript validation will be skipped.'
          );
        } else {
          logger.debug(`Detected TypeScript: ${typeScriptVersion}`);
          logger.info('TypeScript validation enabled on build');
          if (resolvedTsconfigPaths?.length) {
            const [firstTsconfigPath] = resolvedTsconfigPaths;
            if (resolvedTsconfigPaths.length === 1 && firstTsconfigPath) {
              const displayTsconfigPath =
                relative(rootDir, firstTsconfigPath) || firstTsconfigPath;
              logger.info(`Using tsconfig: ${displayTsconfigPath}`);
            } else {
              logger.info(
                `Using ${resolvedTsconfigPaths.length} tsconfig files:`
              );
              for (const tsconfigPath of resolvedTsconfigPaths) {
                const displayTsconfigPath =
                  relative(rootDir, tsconfigPath) || tsconfigPath;
                logger.info(`  \x1b[90m${displayTsconfigPath}\x1b[0m`);
              }
            }
          }
          if (detectDeprecated) {
            logger.info('Deprecated symbol detection enabled');
          } else {
            logger.debug(
              'Deprecated symbol detection disabled (performance mode)'
            );
          }
        }
      }
    },

    configureServer: (devServer) => {
      // Update logger adapter with server's logger
      const viteLogger = devServer.config.logger;
      if (viteLogger) {
        logger = createViteLoggerAdapter(
          viteLogger,
          devServer.config.logLevel ?? 'info',
          'prettier-max'
        );
      }

      // Log plugin activation
      logger.info('Automatic formatting plugin loaded');
      if (formatOnBuild) {
        logger.info(`\x1b[90m  Will format files on build start\x1b[0m`);
      }
      logger.info(`\x1b[90m  Using .prettierignore patterns\x1b[0m`);
      if (configPath) {
        logger.info(`\x1b[90m  Config: ${configPath}\x1b[0m`);
      }
    },

    buildStart: async () => {
      // Prevent concurrent processing
      if (isFormatting) {
        logger.info('Formatting already in progress, skipping...');
        return;
      }

      try {
        await applyBanner({
          rootDir,
          logger,
          extensions: bannerExtensions,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Unexpected banner error: ${String(error)}`;
        logger.error(`Failed to apply banner: ${message}`);
        if (failOnError) {
          throw error;
        }
      }

      // Only run formatting if formatOnBuild is enabled
      if (!formatOnBuild) {
        return;
      }

      isFormatting = true;
      logger.info('Formatting files before build...');

      // Set build mode and logger for console reporter
      if (reporter instanceof ConsoleReporter) {
        reporter.setBuildMode(true);
        reporter.setLogger(logger);
      }

      try {
        // Run prettier format on the entire project
        const result = await runPrettierFormatProject(rootDir, configPath);

        if (result.errors.length > 0) {
          // Report errors using the configured reporter
          reporter.report(result.errors);

          logger.error(
            `\x1b[31m✗\x1b[0m Failed to format ${result.errors.length} file${result.errors.length === 1 ? '' : 's'}`
          );

          if (failOnError) {
            // Throw error to stop the build
            throw new Error(
              `Prettier formatting failed: ${result.errors.length} file${result.errors.length === 1 ? '' : 's'} could not be formatted.`
            );
          } else {
            logger.warn(
              '\x1b[33m⚠\x1b[0m Build continuing despite formatting errors'
            );
          }
        } else if (result.formattedFiles.length > 0) {
          logger.info(
            `\x1b[32m✓\x1b[0m Formatted ${result.formattedFiles.length} file${result.formattedFiles.length === 1 ? '' : 's'}`
          );
          // Log the formatted files
          for (const file of result.formattedFiles) {
            const relativePath = file.replace(rootDir + '/', '');
            logger.info(`  \x1b[90m${relativePath}\x1b[0m`);
          }
        } else {
          logger.info(
            '\x1b[32m✓\x1b[0m All files are already properly formatted'
          );
        }

        logger.info(
          `\x1b[90mFormatting completed in ${result.duration}ms\x1b[0m`
        );

        // Run TypeScript validation if enabled and formatting was successful
        if (typescript && result.errors.length === 0) {
          const tsVersion = await getTypeScriptVersion();
          if (tsVersion) {
            const tsconfigTargets =
              resolvedTsconfigPaths && resolvedTsconfigPaths.length > 0
                ? resolvedTsconfigPaths
                : [undefined];
            const aggregatedErrors: PrettierError[] = [];
            let totalTsDuration = 0;

            for (const [index, tsconfigPath] of tsconfigTargets.entries()) {
              const displayTsconfigPath =
                tsconfigPath !== undefined
                  ? relative(rootDir, tsconfigPath) || tsconfigPath
                  : undefined;

              const runLabel =
                tsconfigTargets.length > 1
                  ? `Running TypeScript validation (${index + 1}/${tsconfigTargets.length})`
                  : 'Running TypeScript validation';

              logger.info(
                displayTsconfigPath
                  ? `${runLabel} with ${displayTsconfigPath}...`
                  : `${runLabel}...`
              );

              const tsResult = await runTypeScriptCheck(
                rootDir,
                detectDeprecated,
                logger,
                tsconfigPath
              );

              totalTsDuration += tsResult.duration;

              if (tsResult.errors.length > 0) {
                logger.error(
                  `\x1b[31m✗\x1b[0m TypeScript validation failed${displayTsconfigPath ? ` for ${displayTsconfigPath}` : ''}: ${tsResult.errors.length} error${tsResult.errors.length === 1 ? '' : 's'}`
                );

                // Log each error
                for (const error of tsResult.errors) {
                  const relativePath = error.file.replace(rootDir + '/', '');
                  if (error.line && error.column) {
                    logger.error(
                      `  \x1b[31m${relativePath}:${error.line}:${error.column}\x1b[0m - ${error.message}`
                    );
                  } else {
                    logger.error(
                      `  \x1b[31m${relativePath}\x1b[0m - ${error.message}`
                    );
                  }
                }

                aggregatedErrors.push(...tsResult.errors);
                if (!failOnError) {
                  logger.warn(
                    '\x1b[33m⚠\x1b[0m Build continuing despite TypeScript errors'
                  );
                }
              } else {
                logger.info(
                  `\x1b[32m✓\x1b[0m TypeScript validation passed${displayTsconfigPath ? ` for ${displayTsconfigPath}` : ''}`
                );
              }

              logger.info(
                `\x1b[90mTypeScript validation completed in ${tsResult.duration}ms${displayTsconfigPath ? ` (${displayTsconfigPath})` : ''}\x1b[0m`
              );
            }

            if (tsconfigTargets.length > 1) {
              logger.info(
                `\x1b[90mTotal TypeScript validation time: ${totalTsDuration}ms\x1b[0m`
              );
            }

            if (aggregatedErrors.length > 0 && failOnError) {
              throw new Error(
                `TypeScript validation failed: ${aggregatedErrors.length} error${aggregatedErrors.length === 1 ? '' : 's'} found.`
              );
            }
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
          logger.error(`Error running prettier format: ${error.message}`);
        } else {
          logger.error(`Error running prettier format: ${String(error)}`);
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
