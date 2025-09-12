# prettier-max

Minimalist automatic Prettier formatting plugin for Vite

![prettier-max](images/prettier-max-120.png)

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is this?

prettier-max is a very simple Vite plugin that automatically formats your code with [Prettier](https://prettier.io/) during the build process.
It also includes TypeScript validation to ensure your code is type-safe before building.

ESLint is complex and often throws its own configuration errors.
For those who find basic auto-formatting and TypeScript type checking sufficient, this simple plugin may be useful.

Key features:

- Automatic Prettier formatting on build start
- When using TypeScript, post-formatting TypeScript type checking. Additionally, JSDoc deprecation (`@deprecated`) can also be checked.
- All fine-tuning is specified in `.prettierrc` and `tsconfig.json`, ensuring high consistency
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

### TypeScript availability

- TypeScript validation runs only when TypeScript is available in your project.
- If TypeScript is not installed, the validation step is skipped and a warning is logged.
- You can also explicitly disable it with the `typescript: false` option.

Other features, [see repository document.](https://github.com/kekyo/prettier-max)

---

## License

Under MIT.
