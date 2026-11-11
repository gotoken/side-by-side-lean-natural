// Run with: node --test "test/*.test.cjs"
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../src/core.js");

const DEMO = path.join(__dirname, "..", "demo");
const meta = JSON.parse(fs.readFileSync(path.join(DEMO, "meta.json"), "utf8"));
const read = p => fs.readFileSync(path.join(DEMO, "lean", path.relative("lean", p)), "utf8");
const files = meta.files.map(p => ({ path: p, src: read(p), blocks: C.splitLean(read(p)) }));
const byPath = Object.fromEntries(files.map(f => [f.path, f]));

test("splits Spec.lean into declarations with namespaced names", () => {
  const b = byPath["lean/PyLean/RangeSlice/Spec.lean"].blocks;
  assert.equal(b.length, 10);
  assert.deepEqual(b.filter(x => x.cls === "decl").map(x => x.full), [
    "PyLean.RangeSlice.InSeq", "PyLean.RangeSlice.IsLen", "PyLean.RangeSlice.Range.elem",
    "PyLean.RangeSlice.Range.WF", "PyLean.RangeSlice.Range.Len", "PyLean.RangeSlice.Range.MemL"]);
  assert.equal(b[3].start, 12); // docstring is attached to its declaration
});

test("blocks cover the file without gaps or overlaps", () => {
  for (const f of files) {
    const lines = f.src.split("\n");
    let next = 1;
    for (const b of f.blocks) {
      for (let i = next; i < b.start; i++) assert.equal(lines[i - 1].trim(), "", `${f.path}:${i} not covered`);
      assert.ok(b.start >= next, `${f.path} overlap at ${b.id}`);
      assert.equal(b.text, lines.slice(b.start - 1, b.end).join("\n"));
      next = b.end + 1;
    }
  }
});

test("column-0 text inside doc comments does not start a block", () => {
  const b = byPath["lean/PyLean/RangeSlice/Model.lean"].blocks;
  assert.equal(b[1].cls, "prose");
  assert.equal(b[1].start, 3);
  assert.equal(b[1].end, 26);
});

test("demo translations match the block ids", () => {
  const tr = JSON.parse(fs.readFileSync(path.join(DEMO, "translations.ja.json"), "utf8"));
  for (const [p, m] of Object.entries(tr)) {
    const need = byPath[p].blocks.filter(b => b.cls !== "struct").map(b => b.id).sort();
    assert.deepEqual(Object.keys(m).sort(), need, p);
  }
});

test("imports resolve and context includes referenced definitions", () => {
  const paths = files.map(f => f.path);
  const len = byPath["lean/PyLean/RangeSlice/Length.lean"];
  assert.deepEqual(C.importsOf(len.src), ["PyLean.RangeSlice.Spec"]);
  assert.equal(C.modulePath("PyLean.RangeSlice.Spec", paths), "lean/PyLean/RangeSlice/Spec.lean");
  const idx = C.buildIndex(files);
  const ctx = C.collectContext(len.path, len.blocks, idx);
  for (const name of ["def IsLen", "def computeRangeLengthSlow", "def InSeq", "def getLenOfRange"]) assert.ok(ctx.includes(name), name);
});

test("statementPart cuts the proof", () => {
  const b = byPath["lean/PyLean/RangeSlice/Length.lean"].blocks.find(x => x.name === "slow_isLen");
  assert.match(C.statementPart(b.text), /IsLen a b s \(computeRangeLengthSlow a b s\) := by …$/);
});

test("reply parsing tolerates fences and truncation", () => {
  assert.equal(C.parseReply('```json\n[{"id":"b1","title":"x"}]\n```')[0].id, "b1");
  const cut = '[{"id":"b1","title":"a"},{"id":"b2","title":"b"},{"id":"b3","ti';
  assert.deepEqual(C.parseReply(cut).map(o => o.id), ["b1", "b2"]);
});

test("GitHub URL forms", () => {
  assert.deepEqual(C.parseGitHubURL("owner/repo"), { owner: "owner", repo: "repo", refPath: null, kind: null });
  const u = C.parseGitHubURL("https://github.com/o/r/blob/feature/x/lean/A.lean");
  assert.equal(u.kind, "blob");
  assert.deepEqual(u.refPath, ["feature", "x", "lean", "A.lean"]);
  assert.equal(C.parseGitHubURL("git@github.com:o/r.git").repo, "r");
  assert.equal(C.parseGitHubURL("https://example.com/o/r"), null);
});

test("glossary entries are complete and cover every highlighted keyword and tactic", () => {
  const vm = require("node:vm");
  const src = p => fs.readFileSync(path.join(__dirname, "..", "src", p), "utf8");
  const G = vm.runInNewContext(src("glossary.js") + ";GLOSSARY");
  for (const [k, v] of Object.entries(G)) assert.ok(Array.isArray(v) && v.length === 2 && v[0] && v[1], k);
  const app = src("app.js");
  for (const name of ["TACTIC", "KW"]) {
    const words = new RegExp(`const ${name} = new Set\\("([^"]+)"`).exec(app)[1].split(" ");
    assert.deepEqual(words.filter(w => !G[w]), [], `${name} words without a glossary entry`);
  }
});

test("every interface language has every string, with the same shape as English", () => {
  const vm = require("node:vm");
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "i18n.js"), "utf8") + ";this.UI = UI; this.LANGS = LANGS;", ctx);
  const { UI, LANGS } = ctx;
  assert.deepEqual(Array.from(LANGS, l => l.ui).sort(), Object.keys(UI).sort());
  const shape = v => typeof v === "function" ? `fn${v.length}` : typeof v;
  for (const [code, d] of Object.entries(UI)) {
    for (const [k, v] of Object.entries(UI.en)) {
      assert.ok(k in d, `${code} lacks ${k}`);
      assert.equal(shape(d[k]), shape(v), `${code}.${k}`);
      if (k === "kinds") assert.deepEqual(Object.keys(d[k]).sort(), Object.keys(v).sort(), `${code}.kinds`);
    }
    assert.deepEqual(Object.keys(d).filter(k => !(k in UI.en)), [], `${code} has extra keys`);
  }
});

test("parseObject reads a JSON object from a reply", () => {
  assert.deepEqual(C.parseObject('Sure:\n```json\n{"a":"x","|>":"y"}\n```'), { a: "x", "|>": "y" });
  assert.equal(C.parseObject("no json"), null);
});
