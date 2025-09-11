# prettier-max

Minimalist automatic Prettier formatting plugin for Vite

![prettier-max](images/prettier-max-120.png)

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/prettier-max.svg)](https://www.npmjs.com/package/prettier-max)

---

[(日本語はこちら)](./README_ja.md)

## What is this?

prettier-max is a very simple Vite plugin that automatically formats your code with [Prettier](https://prettier.io/) during the build process.
It also includes TypeScript validation to ensure your code is type-safe before building.

ESLint is complex and often throws its own configuration errors.
For those who find basic auto-formatting and TypeScript type checking sufficient, this simple plugin may be useful.

Key features:

- Automatic Prettier formatting on build start
- TypeScript type checking after formatting, with JSDoc deprecated (`@deprecated`) detection
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
2. If formatting succeeds and TypeScript is enabled (by default), it runs type checking and detecting deprecation
3. Errors are reported to the console with file paths and line numbers
4. If `failOnError` is `true` (by default), the build stops on any errors

## Usage

### Configuration options

The options you can specify for prettier-max are as follows:

```typescript
// The plugin options:
prettierMax({
  // Generate .prettierrc and .prettierignore files if they don't exist
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
  typescript: true,

  // Detect usage of deprecated symbols marked with @deprecated JSDoc tag
  // Default: true
  detectDeprecated: true,
});
```

### Configuration delegations

prettier-max doesn't have any major features that could be described as settings.
They are simply defined by `.prettierrc`, `.prettierignore`, and `tsconfig.json`.

In other words, if you adjust them according to the standard Prettier configuration methods and/or TypeScript compiler configuration methods,
it will work exactly as intended!

prettier-max automatically places templates if `.prettierrc` and `.prettierignore` do not exist.
(It generates them only if the files do NOT exist. If you dislike this behavior, you can suppress it by setting `generatePrettierConfig` to `false`.)

Here, we'll show an example of adding definitions to `.prettierrc` and `tsconfig.json` to manage your project with more powerful formats and checks. Refer to [Prettier configuration file documentation](https://prettier.io/docs/configuration) and [official TypeScript documentation](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) for each feature.

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

## License

Under MIT.
