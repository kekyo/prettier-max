// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

/**
 * Default .prettierrc template
 */
export const prettierrcTemplate = {
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
} as const;

/**
 * Default .prettierignore template
 */
export const prettierignoreTemplate = `# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build outputs
dist/
build/
out/
.next/
.nuxt/
*.min.js
*.min.css

# Test results
coverage/
test-results/
*.coverage

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Environment files
.env
.env.local
.env.*.local

# Logs
*.log
logs/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS files
.DS_Store
Thumbs.db

# Temporary files
tmp/
temp/
*.tmp

# Generated files
*.generated.*
generated/
` as const;
