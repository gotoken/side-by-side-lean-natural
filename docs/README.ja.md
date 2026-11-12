# Taiyak

[English](../README.md) · **日本語** · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

Lean 4 のソースを宣言ごとに区切り、それぞれを指定した言語の数学的な文章に訳して横に並べるブラウザです。ソースを読むだけで動くので、Lean のビルドは要りません。名前は「対訳」から取っています。

**Web 版: <https://taiyak.pages.dev/>**

![デモの Impl.lean を Lean と訳を並べて表示したところ](screenshot.png)

## できること

- GitHub の URL（private リポジトリも可）、ZIP、フォルダから Lean 4 のリポジトリを開く
- 宣言（`def`、`theorem`、`structure` など）ごとに、Lean のコードと訳を並べて表示する。言語は日本語、英語、中国語（簡体・繁体）、韓国語、フランス語、ドイツ語、スペイン語、ポルトガル語、ロシア語から選べて、自由入力もできる
- 言語の選択は 1 つで、訳・画面の文言・用語解説・「Claude に聞く」の説明がすべてその言語になる。画面の文言は上の 10 言語を内蔵（それ以外は英語）。用語解説は日本語と英語を内蔵し、ほかの言語は初めて選んだときに Claude で訳してブラウザに保存する（押した語を先に訳し、残りはバックグラウンドで進めて進み具合を表示）。設定で画面の言語だけを固定することもできる
- 初めて開いたときの言語は、ブラウザの優先言語で日本語が英語より上にあれば日本語、そうでなければ英語
- 訳すとき、import 先で定義されていて対象ファイルが参照しているものを、文脈として一緒に渡す
- 識別子をタップすると定義の要約を表示し、定義元へ移動できる。`∀`、`omega`、`rcases` などの記号やタクティクには短い解説が出る
- 長い証明は最初たたんで表示する
- 訳はブラウザに保存する。書き出してリポジトリに同梱すれば、開いた人は API キーなしで訳を読める
- ファイルや宣言を直接開く共有リンクを作れる

## 使い方

### Web 版（Cloudflare Pages）

<https://taiyak.pages.dev/> を開きます。

1. GitHub の URL を入れて「開く」を押す
2. 「設定」で Anthropic・OpenAI・Google のいずれかの API キーを入れる（翻訳に必要）。private リポジトリなら GitHub トークンも入れる。設定にある「GitHub でトークンを作る」から開くと、読み取り専用（Contents: read）・期限 30 日の設定が記入済みの作成画面になるので、読みたいリポジトリを選んで作るだけです
3. 「このファイルを訳す」、または各ブロックの「訳す」を押す

URL を入れずに開くと、デモが表示されます。CRuby の `range.c` にある `rb_range_component_beg_len`（範囲引数の正規化）を Lean に写したモデルと、仕様・性質 P1〜P4・修正版のモデルです（作者の実験リポジトリ `gotoken/cruby-formalized-trial` @74e11c6 から。リポジトリ自体は非公開）。`Basic`・`Cases`・`Spec`・`Impl`・`Statements`・`Fixed` は日本語訳と英訳つきで、ほかのファイルはその場で訳せます。

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

例: <https://taiyak.pages.dev/?repo=Broyojo/python-formalization&path=lean/PyLean/RangeSlice/Length.lean&decl=slow_isLen&lang=%E6%97%A5%E6%9C%AC%E8%AA%9E>

### 訳をリポジトリに同梱する

1. 訳したいファイルを訳す
2. 「設定」→「訳をエクスポート」で JSON を取り出す（いま開いているリポジトリの分だけが出ます）
3. 対象リポジトリに `.taiyak/ja.json` としてコミットする（言語ごとに 1 ファイル。名前は自由）

リポジトリを開くと `.taiyak/*.json` を自動で読み込みます。同じブロックに手元で付けた訳があれば、そちらが優先されます。訳の照合には「言語・詳しさ・ファイルパスとブロック本文のハッシュ」を使うので、コードが変わったブロックの古い訳は自動的に使われなくなります。

## キーとデータの扱い

- API キーと GitHub トークンはブラウザの中だけで使います。「このブラウザに保存する」を選んだときだけ localStorage に保存します。共用の PC では保存しないでください。
- ページが通信する先は `api.github.com`, `api.anthropic.com`, `api.openai.com` と `generativelanguage.googleapis.com` だけです。Web 版では `public/_headers` の Content-Security-Policy でこれを固定しているので、ブラウザはそれ以外への送信を拒否します。インラインスクリプトもハッシュで固定しています。
- 翻訳するとき、対象ファイルと参照している定義の Lean ソースを、選んだ API（Anthropic・OpenAI・Google のいずれか）に送ります。private なコードを訳すときは、所属組織の方針を確認してください。
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
src/        template.html, core.js（分割など DOM を使わない部分）, app.js（UI）,
            i18n.js（言語と画面の文言）, glossary.js（記号辞典）
demo/       デモ用の Lean ファイル、その日本語訳と英訳、CRuby の BSDL
vendor/     KaTeX, JSZip（MIT）
tools/      build.py、デモの訳のソース
test/       node:test のテスト
docs/       この README の翻訳、スクリーンショット
public/     Web 版（ビルド結果。Cloudflare Pages はここを配信）
dist/       claude.ai 版（ビルド結果。1 ファイル）
```

`src/` や `demo/` を変えたら `tools/build.py` を実行して `public/` と `dist/` もコミットしてください。CI がビルド結果とソースの一致を確認します。配信されるものがそのままリポジトリで読めるように、ビルド済みのファイルを置いています。

## Cloudflare Pages に置く

1. Cloudflare のダッシュボードで Workers & Pages → Create → Pages → Connect to Git を選び、このリポジトリを指定する
2. Framework preset は None、Build command は空、Build output directory は `public`
3. 保存すると、`main` に push するたびに配置される

`public/_headers` のセキュリティヘッダーも一緒に配信されます。

## ライセンス

- リポジトリ全体: BSD 2-Clause License（`LICENSE`）。デモの Lean ファイルも同じです
- デモの `Impl.lean` と `Fixed.lean` は、CRuby の `range.c`（Copyright (C) 1993-2007 Yukihiro Matsumoto）と ruby/ruby#19824 のパッチを短く引用しています。CRuby は 2-clause BSDL か Ruby License で再配布でき、引用部分は BSDL で使っています（`demo/CRuby-BSDL.txt`）
- `vendor/`: KaTeX、JSZip（いずれも MIT）

詳しくは `NOTICE` を見てください。

このファイルは [README.md](../README.md)（英語）の翻訳です。内容が食い違う場合は英語版が優先されます。
