# prettier-max

Minimalist automatic Prettier formatting plugin for Vite

![prettier-max](images/prettier-max-120.png)

[![Project Status: WIP – Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/prettier-max.svg)](https://www.npmjs.com/package/prettier-max)

---

## What is this?

prettier-max is a simple Vite plugin that automatically formats your code with [Prettier](https://prettier.io/) during the build process.
It also includes TypeScript validation to ensure your code is type-safe before building.

ESLint is complex and often throws its own configuration errors.
For those who find basic auto-formatting and TypeScript type checking sufficient, this simple plugin may be useful.

Key features:

- Automatic Prettier formatting on build start
- TypeScript type checking after formatting
- Customizable file targets with gitignore-style patterns
- Support for .prettierignore files

## Installation

```bash
npm install --save-dev prettier-max
```

---

## Usage

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

### Configuration options

The options you can specify for prettier-max are as follows:

```typescript
// The plugin options:
prettierMax({
  // Target files to format (gitignore syntax)
  // Default: uses .prettierignore patterns
  targets: ['src/**/*.{ts,tsx,js,jsx}', '!dist/**'],

  // Path to prettier config file
  // Default: uses prettier's config resolution
  configPath: '.prettierrc',

  // Format files on build start
  // Default: true
  formatOnBuild: true,

  // Fail the build on formatting or TypeScript errors
  // Default: false
  failOnError: true,

  // Run TypeScript validation after formatting
  // Default: true
  typescript: true,
});
```

### Configuration delegations

prettier-max doesn't have any major features that could be described as settings.
They are simply defined by `.prettierrc`, `.prettierignore`, and `tsconfig.json`.

In other words, if you adjust them according
to the standard Prettier configuration methods or TypeScript compiler configuration methods,
it will work exactly as intended!

Here, we'll show an example of adding definitions to `.prettierrc` and `tsconfig.json` to manage your project with more powerful formats and checks. Refer to [Prettier configuration file documentation](https://prettier.io/docs/configuration) and [official TypeScript documentation](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) for each feature:

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

### Target Patterns

When `targets` is specified, the plugin uses gitignore-style patterns:

- `src/**/*.ts` - All TypeScript files in src
- `!dist/**` - Exclude dist directory
- `*.config.{js,ts}` - Config files

When `targets` is not specified, the plugin automatically uses `.prettierignore` and `.gitignore` patterns.

### Build Behavior

1. On build start, the plugin formats all target files
2. If formatting succeeds and TypeScript is enabled, it runs type checking
3. Errors are reported to the console with file paths and line numbers
4. If `failOnError` is true, the build stops on any errors

---

## License

Under MIT.
