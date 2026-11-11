# Lean 対訳ブラウザ（side-by-side-lean-natural）

Lean 4 のソースを宣言ごとに区切り、それぞれを指定した言語の数学的な文章に訳して横に並べるブラウザです。Lean のビルドは要りません。ソースを読むだけで動きます。

![Length.lean の対訳表示](docs/screenshot.png)

[English summary](#english)

## できること

- GitHub の URL（private リポジトリも可）、ZIP、フォルダから Lean 4 のリポジトリを開く
- 宣言（`def`、`theorem`、`structure` など）ごとに、Lean のコードと訳を並べて表示する。訳す言語は日本語、英語、中国語などから選べて、自由入力もできる
- 訳すとき、import 先で定義されていて対象ファイルが参照しているものを、文脈として一緒に渡す
- 識別子をタップすると定義の要約を表示し、定義元へ移動できる。`∀`、`omega`、`rcases` などの記号やタクティクには短い解説が出る
- 長い証明は最初たたんで表示する
- 訳はブラウザに保存する。書き出してリポジトリに同梱すれば、開いた人は API キーなしで訳を読める
- ファイルや宣言を直接開く共有リンクを作れる

## 使い方

### Web 版（Cloudflare Pages）

1. GitHub の URL を入れて「開く」を押す
2. 「設定」で Anthropic API キーを入れる（翻訳に必要）。private リポジトリなら GitHub トークンも入れる
3. 「このファイルを訳す」、または各ブロックの「訳す」を押す

URL を入れずに開くと、デモ（[python-formalization](https://github.com/Broyojo/python-formalization) の `range` の長さを扱う部分。日本語訳つき）が表示されます。

### claude.ai 版

`dist/claude-artifact.html` を claude.ai のアーティファクトとして公開すると、閲覧した人それぞれの Claude アカウントで翻訳します（API キー不要）。ただし claude.ai の中のページからは GitHub に接続できないので、GitHub の「Code → Download ZIP」で取得した ZIP を「ZIP を開く」で読み込みます。

### 共有リンク

Web 版で GitHub から開いている間は、アドレスバーの URL がそのまま共有リンクになります。各ブロック右上の行番号（`L16–17` など）を押すと、その宣言へのリンクをコピーできます。

| パラメータ | 意味 |
|---|---|
| `repo` | `owner/repo` |
| `ref` | ブランチ、タグ、コミット（省略時は既定のブランチ） |
| `path` | 開くファイル |
| `decl` | スクロールする宣言の名前（名前のないブロックは `id=b12` の形） |
| `lang` | 訳す言語 |

例: `?repo=Broyojo/python-formalization&path=lean/PyLean/RangeSlice/Length.lean&decl=slow_isLen&lang=日本語`

### 訳をリポジトリに同梱する

1. 訳したいファイルを訳す
2. 「設定」→「訳をエクスポート」で JSON を取り出す（いま開いているリポジトリの分だけが出ます）
3. 対象リポジトリに `.lean-taiyaku/ja.json` としてコミットする（言語ごとに 1 ファイル。名前は自由）

リポジトリを開くと `.lean-taiyaku/*.json` を自動で読み込みます。同じブロックに手元で付けた訳があれば、そちらが優先されます。訳の照合には「言語・詳しさ・ファイルパスとブロック本文のハッシュ」を使うので、コードが変わったブロックの古い訳は自動的に使われなくなります。

## キーとデータの扱い

- API キーと GitHub トークンはブラウザの中だけで使います。「このブラウザに保存する」を選んだときだけ localStorage に保存します。共用の PC では保存しないでください。
- ページが通信する先は `api.github.com` と `api.anthropic.com` だけです。Web 版では `public/_headers` の Content-Security-Policy でこれを固定しているので、ブラウザはそれ以外への送信を拒否します。インラインスクリプトもハッシュで固定しています。
- 翻訳するとき、対象ファイルと参照している定義の Lean ソースを Anthropic に送ります。private なコードを訳すときは、所属組織の方針を確認してください。
- GitHub トークンは fine-grained personal access token をおすすめします。対象のリポジトリだけを選び、権限は Contents: Read-only にしてください。

## 仕組みと限界

- 分割は、トップレベルのキーワードと、コメント・文字列の内外を見て行う静的な処理です。Lean を実行しないので、型情報、記法やマクロの展開、タクティクの途中のゴールは使っていません。
- 文脈は、import を最大 3 段・30 ファイルまでたどり、名前が一致する定義を拾います。同名の定義が多すぎる短い名前は除外します。
- 訳は LLM によるもので、誤りがありえます。コードと照らして読んでください。
- `mutual` ブロックの中やマクロが生成する宣言は、うまく分割できないことがあります。

## 開発

```sh
python3 tools/build.py             # src/ と demo/ から public/ と dist/ を生成
node --test "test/*.test.cjs"      # 分割・文脈収集・返答の解析のテスト
python3 -m http.server -d public 8000
```

```
src/        template.html, core.js（分割など DOM を使わない部分）, app.js（UI）, glossary.js（記号辞典）
demo/       デモ用の Lean ファイルと日本語訳（Apache-2.0）
vendor/     KaTeX, JSZip（MIT）
tools/      build.py
test/       node:test のテスト
public/     Web 版（ビルド結果。Cloudflare Pages はここを配信）
dist/       claude.ai 版（ビルド結果。1 ファイル）
```

`src/` を変えたら `tools/build.py` を実行して `public/` と `dist/` もコミットしてください。CI がビルド結果とソースの一致を確認します。配信されるものがそのままリポジトリで読めるように、ビルド済みのファイルを置いています。

## Cloudflare Pages に置く

1. Cloudflare のダッシュボードで Workers & Pages → Create → Pages → Connect to Git を選び、このリポジトリを指定する
2. Framework preset は None、Build command は空、Build output directory は `public`
3. 保存すると、`main` に push するたびに配置される

`public/_headers` のセキュリティヘッダーも一緒に配信されます。

## ライセンス

- ツール本体: BSD 2-Clause License（`LICENSE`）
- `demo/`: Apache License 2.0（`demo/LICENSE`、`demo/NOTICE`）。python-formalization から変更せずに複製したファイル 4 つと、その日本語訳です
- `vendor/`: KaTeX、JSZip（いずれも MIT）

詳しくは `NOTICE` を見てください。

---

## English

**side-by-side-lean-natural** (Lean 対訳ブラウザ) splits Lean 4 source into declarations and shows each one next to a natural-language mathematical translation in the language you choose. It reads source only: no Lean build is required.

- Open a repository from a GitHub URL (private repositories work with a token), a ZIP or a folder.
- Translations are made by Claude, either with your Anthropic API key (web version) or with the viewer's own Claude account (claude.ai version, `dist/claude-artifact.html`). Definitions referenced from imported files are sent as context.
- Tap identifiers to see and jump to their definitions; tap Lean symbols and tactics for a short explanation.
- Share links with `?repo=owner/repo&path=…&decl=…&lang=…`.
- Export translations and commit them as `.lean-taiyaku/<lang>.json` in the target repository; anyone who opens it then reads them without a key.
- Keys stay in the browser. The page talks only to `api.github.com` and `api.anthropic.com`, enforced by the Content-Security-Policy in `public/_headers`.
- Deploy: Cloudflare Pages with no build command and `public` as the output directory.

License: BSD 2-Clause for the tool; `demo/` is Apache-2.0 (files from Broyojo/python-formalization and their Japanese translation); KaTeX and JSZip are MIT. See `NOTICE`.
