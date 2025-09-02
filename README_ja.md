# prettier-max

ミニマリスト向けの、Prettier自動フォーマッティングViteプラグイン

![prettier-max](images/prettier-max-120.png)

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/prettier-max.svg)](https://www.npmjs.com/package/prettier-max)

---

[(English is here)](./README.md)

## これは何？

prettier-maxは、ビルドプロセス中に[Prettier](https://prettier.io/)を使用してコードを自動的にフォーマットする非常にシンプルなViteプラグインです。
また、ビルド前にコードがタイプセーフであることを確認するTypeScript検証も含まれています。

ESLintは複雑で、しばしば独自の設定エラーを起こします。
基本的な自動フォーマッティングとTypeScriptの型チェックで十分だと感じている方には、このシンプルなプラグインが役立つかもしれません。

主な機能：

- ビルド開始時に、自動的にPrettierでフォーマッティング
- フォーマッティング後のTypeScript型チェック
- すべての設定調整は、`.prettierrc`、`.prettierignore`、`tsconfig.json`で指定され、一貫性を確保
- 余計なことは一切行いません

---

## インストール

```bash
npm install --save-dev prettier-max
```

## 使用方法

`vite.config.ts`にプラグインを追加します：

```typescript
import { defineConfig } from 'vite';
import prettierMax from 'prettier-max';

export default defineConfig({
  plugins: [
    prettierMax(), // デフォルト設定を使用
  ],
});
```

デフォルト動作で問題なければ、これで完了です！

### 設定オプション

prettier-maxに指定できるオプションは以下の通りです：

```typescript
// プラグインオプション：
prettierMax({
  // prettierの設定ファイルへのパス
  // デフォルト: (prettierの自動認識)
  configPath: '.prettierrc',

  // ビルド開始時にファイルをフォーマット
  // デフォルト: true
  formatOnBuild: true,

  // フォーマッティング後にTypeScript検証を実行
  // デフォルト: true
  typescript: true,

  // フォーマッティングまたはTypeScriptエラーでビルドを失敗させる
  // デフォルト: true
  failOnError: true,

  // .prettierrcと.prettierignoreファイルが存在しない場合に生成
  // デフォルト: true
  generatePrettierConfig: true,
});
```

### 設定の委譲

prettier-maxには、主要な機能設定がありません。
それらは単に`.prettierrc`, `.prettierignore`および`tsconfig.json`によって定義されます。

つまり、標準的なPrettierの設定方法やTypeScriptコンパイラの設定方法に従って調整すれば、意図した通りに動作します！

prettier-maxは、`.prettierrc`と`.prettierignore`が存在しなければ、雛形を自動的に配置します。
（ファイルが存在しない場合のみ生成します。それも気に入らなければ、`generatePrettierConfig`を`false`にすることで抑止できます）

ここでは、より強力なフォーマットとチェックをプロジェクトに適用する、`.prettierrc`と`tsconfig.json`の例を示します。各機能については、[Prettier設定ファイルのドキュメント](https://prettier.io/docs/configuration)と[TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html)を参照してください。

`.prettierrc`：

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5"
}
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    // ... （その他の必要なオプション）

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

### ビルド動作

1. ビルド開始時に、プラグインはすべての対象ファイルをフォーマット
2. フォーマッティングが成功し、TypeScriptが有効な場合、型チェックを実行
3. エラーはファイルパスと行番号と共にコンソールに報告される
4. `failOnError`がtrueの場合、エラーがあるとビルドが停止

---

## ライセンス

Under MIT.
