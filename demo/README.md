# demo/

The sample shown when the page opens: a Lean model of `rb_range_component_beg_len`
in CRuby's `range.c`, from the author's experiment repository
`gotoken/cruby-formalized-trial` at commit `74e11c6` (not public).

- `lean/` — the experiment's `lean/CrubyRange.lean` and `lean/CrubyRange/*.lean`,
  copied unmodified (the `dump` executable `Main.lean` is left out).
  Same license as the rest of this repository (BSD 2-Clause, see `../LICENSE`).
- `translations.ja.json` — Japanese translations of `Basic`, `Cases`, `Spec`,
  `Impl`, `Statements` and `Fixed`, keyed by file path and block id (`b0`, `b1`, …
  as the splitter numbers them). Generated from `tools/demo_translations_ja.py`.
  The other files are left untranslated so the demo can show live translation.
- `meta.json` — label, commit, start file and file list used by `tools/build.py`.
- `CRuby-BSDL.txt` — `Impl.lean` and `Fixed.lean` quote short excerpts of CRuby's
  `range.c` (Copyright (C) 1993-2007 Yukihiro Matsumoto) and of the patch merged as
  ruby/ruby#19824. CRuby may be redistributed under the 2-clause BSDL or the Ruby
  License; the excerpts are used under the BSDL, reproduced here.
