# prettier-max

Minimalist automatic Prettier formatting plugin for Vite

![prettier-max](images/prettier-max-120.png)

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/prettier-max.svg)](https://www.npmjs.com/package/prettier-max)

---

[(Japanese language/日本語はこちら)](./README_ja.md)

## What is this?

prettier-max is a very simple Vite plugin that automatically formats your code with [Prettier](https://prettier.io/) during the build process.
It also includes TypeScript validation to ensure your code is type-safe before building.

ESLint is complex and often throws its own configuration errors.
For those who find basic auto-formatting and TypeScript type checking sufficient, this simple plugin may be useful.

Key features:

- Automatic Prettier formatting on build start
- When using TypeScript, post-formatting TypeScript type checking. Additionally, JSDoc deprecation (`@deprecated`) and default imports can be checked.
- Optional project banner insertion before building
- All fine-tuning is specified in `.prettierrc`, `.prettierignore` and `tsconfig.json`, ensuring consistency
- This is not doing anything unnecessary

---

## Installation

Install in `devDepencencies`:

```bash
npm install -D prettier-max
```

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import prettierMax from 'prettier-max';

export default defineConfig({
  plugins: [
    prettierMax(), // Use default settings
  ],
});
```

If the default behavior is fine, you're all set!

The build works as follows:

1. On build start, the plugin formats all target files
2. If formatting succeeds and TypeScript is enabled (by default), it runs type checking and optional deprecation/default import detection
3. Errors are reported to the console with file paths and line numbers
4. If `failOnError` is `true` (by default), the build stops on any errors

### Prettier resolution

- The plugin always prefers the Prettier installation that lives closest to your Vite project root (monorepo hoists are respected).
- If no project-level copy is available, it falls back to the `prettier` dependency bundled with prettier-max.
- This lets workspace owners pin Prettier versions explicitly, while still keeping a reliable fallback for standalone usage.

### TypeScript availability

- TypeScript validation runs only when TypeScript is available in your project.
- If TypeScript is not installed, the validation step is skipped and a warning is logged.

## Usage

### Configuration options

The options you can specify for prettier-max are as follows:

```typescript
// The plugin options:
prettierMax({
  // Generate .prettierrc (and its variants) and .prettierignore files if they don't exist
  // Default: true
  generatePrettierConfig: true,

  // Fail the build on Prettier formatting or TypeScript errors
  // Default: true
  failOnError: true,

  // Format files on build start
  // Default: true
  formatOnBuild: true,

  // Run TypeScript validation after formatting
  // Default: true
  // Set to a string (or array of strings) to point to specific tsconfig.json files (relative to the project root)
  typescript: true,

  // Detect usage of deprecated symbols marked with `@deprecated` JSDoc tag
  // Default: true
  detectDeprecated: true,

  // Detect default imports/exports to avoid ESM/CJS interop mismatches
  // Options: 'none' | 'exceptType' | 'all'
  // Default: 'none'
  detectDefaultImport: 'none',

  // List of file extensions identifying source code for banner insertion
  // Default: [‘.ts’, ‘.tsx’, ‘.js’, ‘.jsx’]
  bannerExtensions: ['.js', '.jsonc'],
});
```

### Configuration delegations

prettier-max doesn't have any major features that could be described as settings.
They are simply defined by `.prettierrc`, `.prettierignore`, and `tsconfig.json`.

In other words, if you adjust them according to the standard Prettier configuration methods and/or TypeScript compiler configuration methods,
it will work exactly as intended!

prettier-max automatically places templates if `.prettierrc` (and its variants) and `.prettierignore` do not exist.
(It generates them only if the files do NOT exist. If you dislike this behavior, you can suppress it by setting `generatePrettierConfig` to `false`.)

Here, we'll show an example of adding definitions to `.prettierrc` and `tsconfig.json` to manage your project with more powerful formats and checks.
Refer to [Prettier configuration file documentation](https://prettier.io/docs/configuration) and [official TypeScript documentation](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) for each feature.

`.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5"
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    // ... (Another required options)

    "useDefineForClassFields": true,
    "declaration": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Controlling TypeScript Validation

To explicitly disable TypeScript validation, you can optionally specify `typescript: false`.

Specifying a string representing a relative path from the project root allows you to use a specific `tsconfig.json` file.
To specify multiple files, use an array of strings (e.g., `typescript: [‘tsconfig.app.json’, ‘configs/tsconfig.build.json’]`).

By specifying multiple files, you can perform checks even when, for example, your main code and tests are located in different directories or compiled under different conditions.

### Inserting source code banners (headers)

prettier-max has a feature that inserts a “banner” at the beginning of source code immediately before building.
By writing banner text in a `.prettierbanner` file and placing it there, it can be automatically inserted into the source code.

Banner text should be written as:

- Lines starting with `//` or lines containing only whitespace
- Maximum of 20 lines

For example, use the following format:

```typescript
// FooBar converter
// Copyright (c) FooBar Bazo.
```

By default, the target source code files are `*.ts`, `*.tsx`, `*.js`, and `*.jsx`.
However, target source code files are filtered according to `.prettierignore`.

These can be specified using the Vite plugin option `bannerExtensions`.

### Deprecated detection

prettier-max can detect usage of deprecated symbols marked with `@deprecated` JSDoc tags:

```typescript
/**
 * @deprecated Will be removed in future
 */
const olderSuperComponent = () => {
  // ...
};

// PMAX001: 'olderSuperComponent' is deprecated: Will be removed in future
olderSuperComponent();
```

- Reports `PMAX001` errors when deprecated symbols are used
- Deprecated functions calling other deprecated symbols won't generate warnings

You can temporarily suppress this warning by inserting the `@prettier-max-ignore-deprecated` directive in your code:

```typescript
// @prettier-max-ignore-deprecated: Will fix soon
olderSuperComponent();
```

Note that suppressions are logged to the console.

If the directive doesn't suppress any deprecated usage, a `PMAX002` error is reported.
In that case, please remove the unnecessary directive.

Detecting deprecation causes TypeScript to perform detailed analysis.
If detection performance becomes an issue, you can disable it by setting `detectDeprecated: false`.

### Default import detection (Advanced option)

prettier-max can detect default imports/exports to avoid runtime errors caused by ESM/CJS interop mismatches.
This is aimed at cases where the build succeeds, but at runtime `require()` returns a module object and
the generated code tries to access `.default`, resulting in `undefined`.

`detectDefaultImport` accepts the following modes:

- `none` (default): disable default import detection
- `exceptType`: allow `import type` and type-only re-exports
- `all`: report all default imports/exports, including type-only imports
- Reports `PMAX003` errors when default imports/exports are found

#### Example that triggers `PMAX003`

```typescript
// cjs-lib (external package, cannot change)
module.exports = function greet() {
  return 'hi';
};

// app.ts
import greet from 'cjs-lib'; // PMAX003
greet(); // runtime may fail: greet is undefined
```

If you can change the module, prefer named exports:

```typescript
// foo.ts
export class Foo {}

// index.ts
import { Foo } from './foo';
export { Foo };
```

If the default export comes from an external package and cannot be changed,
wrap it once and re-export as a named symbol (no default import):

```typescript
// cjs-lib-wrapper.ts

// Importing a module under an alias (permitted)
import * as cjsLib from 'cjs-lib';

// Resolve it
const greet = (cjsLib as { default?: typeof cjsLib }).default ?? cjsLib;

// Re-export the symbol
export { greet };
```

```typescript
// app.ts
import { greet } from './cjs-lib-wrapper';
greet();
```

Other hand, you can also use helper functions like the following:

```typescript
// Helper function for default import resolution
const resolveDefaultExport = <T>(module: T | { default?: T }): T => {
  return (module as { default?: T }).default ?? (module as T);
};

// Importing a module under an alias (permitted)
import * as cjsLibModule from 'cjs-lib';
const greet = resolveDefaultExport(cjsLibModule);
greet();
```

#### Allow default imports for type definitions

Type-only default imports are allowed in `exceptType`:

```typescript
import type Foo from './foo';
export type FooAlias = Foo;
```

### Log output

Log output adjustments follow Vite's option specifications:

```bash
# Minimal logs (errors only)
vite build --logLevel error

# Detailed logs including debug information
vite build --debug

# Completely disable logs
vite build --logLevel silent
```

You can also use the `DEBUG` environment variable to output debug information by specifying namespaces:

```bash
# prettier-max debugging
DEBUG=vite:plugin:prettier-max vite build
```

---

## Limitations

- If you are not using TypeScript, you cannot perform JSDoc deprecation/default import checks.
- Regarding the "default import detection" feature, prettier-max only performs detection and does not offer any improvement functionality.
  Using the sister project [screw-up](https://github.com/kekyo/screw-up/) allows you to automatically avoid this issue with almost no restrictions.

---

## License

Under MIT.
