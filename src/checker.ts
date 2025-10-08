// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { spawn } from 'child_process';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
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

  return new Promise(async (resolve) => {
    const errors: PrettierError[] = [];
    const formattedFiles: string[] = [];

    // Build prettier command arguments
    const args = ['--write', '.', '--list-different'];

    if (configPath) {
      args.push('--config', configPath);
    }

    const resolvedBin = await resolvePrettierBin(rootDir);

    if (!resolvedBin) {
      const duration = Date.now() - startTime;
      errors.push({
        file: rootDir,
        message:
          'Unable to locate a Prettier CLI. Install Prettier in the project or rely on the bundled dependency.',
      });
      resolve({
        success: false,
        errors,
        formattedFiles,
        duration,
      });
      return;
    }

    // Execute Prettier CLI via Node to ensure cross-platform
    const prettierProcess = spawn(process.execPath, [resolvedBin, ...args], {
      cwd: rootDir,
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
  const pkg = await resolvePrettierPackageJson(
    preferredRoot ?? process.cwd(),
    preferredRoot ? [process.cwd()] : []
  );
  return pkg?.version;
};

/**
 * Resolve Prettier CLI bin path.
 * Priority: project local -> hoisted/monorepo -> plugin's own dependency.
 */
const resolvePrettierBin = async (
  rootDir: string,
  additionalRoots: string[] = []
): Promise<string | undefined> => {
  const resolved = await resolvePrettierPackage(rootDir, additionalRoots);
  if (!resolved) {
    return undefined;
  }

  const { bin } = resolved.pkg;
  let binRel: string | undefined;
  if (typeof bin === 'string') {
    binRel = bin;
  } else if (bin && typeof bin === 'object') {
    binRel = bin['prettier'];
  }

  if (!binRel) {
    binRel = join('bin', 'prettier.cjs');
  }

  return join(resolved.pkgDir, binRel);
};

const resolvePrettierPackageJson = async (
  rootDir: string,
  additionalRoots: string[] = []
): Promise<{ version: string } | undefined> => {
  const resolved = await resolvePrettierPackage(rootDir, additionalRoots);
  if (!resolved) {
    return undefined;
  }
  const { version } = resolved.pkg;
  return version ? { version } : undefined;
};

const buildPrettierSearchPaths = (
  rootDir: string,
  additionalRoots: string[] = []
): string[] => {
  const paths = [
    rootDir,
    ...additionalRoots,
    process.cwd(),
    getThisModuleDir(),
  ];
  return Array.from(new Set(paths));
};

const getThisModuleDir = (): string => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    // Fallback for environments where import.meta.url is not available
    return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
};

type PrettierPackageInfo = {
  pkgPath: string;
  pkgDir: string;
  pkg: {
    version?: string;
    bin?: string | { [name: string]: string };
  };
};

const resolvePrettierPackage = async (
  rootDir: string,
  additionalRoots: string[]
): Promise<PrettierPackageInfo | undefined> => {
  const pkgPath = findPrettierPackageJsonPath(rootDir, additionalRoots);
  if (!pkgPath) {
    return undefined;
  }

  const pkgDir = dirname(pkgPath);
  const pkg = JSON.parse(
    await readFile(pkgPath, 'utf-8')
  ) as PrettierPackageInfo['pkg'];
  return { pkgPath, pkgDir, pkg };
};

const findPrettierPackageJsonPath = (
  rootDir: string,
  additionalRoots: string[]
): string | undefined => {
  const searchRoots = buildPrettierSearchPaths(rootDir, additionalRoots);
  const visited = new Set<string>();

  for (const root of searchRoots) {
    let current = resolve(root);

    while (true) {
      if (visited.has(current)) {
        break;
      }
      visited.add(current);

      const candidate = join(
        current,
        'node_modules',
        'prettier',
        'package.json'
      );

      if (existsSync(candidate)) {
        return candidate;
      }

      const parent = dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return undefined;
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
      const handleSymbolUsage = (
        symbol: import('typescript').Symbol | undefined,
        locationNode: import('typescript').Node
      ): void => {
        if (!symbol) {
          return;
        }

        const resolvedSymbol = symbol;

        const displayName =
          typeof symbol.getName === 'function'
            ? symbol.getName()
            : resolvedSymbol.getName();

        const sourceFile = locationNode.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          locationNode.getStart()
        );
        const locationKey = `${sourceFile.fileName}:${line + 1}:${displayName}`;

        if (checkedLocations.has(locationKey)) {
          return;
        }
        checkedLocations.add(locationKey);

        const maybeAddWarning = (messageSuffix?: string): void => {
          const actualLine = line + 1;
          const isSuppressed =
            suppressedLines.get(sourceFile.fileName)?.has(actualLine) || false;

          if (isSuppressed) {
            usedSuppressions.add(`${sourceFile.fileName}:${actualLine}`);
            if (logger) {
              logger.info(
                `Suppressed deprecated warning for '${displayName}' at ${sourceFile.fileName}:${actualLine}`
              );
            }
            return;
          }

          const message = `PMAX001: '${displayName}' is deprecated${
            messageSuffix ? `: ${messageSuffix}` : ''
          }`;

          // Avoid duplicate warnings at the same location with identical message
          const alreadyAdded = deprecationWarnings.some(
            (warning) =>
              warning.file === sourceFile.fileName &&
              warning.line === actualLine &&
              warning.message === message
          );

          if (!alreadyAdded) {
            deprecationWarnings.push({
              file: sourceFile.fileName,
              line: actualLine,
              column: character + 1,
              message,
            });
          }
        };

        const deprecationMessage = getDeprecationMessage(resolvedSymbol);
        const hasJsDocMessage = deprecationMessage !== undefined;
        if (hasJsDocMessage) {
          maybeAddWarning(deprecationMessage);
        }

        if (resolvedSymbol.valueDeclaration) {
          const modifierFlags = ts.getCombinedModifierFlags(
            resolvedSymbol.valueDeclaration as import('typescript').Declaration
          );
          if (modifierFlags & ts.ModifierFlags.Deprecated) {
            if (!hasJsDocMessage) {
              maybeAddWarning();
            }
          }
        }
      };

      const getJsxAttributeSymbol = (
        element: import('typescript').JsxOpeningLikeElement,
        attribute: import('typescript').JsxAttribute
      ): import('typescript').Symbol | undefined => {
        const attributeName = attribute.name.getText();
        const directSymbol = checker.getSymbolAtLocation(attribute.name);

        const needsTypeLookup = (): boolean => {
          if (!directSymbol) {
            return true;
          }
          try {
            const declarations = directSymbol.getDeclarations() ?? [];
            if (declarations.length === 0) {
              return true;
            }
            return declarations.every((decl) => ts.isJsxAttribute(decl));
          } catch {
            return true;
          }
        };

        if (directSymbol && !needsTypeLookup()) {
          return directSymbol;
        }

        try {
          const attributesType = checker.getTypeAtLocation(element.attributes);
          if (!attributesType) {
            return directSymbol;
          }

          const apparent = checker.getApparentType(attributesType);
          const propSymbol = checker.getPropertyOfType(apparent, attributeName);
          if (propSymbol) {
            return propSymbol;
          }
        } catch {
          // ignore type lookup failures
        }

        const resolvePropsType = (): import('typescript').Type | undefined => {
          try {
            const tagSymbol = checker.getSymbolAtLocation(element.tagName);
            if (!tagSymbol) {
              return undefined;
            }

            let resolvedTagSymbol = tagSymbol;
            if (resolvedTagSymbol.flags & ts.SymbolFlags.Alias) {
              resolvedTagSymbol = checker.getAliasedSymbol(resolvedTagSymbol);
            }

            const tagType = checker.getTypeOfSymbolAtLocation(
              resolvedTagSymbol,
              element.tagName
            );

            const extractPropsFromSignatures = (
              signatures: readonly import('typescript').Signature[]
            ): import('typescript').Type | undefined => {
              for (const signature of signatures) {
                const parameters = signature.getParameters();
                if (parameters.length === 0) {
                  continue;
                }
                const propsParam = parameters[0];
                if (!propsParam) {
                  continue;
                }
                const propsType = checker.getTypeOfSymbolAtLocation(
                  propsParam,
                  element.tagName
                );
                if (propsType) {
                  return propsType;
                }
              }
              return undefined;
            };

            const callProps = extractPropsFromSignatures(
              checker.getSignaturesOfType(tagType, ts.SignatureKind.Call)
            );
            if (callProps) {
              return callProps;
            }

            const constructProps = extractPropsFromSignatures(
              checker.getSignaturesOfType(tagType, ts.SignatureKind.Construct)
            );
            if (constructProps) {
              return constructProps;
            }
          } catch {
            // ignore resolution issues
          }
          return undefined;
        };

        const propsType = resolvePropsType();
        if (propsType) {
          try {
            const propSymbol = checker.getPropertyOfType(
              propsType,
              attributeName
            );
            if (propSymbol) {
              return propSymbol;
            }
          } catch {
            // ignore errors when reading component props
          }
        }

        return directSymbol;
      };

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

      // Helper: detect if this node has any leading/trailing comment with @deprecated
      const hasDeprecatedAdjacentComment = (
        n: import('typescript').Node
      ): boolean => {
        try {
          const leading = ts.getLeadingCommentRanges(
            sourceText,
            n.getFullStart()
          );
          if (leading) {
            for (const c of leading) {
              const text = sourceText.substring(c.pos, c.end);
              if (/@deprecated\b/.test(text)) {
                return true;
              }
            }
          }
          const trailing = ts.getTrailingCommentRanges(sourceText, n.getEnd());
          if (trailing) {
            for (const c of trailing) {
              const text = sourceText.substring(c.pos, c.end);
              if (/@deprecated\b/.test(text)) {
                return true;
              }
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
        if (
          (ts.isJsxOpeningLikeElement(node.parent) &&
            node.parent.tagName === node) ||
          (ts.isJsxAttribute(node.parent) && node.parent.name === node)
        ) {
          // Handled explicitly in JSX logic below
          symbolToCheck = undefined;
        } else {
          // Skip if this is a declaration name (not a usage)
          const parent = node.parent;
          if (
            parent &&
            ((ts.isClassDeclaration(parent) && parent.name === node) ||
              (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
              (ts.isFunctionDeclaration(parent) && parent.name === node) ||
              (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
              (ts.isEnumDeclaration(parent) && parent.name === node) ||
              (ts.isPropertySignature(parent) && parent.name === node) ||
              (ts.isPropertyDeclaration(parent) && parent.name === node) ||
              (ts.isMethodSignature(parent) && parent.name === node) ||
              (ts.isMethodDeclaration(parent) && parent.name === node) ||
              (ts.isPropertyAccessExpression(parent) && parent.name === node))
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
        }
      } else if (ts.isPropertyAccessExpression(node)) {
        if (
          ts.isJsxOpeningLikeElement(node.parent) &&
          node.parent.tagName === node
        ) {
          symbolToCheck = undefined;
        } else if (
          (ts.isCallExpression(node.parent) ||
            ts.isNewExpression(node.parent)) &&
          node.parent.expression === node
        ) {
          // The enclosing call/new expression will handle the symbol lookup
          symbolToCheck = undefined;
        } else {
          // Property access (obj.prop)
          symbolToCheck = checker.getSymbolAtLocation(node);
        }
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
        if (hasDeprecatedAdjacentComment(node)) {
          return; // Suppress deprecated exports scoped by inline comments
        }
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
        handleSymbolUsage(symbolToCheck, nodeToReport);
      }

      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        handleSymbolUsage(
          checker.getSymbolAtLocation(node.tagName),
          node.tagName
        );

        for (const attribute of node.attributes.properties) {
          if (ts.isJsxAttribute(attribute)) {
            const attrSymbol = getJsxAttributeSymbol(node, attribute);
            handleSymbolUsage(attrSymbol, attribute.name);
          } else if (ts.isJsxSpreadAttribute(attribute)) {
            handleSymbolUsage(
              checker.getSymbolAtLocation(attribute.expression),
              attribute.expression
            );
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
  logger?: Logger,
  configPath?: string
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
    let configFileName = configPath;
    if (configFileName) {
      if (!ts.sys.fileExists(configFileName)) {
        return {
          success: false,
          errors: [
            {
              file: configFileName,
              message: 'Provided tsconfig.json was not found',
            },
          ],
          formattedFiles: [],
          duration: Date.now() - startTime,
        };
      }
    } else {
      configFileName = ts.findConfigFile(
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
