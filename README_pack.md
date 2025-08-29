# prettier-max

Minimalist automatic Prettier formatting plugin for Vite

![prettier-max](images/prettier-max-120.png)

[![Project Status: WIP – Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is this?

prettier-max is a very simple Vite plugin that automatically formats your code with [Prettier](https://prettier.io/) during the build process.
It also includes TypeScript validation to ensure your code is type-safe before building.

ESLint is complex and often throws its own configuration errors.
For those who find basic auto-formatting and TypeScript type checking sufficient, this simple plugin may be useful.

Key features:

- Automatic Prettier formatting on build start
- TypeScript type checking after formatting
- All fine-tuning is specified in `.prettierrc` and `tsconfig.json`, ensuring high consistency
- This is not doing anything unnecessary

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
})
```

[See repository document.](https://github.com/kekyo/prettier-max)

---

## License

Under MIT.
