# Taiyak

**English** · [日本語](docs/README.ja.md) · [简体中文](docs/README.zh-Hans.md) · [繁體中文](docs/README.zh-Hant.md) · [한국어](docs/README.ko.md) · [Français](docs/README.fr.md) · [Deutsch](docs/README.de.md) · [Español](docs/README.es.md) · [Português](docs/README.pt.md) · [Русский](docs/README.ru.md)

A browser that splits Lean 4 source into declarations and shows each one next to a mathematical translation in the natural language you choose. It only reads the source: no Lean build is needed. The name comes from the Japanese 対訳 (*taiyaku*), a text set side by side with its translation.

**Web version: <https://taiyak.pages.dev/>**

![The demo's Impl.lean, with Lean and its translation side by side](docs/screenshot.png)

## Features

- Open a Lean 4 repository from a GitHub URL (private repositories too), a ZIP file or a folder
- Show the Lean code and its translation side by side, one declaration (`def`, `theorem`, `structure`, …) at a time. Translate into Japanese, English, Chinese (Simplified or Traditional), Korean, French, German, Spanish, Portuguese or Russian, or type in any other language
- One language choice sets the translations, the interface, the glossary and the "Ask Claude" explanations. Interface text is built in for the ten languages above (English otherwise). The glossary is built in for Japanese and English; for other languages, Claude translates it the first time you choose the language and the browser keeps it (the word you tapped comes first, the rest continue in the background with a progress indicator). Settings can also fix the interface language on its own
- On a first visit the page opens in Japanese if your browser prefers Japanese over English, and in English otherwise
- When translating, definitions from imported files that the current file refers to are sent along as context
- Tap an identifier to see a summary of its definition and jump to it. Symbols and tactics such as `∀`, `omega` and `rcases` get a short explanation
- Long proofs start folded
- Translations are kept in the browser. Export them and commit them to the repository, and anyone who opens it can read them without an API key
- Make share links that open a given file or declaration

## Usage

### Web version (Cloudflare Pages)

Open <https://taiyak.pages.dev/>.

1. Enter a GitHub URL and press "Open"
2. In "Settings", enter an API key from Anthropic, OpenAI, Google or OpenRouter (needed for translation). For a private repository, also enter a GitHub token. "Create a token on GitHub" in Settings opens GitHub's token page with read-only access (Contents: read) and a 30-day expiry already filled in: choose the repositories you want to read and create it
3. Press "Translate this file", or "Translate" on a single block

Opened without a URL, the page shows a demo: a Lean model of `rb_range_component_beg_len` (the normalization of range arguments) in CRuby's `range.c`, with its specification, properties P1–P4 and a model of the fix. It comes from the author's experiment repository `gotoken/cruby-formalized-trial` @74e11c6, which is not public. `Basic`, `Cases`, `Spec`, `Impl`, `Statements` and `Fixed` come with English and Japanese translations; the other files can be translated on the spot.

### claude.ai version

Publish `dist/claude-artifact.html` as a claude.ai artifact, and each viewer's own Claude account does the translating (no API key needed). Pages inside claude.ai cannot reach GitHub, so download the repository with GitHub's "Code → Download ZIP" and load it with "Open ZIP".

### Share links

While the web version shows a repository from GitHub, the URL in the address bar is a share link. The line numbers at the top right of each block (`L16–17` and so on) copy a link to that declaration.

| Parameter | Meaning |
|---|---|
| `repo` | `owner/repo` |
| `ref` | Branch, tag or commit (the default branch if omitted) |
| `path` | File to open |
| `decl` | Name of the declaration to scroll to (blocks without a name use the form `id=b12`) |
| `lang` | Translation language |

Example: <https://taiyak.pages.dev/?repo=Broyojo/python-formalization&path=lean/PyLean/RangeSlice/Length.lean&decl=slow_isLen&lang=English>

### Bundling translations with a repository

1. Translate the files you want
2. Use "Settings" → "Export translations" to get a JSON file (only the repository you have open is exported)
3. Commit it to the target repository as `.taiyak/en.json` (one file per language; any name works)

Opening a repository loads `.taiyak/*.json` automatically. A translation you made yourself for the same block takes precedence. Translations are matched by language, detail level and a hash of the file path and block text, so when the code of a block changes, its old translation is no longer used.

## Keys and data

- The API key and the GitHub token are used only inside the browser. They are saved to localStorage only if you choose "Remember in this browser". Do not save them on a shared computer.
- The page talks only to `api.github.com`, `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` and `openrouter.ai`. In the web version, the Content-Security-Policy in `public/_headers` enforces this, so the browser refuses to send anything anywhere else. Inline scripts are pinned by hash as well.
- Translating sends the Lean source of the file, and of the definitions it refers to, to the API you chose (Anthropic, OpenAI, Google or OpenRouter). Check your organization's policy before translating private code.
- For the GitHub token, use a fine-grained personal access token: select only the repositories you need, with Contents: Read-only.

## How it works, and its limits

- Splitting is static: it looks at top-level keywords and at whether text is inside comments or strings. Lean is not run, so type information, notation and macro expansion, and the goals in the middle of tactic proofs are not used.
- Context follows imports up to 3 levels deep and 30 files, and picks up definitions whose names match. Short names with too many definitions are skipped.
- Translations come from an LLM and can be wrong. Read them against the code.
- Declarations inside `mutual` blocks, or generated by macros, may not split well.

## Development

```sh
python3 tools/build.py             # build public/ and dist/ from src/ and demo/
node --test "test/*.test.cjs"      # tests for splitting, context collection and reply parsing
python3 -m http.server -d public 8000
```

```
src/        template.html, core.js (splitting and other DOM-free parts), app.js (UI),
            i18n.js (languages and interface text), glossary.js (symbol glossary)
demo/       demo Lean files, their English and Japanese translations, CRuby's BSDL
vendor/     KaTeX, JSZip (MIT)
tools/      build.py, sources of the demo translations
test/       node:test tests
docs/       translations of this README, screenshot
public/     web version (build output; Cloudflare Pages serves this directory)
dist/       claude.ai version (build output; a single file)
```

After changing `src/` or `demo/`, run `tools/build.py` and commit `public/` and `dist/` too. CI checks that the build output matches the sources. The built files are kept in the repository so that what is served can be read here as it is.

## Deploying to Cloudflare Pages

1. In the Cloudflare dashboard, choose Workers & Pages → Create → Pages → Connect to Git, and select this repository
2. Framework preset: None. Build command: empty. Build output directory: `public`
3. Once saved, every push to `main` is deployed

The security headers in `public/_headers` are served as well.

## License

- The whole repository, including the demo's Lean files: BSD 2-Clause License (`LICENSE`)
- The demo's `Impl.lean` and `Fixed.lean` quote short excerpts of CRuby's `range.c` (Copyright (C) 1993-2007 Yukihiro Matsumoto) and of the patch in ruby/ruby#19824. CRuby may be redistributed under the 2-clause BSDL or the Ruby License; the excerpts are used under the BSDL (`demo/CRuby-BSDL.txt`)
- `vendor/`: KaTeX and JSZip (both MIT)

See `NOTICE` for details.

The READMEs under `docs/` are translations of this file. If they differ, this English version prevails.
