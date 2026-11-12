# Taiyak

[English](../README.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · **繁體中文** · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

一個瀏覽器：把 Lean 4 原始碼依宣告切分，並在每個宣告旁邊顯示以你選擇的自然語言寫成的數學譯文。它只讀取原始碼，不需要建置 Lean。名稱取自日文「対訳」（taiyaku，原文與譯文對照）。

**網頁版：<https://taiyak.pages.dev/>**

![示範中的 Impl.lean：Lean 程式碼與譯文並排顯示](screenshot.png)

## 功能

- 從 GitHub URL（也支援私有儲存庫）、ZIP 檔或資料夾開啟 Lean 4 儲存庫
- 依宣告（`def`、`theorem`、`structure` 等）逐一並排顯示 Lean 程式碼與譯文。可譯成日文、英文、中文（簡體或繁體）、韓文、法文、德文、西班牙文、葡萄牙文或俄文，也可以輸入其他任何語言
- 只要選擇一種語言，譯文、介面、術語說明與「詢問 Claude」的解說都會使用該語言。介面文字內建上述十種語言（其他語言顯示英文）。術語說明內建日文與英文；其他語言會在第一次選擇時由 Claude 翻譯並儲存在瀏覽器中（先翻譯你點選的詞，其餘在背景繼續翻譯並顯示進度）。也可以在設定中單獨固定介面語言
- 第一次開啟時，若瀏覽器的偏好語言中日文排在英文之前，就以日文顯示，否則以英文顯示
- 翻譯時，會把目前檔案所引用、定義在 import 檔案中的內容當作上下文一併傳送
- 點選識別字可查看其定義摘要並跳到定義處。`∀`、`omega`、`rcases` 等符號與策略（tactic）會顯示簡短說明
- 較長的證明預設摺疊
- 譯文儲存在瀏覽器中。匯出後提交到儲存庫，開啟該儲存庫的人不需要 API 金鑰就能閱讀譯文
- 可以產生直接開啟某個檔案或宣告的分享連結

## 使用方式

### 網頁版（Cloudflare Pages）

開啟 <https://taiyak.pages.dev/>。

1. 輸入 GitHub URL，按下「開啟」
2. 在「設定」中填入 Anthropic API 金鑰（翻譯需要）。若是私有儲存庫，還要填入 GitHub 權杖。按下設定中的「在 GitHub 上建立權杖」，會開啟 GitHub 的權杖建立頁面，並已填好唯讀權限（Contents: read）與 30 天期限：只要選擇要讀取的儲存庫並建立即可
3. 按下「翻譯此檔案」，或單一程式碼區塊上的「翻譯」

不輸入 URL 直接開啟時，會顯示一個示範：CRuby `range.c` 中 `rb_range_component_beg_len`（範圍參數的正規化）的 Lean 模型，以及它的規格、性質 P1–P4 與修正版的模型。它來自作者未公開的實驗儲存庫 `gotoken/cruby-formalized-trial` @74e11c6。`Basic`、`Cases`、`Spec`、`Impl`、`Statements` 與 `Fixed` 附有英文與日文譯文；其他檔案可以當場翻譯。

### claude.ai 版

把 `dist/claude-artifact.html` 發佈為 claude.ai 的 artifact 後，每位檢視者會用自己的 Claude 帳戶翻譯（不需要 API 金鑰）。claude.ai 內的頁面無法連線到 GitHub，因此請用 GitHub 的「Code → Download ZIP」下載儲存庫，再用「開啟 ZIP」載入。

### 分享連結

網頁版顯示來自 GitHub 的儲存庫時，網址列中的 URL 就是分享連結。按下每個程式碼區塊右上角的行號（如 `L16–17`）即可複製指向該宣告的連結。

| 參數 | 意義 |
|---|---|
| `repo` | `owner/repo` |
| `ref` | 分支、標籤或提交（省略時為預設分支） |
| `path` | 要開啟的檔案 |
| `decl` | 要捲動到的宣告名稱（沒有名稱的區塊使用 `id=b12` 的形式） |
| `lang` | 翻譯語言 |

範例：<https://taiyak.pages.dev/?repo=Broyojo/python-formalization&path=lean/PyLean/RangeSlice/Length.lean&decl=slow_isLen&lang=%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87>

### 將譯文隨儲存庫一起提供

1. 翻譯需要的檔案
2. 透過「設定」→「匯出譯文」取得 JSON 檔（只會匯出目前開啟的儲存庫）
3. 將它以 `.taiyak/zh-Hant.json` 提交到目標儲存庫（每種語言一個檔案，檔名不限）

開啟儲存庫時會自動讀取 `.taiyak/*.json`。若你在本機為同一區塊做過翻譯，則以本機譯文為準。譯文依「語言、詳細程度、檔案路徑與區塊內文的雜湊」比對，因此區塊的程式碼改變後，舊譯文就不再使用。

## 金鑰與資料

- API 金鑰與 GitHub 權杖只在瀏覽器內使用。只有選擇「儲存在此瀏覽器」時才會存入 localStorage。請勿在共用電腦上儲存。
- 頁面只與 `api.github.com` 和 `api.anthropic.com` 通訊。網頁版以 `public/_headers` 中的 Content-Security-Policy 強制這一點，瀏覽器會拒絕傳送到其他位址。內嵌指令碼也以雜湊固定。
- 翻譯時，會把目前檔案及其引用之定義的 Lean 原始碼傳送給 Anthropic。翻譯私有程式碼前，請確認所屬組織的規定。
- GitHub 權杖建議使用 fine-grained personal access token：只選擇需要的儲存庫，權限設為 Contents: Read-only。

## 運作方式與限制

- 切分是靜態的：只看頂層關鍵字，以及文字是否位於註解或字串內。不執行 Lean，因此不使用型別資訊、記法與巨集的展開，也不使用策略證明途中的目標。
- 上下文沿 import 最多追溯 3 層、30 個檔案，並收集名稱相符的定義。同名定義過多的短名稱會被略過。
- 譯文由 LLM 產生，可能有誤。請對照程式碼閱讀。
- `mutual` 區塊中的宣告或由巨集產生的宣告，可能無法正確切分。

## 開發

```sh
python3 tools/build.py             # 從 src/ 與 demo/ 產生 public/ 與 dist/
node --test "test/*.test.cjs"      # 切分、上下文收集與回覆解析的測試
python3 -m http.server -d public 8000
```

```
src/        template.html, core.js（切分等不依賴 DOM 的部分）, app.js（UI）,
            i18n.js（語言與介面文字）, glossary.js（符號辭典）
demo/       示範用的 Lean 檔案、其英文與日文譯文、CRuby 的 BSDL
vendor/     KaTeX, JSZip（MIT）
tools/      build.py、示範譯文的原始檔
test/       node:test 測試
docs/       本 README 的譯本、螢幕截圖
public/     網頁版（建置結果；Cloudflare Pages 發佈此目錄）
dist/       claude.ai 版（建置結果；單一檔案）
```

修改 `src/` 或 `demo/` 後，請執行 `tools/build.py` 並一併提交 `public/` 與 `dist/`。CI 會檢查建置結果與原始碼是否一致。儲存庫中保留建置好的檔案，是為了讓發佈出去的內容能在這裡原樣查看。

## 部署到 Cloudflare Pages

1. 在 Cloudflare 主控台中選擇 Workers & Pages → Create → Pages → Connect to Git，並選擇本儲存庫
2. Framework preset 選 None，Build command 留空，Build output directory 填 `public`
3. 儲存後，每次推送到 `main` 都會自動部署

`public/_headers` 中的安全標頭也會一併生效。

## 授權

- 整個儲存庫（包括示範用的 Lean 檔案）：BSD 2-Clause License（`LICENSE`）
- 示範中的 `Impl.lean` 與 `Fixed.lean` 簡短引用了 CRuby 的 `range.c`（Copyright (C) 1993-2007 Yukihiro Matsumoto）以及 ruby/ruby#19824 的修補。CRuby 可依 2-clause BSDL 或 Ruby License 再散布；引用部分依 BSDL 使用（`demo/CRuby-BSDL.txt`）
- `vendor/`：KaTeX 與 JSZip（皆為 MIT）

詳情請參閱 `NOTICE`。

本檔案是 [README.md](../README.md)（英文）的譯本。如有出入，以英文版為準。
