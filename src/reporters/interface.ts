// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import type { PrettierError, ErrorReporter } from '../types.js';

/**
 * Base abstract class for error reporters
 */
export abstract class BaseErrorReporter implements ErrorReporter {
  protected errors: PrettierError[] = [];

  abstract report(errors: PrettierError[]): void;
  abstract clear(): void;
}

/**
 * Re-export interface for convenience
 */
export type { ErrorReporter, PrettierError } from '../types.js';
