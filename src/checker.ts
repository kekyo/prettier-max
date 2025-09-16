// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { spawn } from 'child_process';
import { join, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
type TS = typeof import('typescript');
import type { FormatResult, PrettierError } from './types.js';
import type { Logger } from './logger.js';

/**
 * Run prettier format on entire project
 */
export const runPrettierFormatProject = async (
  rootDir: string,
  configPath: string | undefined
): Promise<FormatResult> => {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const errors: PrettierError[] = [];
    const formattedFiles: string[] = [];

    // Build prettier command arguments
    const args = ['--write', '.', '--list-different'];

    if (configPath) {
      args.push('--config', configPath);
    }

    const resolvedBin = resolvePrettierBin(rootDir);

    const prettierProcess =
      resolvedBin !== undefined
        ? // Execute Prettier CLI via Node to ensure cross-platform
          spawn(process.execPath, [resolvedBin, ...args], {
            cwd: rootDir,
          })
        : // Fallback to npx if resolution failed
          spawn('npx', ['prettier', ...args], {
            cwd: rootDir,
            shell: process.platform === 'win32',
          });

    let stdout = '';
    let stderr = '';

    prettierProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    prettierProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    prettierProcess.on('close', (code) => {
      const duration = Date.now() - startTime;

      // Code 0: All files formatted successfully
      // Code 2: Something went wrong (e.g., invalid config)

      if (code === 2) {
        // Configuration or other error
        if (stderr) {
          errors.push({
            file: rootDir,
            message: `Prettier error: ${stderr.trim()}`,
          });
        }
        resolve({
          success: false,
          errors,
          formattedFiles,
          duration,
        });
        return;
      }

      // Parse formatted files from stdout (listed by --list-different)
      if (stdout) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('[')) {
            formattedFiles.push(join(rootDir, trimmed));
          }
        }
      }

      resolve({
        success: code === 0,
        errors,
        formattedFiles,
        duration,
      });
    });

    prettierProcess.on('error', (error) => {
      const duration = Date.now() - startTime;
      errors.push({
        file: rootDir,
        message: `Failed to run prettier: ${error.message}`,
      });

      resolve({
        success: false,
        errors,
        formattedFiles,
        duration,
      });
    });
  });
};

/**
 * Check if prettier is available
 */
export const getPrettierVersion = async (
  preferredRoot?: string
): Promise<string | undefined> => {
  return new Promise((resolve) => {
    const resolvedBin = resolvePrettierBin(
      preferredRoot ?? process.cwd(),
      preferredRoot ? [process.cwd()] : []
    );
    if (resolvedBin) {
      let stdout: string = '';
      const cp = spawn(process.execPath, [resolvedBin, '--version']);
      cp.stdout.on('data', (data) => (stdout += data.toString()));
      cp.on('close', (code) => {
        resolve(code === 0 ? stdout.trim() : undefined);
      });
      cp.on('error', () => resolve(undefined));
      return;
    }
    // Final fallback: use npx
    const checkProcess = spawn('npx', ['prettier', '--version'], {
      shell: process.platform === 'win32',
    });
    let stdout: string = '';
    checkProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    checkProcess.on('close', (code) => {
      resolve(code === 0 ? stdout.trim() : undefined);
    });
    checkProcess.on('error', () => {
      resolve(undefined);
    });
  });
};

/**
 * Resolve Prettier CLI bin path.
 * Priority: project local -> hoisted/monorepo -> plugin's own dependency.
 */
const resolvePrettierBin = (
  rootDir: string,
  additionalRoots: string[] = []
): string | undefined => {
  const candidates = [rootDir, ...additionalRoots];
  for (const candidate of candidates) {
    const resolved = tryResolvePrettierFrom(candidate);
    if (resolved) {
      return resolved;
    }
  }

  // Then try resolve relative to this package (plugin's own dep)
  const pluginResolved = tryResolvePrettierFrom(getThisModuleDir());
  if (pluginResolved) {
    return pluginResolved;
  }

  return undefined;
};

const tryResolvePrettierFrom = (basePath: string): string | undefined => {
  try {
    const pkgPath = require.resolve('prettier/package.json', {
      paths: [basePath],
    });
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      bin?: string | { [k: string]: string };
    };
    let binRel: string | undefined;
    if (typeof pkg.bin === 'string') {
      binRel = pkg.bin;
    } else if (pkg.bin && typeof pkg.bin === 'object') {
      binRel = pkg.bin['prettier'];
    }
    // Fallback to known path for Prettier v3
    if (!binRel) {
      binRel = ['bin', 'prettier.cjs'].join(sep);
    }
    const binAbs = join(dirname(pkgPath), binRel);
    return binAbs;
  } catch {
    return undefined;
  }
};

const getThisModuleDir = (): string => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    // Fallback for environments where import.meta.url is not available
    return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
};

/**
 * Check if TypeScript is available and get its version
 */
export const getTypeScriptVersion = async (): Promise<string | undefined> => {
  const ts = await loadTypeScript();
  return ts?.version;
};

// Dynamically load TypeScript module if available
const loadTypeScript = async (): Promise<TS | undefined> => {
  try {
    const mod: any = await import('typescript');
    return (mod?.default ?? mod) as TS;
  } catch {
    return undefined;
  }
};

/**
 * Check for deprecated symbol usage in TypeScript code
 */
const checkDeprecatedUsage = (
  ts: typeof import('typescript'),
  program: import('typescript').Program,
  checker: import('typescript').TypeChecker,
  logger?: Logger
): PrettierError[] => {
  const deprecationWarnings: PrettierError[] = [];
  const checkedLocations = new Set<string>(); // "filename:line:column" format
  const suppressedLines = new Map<string, Set<number>>(); // filename -> line numbers
  const usedSuppressions = new Set<string>(); // "filename:line" format

  // Helper function to get deprecation message from JSDoc tags
  const getDeprecationMessage = (
    symbol: import('typescript').Symbol
  ): string | undefined => {
    try {
      const jsdocTags = symbol.getJsDocTags(checker);
      const deprecatedTag = jsdocTags.find((tag) => tag.name === 'deprecated');
      if (deprecatedTag && deprecatedTag.text) {
        return deprecatedTag.text.map((part) => part.text).join('');
      }
    } catch {
      // Ignore errors when getting JSDoc tags
    }
    return undefined;
  };

  // Visit each source file
  for (const sourceFile of program.getSourceFiles()) {
    // Skip node_modules and declaration files
    if (
      sourceFile.fileName.includes('node_modules') ||
      sourceFile.isDeclarationFile
    ) {
      continue;
    }

    // Check for suppression directives in comments
    const sourceText = sourceFile.getFullText();
    const processedComments = new Set<number>(); // Track processed comments by position

    // Process all comments in the file to find suppression directives
    ts.forEachChild(
      sourceFile,
      function processNode(node: import('typescript').Node): void {
        const nodeStart = node.getFullStart();
        const leadingComments =
          ts.getLeadingCommentRanges(sourceText, nodeStart) || [];

        for (const comment of leadingComments) {
          // Skip if we've already processed this comment
          if (processedComments.has(comment.pos)) {
            continue;
          }
          processedComments.add(comment.pos);

          const commentText = sourceText.substring(comment.pos, comment.end);
          // Check for `@prettier-max-ignore-deprecated` directive
          const match = commentText.match(
            /^\/\/\s*@prettier-max-ignore-deprecated(?::?\s*(.*))?$/m
          );
          if (match) {
            const { line: commentLine } =
              sourceFile.getLineAndCharacterOfPosition(comment.pos);
            const nextLine = commentLine + 2; // +1 for 0-based, +1 for next line

            if (!suppressedLines.has(sourceFile.fileName)) {
              suppressedLines.set(sourceFile.fileName, new Set());
            }
            suppressedLines.get(sourceFile.fileName)!.add(nextLine);

            if (logger) {
              const note = match[1] ? `: ${match[1].trim()}` : '';
              logger.debug(
                `Found suppression directive at ${sourceFile.fileName}:${commentLine + 1}${note}`
              );
            }
          }
        }

        ts.forEachChild(node, processNode);
      }
    );

    // Walk the AST to find deprecated usage
    const visit = (node: import('typescript').Node): void => {
      // Helper: detect if this node has a JSDoc @deprecated tag in leading comments
      const hasDeprecatedLeadingJsDoc = (
        n: import('typescript').Node
      ): boolean => {
        try {
          const start = n.getFullStart();
          const comments = ts.getLeadingCommentRanges(sourceText, start) || [];
          for (const c of comments) {
            // Only treat block JSDoc style comments (/** ... */) as candidates
            const text = sourceText.substring(c.pos, c.end);
            if (text.startsWith('/**') && /@deprecated\b/.test(text)) {
              return true;
            }
          }
        } catch {
          // ignore
        }
        return false;
      };

      // Check if this is a function-like node that is deprecated
      // If so, skip checking its body
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node)
      ) {
        let funcSymbol: import('typescript').Symbol | undefined;

        // Get symbol based on node type
        if (ts.isFunctionDeclaration(node) && node.name) {
          funcSymbol = checker.getSymbolAtLocation(node.name);
        } else if (ts.isMethodDeclaration(node) && node.name) {
          funcSymbol = checker.getSymbolAtLocation(node.name);
        } else if (ts.isConstructorDeclaration(node)) {
          // For constructors, check the parent class
          const parent = node.parent;
          if (ts.isClassDeclaration(parent) && parent.name) {
            funcSymbol = checker.getSymbolAtLocation(parent.name);
          }
        } else if (
          (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
          node.parent &&
          ts.isVariableDeclaration(node.parent) &&
          ts.isIdentifier(node.parent.name)
        ) {
          // For arrow functions and function expressions, check the variable declaration
          funcSymbol = checker.getSymbolAtLocation(node.parent.name);
        }

        // If this function is deprecated, skip checking its body
        if (funcSymbol && getDeprecationMessage(funcSymbol) !== undefined) {
          return; // Early return - don't check descendants
        }
      }

      // If this is an export declaration and it has a JSDoc @deprecated,
      // skip checking within this export statement (re-exports of deprecated symbols are ignored)
      if (ts.isExportDeclaration(node)) {
        // Check JSDoc on the export declaration itself
        // Use leading JSDoc comment because export declarations typically don't have symbols
        if (hasDeprecatedLeadingJsDoc(node)) {
          return; // Don't check descendants (export specifiers)
        }
      }

      // If this is a type alias declaration and it's marked as @deprecated,
      // skip checking inside its type definition (e.g., export type Foo = OldType)
      if (ts.isTypeAliasDeclaration(node) && node.name) {
        const typeSymbol = checker.getSymbolAtLocation(node.name);
        if (typeSymbol && getDeprecationMessage(typeSymbol) !== undefined) {
          return; // Early return - don't check descendants
        }
        // Also honor leading JSDoc on the declaration (as a fallback)
        if (hasDeprecatedLeadingJsDoc(node)) {
          return; // Early return - don't check descendants
        }
      }

      let symbolToCheck: import('typescript').Symbol | undefined;
      let nodeToReport = node;

      // Determine which symbol to check based on node type
      if (ts.isIdentifier(node)) {
        // Skip if this is a declaration name (not a usage)
        const parent = node.parent;
        if (
          parent &&
          ((ts.isClassDeclaration(parent) && parent.name === node) ||
            (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
            (ts.isFunctionDeclaration(parent) && parent.name === node) ||
            (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
            (ts.isEnumDeclaration(parent) && parent.name === node))
        ) {
          return; // Skip declarations
        }

        // For variable declarations, only skip if it's not an initializer referencing a deprecated symbol
        if (
          parent &&
          ts.isVariableDeclaration(parent) &&
          parent.name === node
        ) {
          // This is the variable name being declared, not a usage
          return;
        }

        // Direct identifier reference
        symbolToCheck = checker.getSymbolAtLocation(node);
      } else if (ts.isPropertyAccessExpression(node)) {
        // Property access (obj.prop)
        symbolToCheck = checker.getSymbolAtLocation(node);
      } else if (ts.isElementAccessExpression(node)) {
        // Element access (obj['prop'])
        symbolToCheck = checker.getSymbolAtLocation(node);
      } else if (ts.isCallExpression(node)) {
        // Function call - check the function being called
        symbolToCheck = checker.getSymbolAtLocation(node.expression);
        nodeToReport = node.expression;
      } else if (ts.isNewExpression(node)) {
        // Constructor call - check the class being instantiated
        symbolToCheck = checker.getSymbolAtLocation(node.expression);
        nodeToReport = node.expression;
      } else if (ts.isImportSpecifier(node)) {
        // Import specifier - check the imported symbol
        const importedSymbol = checker.getSymbolAtLocation(node.name);
        if (importedSymbol) {
          // Get the actual symbol being imported
          const aliasedSymbol = checker.getAliasedSymbol(importedSymbol);
          symbolToCheck = aliasedSymbol || importedSymbol;
        }
      } else if (ts.isImportClause(node)) {
        // Check default import (e.g., import MyDefault from './module')
        if (node.name) {
          const importedSymbol = checker.getSymbolAtLocation(node.name);
          if (importedSymbol) {
            const aliasedSymbol = checker.getAliasedSymbol(importedSymbol);
            symbolToCheck = aliasedSymbol || importedSymbol;
            nodeToReport = node.name;
          }
        }
      } else if (ts.isExportSpecifier(node)) {
        // Export specifier - check the exported symbol
        const exportedSymbol = checker.getSymbolAtLocation(node.name);
        if (exportedSymbol) {
          // Get the actual symbol being exported
          const aliasedSymbol = checker.getAliasedSymbol(exportedSymbol);
          symbolToCheck = aliasedSymbol || exportedSymbol;
        }
      } else if (ts.isTypeReferenceNode(node)) {
        // Type reference - check the referenced type
        symbolToCheck = checker.getSymbolAtLocation(node.typeName);
        nodeToReport = node.typeName;
      }

      if (symbolToCheck) {
        // Check if we've already processed this exact location
        const sourceFile = nodeToReport.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          nodeToReport.getStart()
        );
        const locationKey = `${sourceFile.fileName}:${line + 1}:${character + 1}`;

        if (checkedLocations.has(locationKey)) {
          return; // Skip if we've already checked this exact location
        }
        checkedLocations.add(locationKey);

        // Check if symbol is deprecated
        const deprecationMessage = getDeprecationMessage(symbolToCheck);
        if (deprecationMessage !== undefined) {
          const actualLine = line + 1;

          // Check if this line is suppressed
          const isSuppressed =
            suppressedLines.get(sourceFile.fileName)?.has(actualLine) || false;

          if (isSuppressed) {
            // Mark this suppression as used
            usedSuppressions.add(`${sourceFile.fileName}:${actualLine}`);
            if (logger) {
              logger.info(
                `Suppressed deprecated warning for '${symbolToCheck.getName()}' at ${sourceFile.fileName}:${actualLine}`
              );
            }
          } else {
            deprecationWarnings.push({
              file: sourceFile.fileName,
              line: actualLine,
              column: character + 1,
              message: `PMAX001: '${symbolToCheck.getName()}' is deprecated${
                deprecationMessage ? `: ${deprecationMessage}` : ''
              }`,
            });
          }
        }

        // Also check the value declaration for ModifierFlags.Deprecated
        if (symbolToCheck.valueDeclaration) {
          const modifierFlags = ts.getCombinedModifierFlags(
            symbolToCheck.valueDeclaration as import('typescript').Declaration
          );
          if (modifierFlags & ts.ModifierFlags.Deprecated) {
            const actualLine = line + 1;

            // Check if this line is suppressed
            const isSuppressed =
              suppressedLines.get(sourceFile.fileName)?.has(actualLine) ||
              false;

            // Only add if not already added by JSDoc check and not suppressed
            const alreadyAdded = deprecationWarnings.some(
              (w) =>
                w.file === sourceFile.fileName &&
                w.line === actualLine &&
                w.column === character + 1
            );

            const alreadySuppressed = usedSuppressions.has(
              `${sourceFile.fileName}:${actualLine}`
            );

            if (!alreadyAdded && !alreadySuppressed) {
              if (isSuppressed) {
                // Mark this suppression as used
                usedSuppressions.add(`${sourceFile.fileName}:${actualLine}`);
                if (logger) {
                  logger.info(
                    `Suppressed deprecated warning for '${symbolToCheck.getName()}' at ${sourceFile.fileName}:${actualLine}`
                  );
                }
              } else {
                deprecationWarnings.push({
                  file: sourceFile.fileName,
                  line: actualLine,
                  column: character + 1,
                  message: `PMAX001: '${symbolToCheck.getName()}' is deprecated`,
                });
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  // Check for unused suppression directives (PMAX002)
  for (const [fileName, lines] of suppressedLines) {
    for (const line of lines) {
      const suppressionKey = `${fileName}:${line}`;
      if (!usedSuppressions.has(suppressionKey)) {
        // Find the directive comment position (it's on the line before)
        const sourceFile = program.getSourceFile(fileName);
        if (sourceFile) {
          deprecationWarnings.push({
            file: fileName,
            line: line - 1, // Report on the directive line itself
            column: 1,
            message: `PMAX002: Unnecessary @prettier-max-ignore-deprecated directive - no deprecated usage found on the next line`,
          });
        }
      }
    }
  }

  return deprecationWarnings;
};

/**
 * Run TypeScript type checking using TypeScript Compiler API
 */
export const runTypeScriptCheck = async (
  cwd: string,
  detectDeprecated: boolean = true,
  logger?: Logger
): Promise<FormatResult> => {
  const startTime = Date.now();
  const errors: PrettierError[] = [];

  try {
    const ts = await loadTypeScript();
    if (!ts) {
      // TypeScript is not available; skip validation gracefully
      return {
        success: true,
        errors: [],
        formattedFiles: [],
        duration: Date.now() - startTime,
      };
    }
    // Find tsconfig.json
    const configFileName = ts.findConfigFile(
      cwd,
      ts.sys.fileExists,
      'tsconfig.json'
    );

    if (!configFileName) {
      return {
        success: false,
        errors: [
          {
            file: cwd,
            message: 'Could not find a valid tsconfig.json',
          },
        ],
        formattedFiles: [],
        duration: Date.now() - startTime,
      };
    }

    // Read and parse tsconfig.json
    const configFile = ts.readConfigFile(configFileName, ts.sys.readFile);
    if (configFile.error) {
      const formatted = ts.formatDiagnostic(configFile.error, {
        getCurrentDirectory: () => cwd,
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => ts.sys.newLine,
      });

      // Parse formatted error to extract components
      const lines = formatted.split('\n');
      for (const line of lines) {
        const match = line.match(
          /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/
        );
        if (match && match[1] && match[2] && match[3] && match[4] && match[5]) {
          errors.push({
            file: match[1],
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
            message: `${match[4]}: ${match[5]}`,
          });
        } else if (line.trim()) {
          errors.push({
            file: configFileName,
            message: line.trim(),
          });
        }
      }

      return {
        success: false,
        errors,
        formattedFiles: [],
        duration: Date.now() - startTime,
      };
    }

    // Parse the configuration
    const parsedCommandLine = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      dirname(configFileName)
    );

    // Set noEmit to true to match tsc --noEmit behavior
    parsedCommandLine.options.noEmit = true;

    // Create TypeScript program
    const program = ts.createProgram(
      parsedCommandLine.fileNames,
      parsedCommandLine.options
    );

    // Get all diagnostics
    const allDiagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(program.getConfigFileParsingDiagnostics());

    // Format diagnostics to match tsc output format
    if (allDiagnostics.length > 0) {
      const formatHost: import('typescript').FormatDiagnosticsHost = {
        getCurrentDirectory: () => cwd,
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => ts.sys.newLine,
      };

      // Format diagnostics with color and context (same as tsc)
      const formatted = ts.formatDiagnosticsWithColorAndContext(
        allDiagnostics,
        formatHost
      );

      // Parse formatted output to extract error components
      const lines = formatted.split('\n');
      for (const line of lines) {
        // Remove ANSI color codes
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');

        // TypeScript error format: file(line,column): error TSxxxx: message
        const match = cleanLine.match(
          /^(.+?):(\d+):(\d+)\s+-\s+error\s+(TS\d+):\s+(.+)$/
        );
        if (match && match[1] && match[2] && match[3] && match[4] && match[5]) {
          errors.push({
            file: match[1],
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
            message: `${match[4]}: ${match[5]}`,
          });
        }
      }
    }

    // Check for deprecated symbol usage if enabled
    if (detectDeprecated) {
      // Get TypeChecker only when needed for deprecated detection
      const checker = program.getTypeChecker();
      const deprecationWarnings = checkDeprecatedUsage(
        ts,
        program,
        checker,
        logger
      );

      // Add deprecation warnings to errors
      errors.push(...deprecationWarnings);
    }

    return {
      success: errors.length === 0,
      errors,
      formattedFiles: [],
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    errors.push({
      file: cwd,
      message: `Failed to run TypeScript check: ${error instanceof Error ? error.message : String(error)}`,
    });

    return {
      success: false,
      errors,
      formattedFiles: [],
      duration,
    };
  }
};
