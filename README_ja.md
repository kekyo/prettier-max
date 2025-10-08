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
- TypeScriptを使用している場合は、フォーマッティング後のTypeScript型チェック。更にJSDocの非推奨(`@deprecated`)もチェック可能
- 定型バナーをビルド前に挿入可能
- すべての設定調整は、`.prettierrc`、`.prettierignore`、`tsconfig.json`で指定され、一貫性を確保
- 余計なことは一切行いません

---

## インストール

`devDepencencies`に追加します:

```bash
npm install -D prettier-max
```

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

ビルドは次のように動作します:

1. ビルド開始時に、プラグインはすべての対象ファイルをフォーマット
2. フォーマッティングが成功し、TypeScriptが有効（デフォルト）な場合、型チェックと非推奨検出を実行
3. エラーはファイルパスと行番号と共にコンソールに報告される
4. `failOnError` が `true` （デフォルト）の場合、エラーがあるとビルドが停止

### Prettier の解決方法

- プラグインは、Vite プロジェクトのルートに最も近い `node_modules` にある Prettier を優先して使用します（モノレポで上位ディレクトリに配置された場合も検出されます）。
- プロジェクト内で Prettier が見つからない場合は、`prettier-max` が依存として同梱している Prettier をフォールバックとして使用します。
- これにより、ワークスペース利用者は任意のバージョンを固定しつつ、単体利用時でも確実にフォーマット処理を実行できます。

### TypeScript の有無について

- TypeScript 検証は、プロジェクトに TypeScript が導入されている場合にのみ実行されます。
- TypeScript が未インストールの場合、検証はスキップされ、警告が表示されます。
- 明示的に無効化したい場合は、オプションで `typescript: false` を指定できます。
- プロジェクトルートからの相対パスを文字列で指定すると、特定の `tsconfig.json` を使用できます（例: `typescript: 'configs/tsconfig.build.json'`）。

## 使用方法

### 設定オプション

prettier-maxに指定できるオプションは以下の通りです：

```typescript
// プラグインオプション：
prettierMax({
  // .prettierrc(及びその亜種)と.prettierignoreファイルが存在しない場合に生成
  // デフォルト: true
  generatePrettierConfig: true,

  // PrettierフォーマッティングまたはTypeScriptエラーでビルドを失敗させる
  // デフォルト: true
  failOnError: true,

  // ビルド開始時にファイルをフォーマット
  // デフォルト: true
  formatOnBuild: true,

  // フォーマッティング後にTypeScript検証を実行する
  // デフォルト: true
  // 文字列を指定すると、プロジェクトルートからの相対パスとして特定の tsconfig.json を利用
  typescript: true,

  // `@deprecated` JSDocタグでマークされた非推奨シンボルの使用を検出
  // デフォルト: true
  detectDeprecated: true,

  // バナー挿入対象のソースコードを識別する拡張子のリスト
  // デフォルト: ['.ts', '.tsx', '.js', '.jsx']
  bannerExtensions: ['.js', '.jsonc'],
});
```

### 設定の委譲

prettier-maxには、主要な機能設定がありません。
それらは単に`.prettierrc`, `.prettierignore`および`tsconfig.json`によって定義されます。

つまり、標準的なPrettierの設定方法やTypeScriptコンパイラの設定方法に従って調整すれば、意図した通りに動作します！

prettier-maxは、`.prettierrc`(及びその亜種)と`.prettierignore`が存在しなければ、雛形を自動的に配置します。
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

### ソースコードバナー（ヘッダ）挿入

prettier-maxはビルド直前に、ソースコードの先頭部分に「バナー」を挿入する機能があります。
`.prettierbanner` ファイルにバナーテキストを記述して配置することで、ソースコードに自動的に挿入出来ます。

バナーテキストは:

- `//`で始まる行、又はホワイトスペースのみの行
- 最大20行まで

で記述して下さい。例えば、以下のような形式です:

```typescript
// FooBar converter
// Copyright (c) FooBar Bazo.
```

挿入対象のソースコードファイルは、デフォルトで `*.ts`, `*.tsx`, `*.js`, `*.jsx` が対象です。
但し、`.prettierignore` に従って対象ソースコードファイルがフィルタされます。

これらはViteプラグインオプション `bannerExtensions` で指定可能です。

### 非推奨の検出

prettier-maxは `@deprecated` JSDocタグでマークされた非推奨シンボルの使用を検出できます：

```typescript
/**
 * @deprecated 将来削除予定
 */
const olderSuperComponent = () => {
  // ...
};

// PMAX001: 'olderSuperComponent' is deprecated: 将来削除予定
olderSuperComponent();
```

- 非推奨シンボルが使用されると、 `PMAX001` エラーが報告されます
- 非推奨関数が他の非推奨シンボルを呼び出しても警告されません

`@prettier-max-ignore-deprecated` ディレクティブをコード上に挿入することで、この警告を一時的に抑制できます:

```typescript
// @prettier-max-ignore-deprecated: 近日中に修正予定
olderSuperComponent();
```

但し、抑制されたことが通常ログで出力されます。

このディレクティブが非推奨シンボルを抑制していない場合は、 `PMAX002` エラーが報告されます。
その場合は、ディレクティブを削除して下さい。

非推奨の検出は、TypeScriptに詳細解析を行わせます。もし、検出速度が問題になる場合は、 `detectDeprecated: false` でこれを無効化できます。

### ログ出力

ログ出力の調整はViteのオプション指定に準じます:

```bash
# 最小限のログ（エラーのみ）
vite build --logLevel error

# デバッグ情報を含む詳細ログ
vite build --debug

# ログを完全に無効化
vite build --logLevel silent
```

または`DEBUG`環境変数で、名前空間を指定してデバッグ情報の出力を行わせることが出来ます:

```bash
# prettier-maxのデバッグ
DEBUG=vite:plugin:prettier-max vite build
```

---

## 制限

TypeScriptを使用していない場合は、JSDocの非推奨チェックを行うことは出来ません。

---

## ライセンス

Under MIT.
