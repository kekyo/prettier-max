// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import * as ts from 'typescript';
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

    const prettierProcess = spawn('npx', ['prettier', ...args], {
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
export const getPrettierVersion = async (): Promise<string | undefined> => {
  return new Promise((resolve) => {
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
 * Check if TypeScript is available and get its version
 */
export const getTypeScriptVersion = async (): Promise<string | undefined> => {
  try {
    // Return the version from TypeScript API directly
    return ts.version;
  } catch {
    return undefined;
  }
};

/**
 * Check for deprecated symbol usage in TypeScript code
 */
const checkDeprecatedUsage = (
  program: ts.Program,
  checker: ts.TypeChecker,
  logger?: Logger
): PrettierError[] => {
  const deprecationWarnings: PrettierError[] = [];
  const checkedLocations = new Set<string>(); // "filename:line:column" format
  const suppressedLines = new Map<string, Set<number>>(); // filename -> line numbers
  const usedSuppressions = new Set<string>(); // "filename:line" format

  // Helper function to get deprecation message from JSDoc tags
  const getDeprecationMessage = (symbol: ts.Symbol): string | undefined => {
    try {
      const jsdocTags = symbol.getJsDocTags(checker);
      const deprecatedTag = jsdocTags.find(tag => tag.name === 'deprecated');
      if (deprecatedTag && deprecatedTag.text) {
        return deprecatedTag.text.map(part => part.text).join('');
      }
    } catch {
      // Ignore errors when getting JSDoc tags
    }
    return undefined;
  };

  // Visit each source file
  for (const sourceFile of program.getSourceFiles()) {
    // Skip node_modules and declaration files
    if (sourceFile.fileName.includes('node_modules') || sourceFile.isDeclarationFile) {
      continue;
    }

    // Check for suppression directives in comments
    const sourceText = sourceFile.getFullText();
    const processedComments = new Set<number>(); // Track processed comments by position
    
    // Process all comments in the file to find suppression directives
    ts.forEachChild(sourceFile, function processNode(node: ts.Node): void {
      const nodeStart = node.getFullStart();
      const leadingComments = ts.getLeadingCommentRanges(sourceText, nodeStart) || [];
      
      for (const comment of leadingComments) {
        // Skip if we've already processed this comment
        if (processedComments.has(comment.pos)) {
          continue;
        }
        processedComments.add(comment.pos);
        
        const commentText = sourceText.substring(comment.pos, comment.end);
        // Check for @prettier-max-ignore-deprecated directive
        const match = commentText.match(/@prettier-max-ignore-deprecated(?::?\s*(.*))?$/m);
        if (match) {
          const { line: commentLine } = sourceFile.getLineAndCharacterOfPosition(comment.pos);
          const nextLine = commentLine + 2; // +1 for 0-based, +1 for next line
          
          if (!suppressedLines.has(sourceFile.fileName)) {
            suppressedLines.set(sourceFile.fileName, new Set());
          }
          suppressedLines.get(sourceFile.fileName)!.add(nextLine);
          
          if (logger) {
            const note = match[1] ? `: ${match[1].trim()}` : '';
            logger.debug(`Found suppression directive at ${sourceFile.fileName}:${commentLine + 1}${note}`);
          }
        }
      }
      
      ts.forEachChild(node, processNode);
    });

    // Walk the AST to find deprecated usage
    const visit = (node: ts.Node): void => {
      // Check if this is a function-like node that is deprecated
      // If so, skip checking its body
      if (ts.isFunctionDeclaration(node) || 
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isMethodDeclaration(node) ||
          ts.isConstructorDeclaration(node)) {
        
        let funcSymbol: ts.Symbol | undefined;
        
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
        } else if ((ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && 
                   node.parent && ts.isVariableDeclaration(node.parent) && 
                   ts.isIdentifier(node.parent.name)) {
          // For arrow functions and function expressions, check the variable declaration
          funcSymbol = checker.getSymbolAtLocation(node.parent.name);
        }
        
        // If this function is deprecated, skip checking its body
        if (funcSymbol && getDeprecationMessage(funcSymbol) !== undefined) {
          return; // Early return - don't check descendants
        }
      }

      let symbolToCheck: ts.Symbol | undefined;
      let nodeToReport = node;

      // Determine which symbol to check based on node type
      if (ts.isIdentifier(node)) {
        // Skip if this is a declaration name (not a usage)
        const parent = node.parent;
        if (parent && (
          (ts.isClassDeclaration(parent) && parent.name === node) ||
          (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
          (ts.isFunctionDeclaration(parent) && parent.name === node) ||
          (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
          (ts.isEnumDeclaration(parent) && parent.name === node)
        )) {
          return; // Skip declarations
        }
        
        // For variable declarations, only skip if it's not an initializer referencing a deprecated symbol
        if (parent && ts.isVariableDeclaration(parent) && parent.name === node) {
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
          const isSuppressed = suppressedLines.get(sourceFile.fileName)?.has(actualLine) || false;
          
          if (isSuppressed) {
            // Mark this suppression as used
            usedSuppressions.add(`${sourceFile.fileName}:${actualLine}`);
            if (logger) {
              logger.debug(`Suppressed deprecated warning for '${symbolToCheck.getName()}' at ${sourceFile.fileName}:${actualLine}`);
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
          const modifierFlags = ts.getCombinedModifierFlags(symbolToCheck.valueDeclaration as ts.Declaration);
          if (modifierFlags & ts.ModifierFlags.Deprecated) {
            const actualLine = line + 1;

            // Check if this line is suppressed
            const isSuppressed = suppressedLines.get(sourceFile.fileName)?.has(actualLine) || false;
            
            // Only add if not already added by JSDoc check and not suppressed
            const alreadyAdded = deprecationWarnings.some(
              w => w.file === sourceFile.fileName && 
                   w.line === actualLine && 
                   w.column === character + 1
            );
            
            const alreadySuppressed = usedSuppressions.has(`${sourceFile.fileName}:${actualLine}`);

            if (!alreadyAdded && !alreadySuppressed) {
              if (isSuppressed) {
                // Mark this suppression as used
                usedSuppressions.add(`${sourceFile.fileName}:${actualLine}`);
                if (logger) {
                  logger.debug(`Suppressed deprecated warning for '${symbolToCheck.getName()}' at ${sourceFile.fileName}:${actualLine}`);
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
      const formatHost: ts.FormatDiagnosticsHost = {
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
      const deprecationWarnings = checkDeprecatedUsage(program, checker, logger);
      
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
