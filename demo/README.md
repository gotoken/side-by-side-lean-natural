# demo/

The sample shown when the page opens. Everything in this directory is under the
Apache License 2.0 (see `LICENSE` and `NOTICE` here), not the BSD 2-Clause
License of the rest of the repository.

- `lean/PyLean/...` — four files copied unmodified from
  [Broyojo/python-formalization](https://github.com/Broyojo/python-formalization)
  at commit `7d5a5ed` (the `range` length part of the CPython model).
- `translations.ja.json` — Japanese translations of `Spec.lean` and `Length.lean`,
  keyed by file path and block id (`b0`, `b1`, … as the splitter numbers them). `Model.lean` and `Core.lean` are included
  untranslated so the demo can show context lookup and live translation.
- `meta.json` — label, upstream commit and file list used by `tools/build.py`.
