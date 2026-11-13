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

test("splits Basic.lean into declarations with namespaced names", () => {
  const b = byPath["lean/CrubyRange/Basic.lean"].blocks;
  assert.equal(b.length, 10);
  assert.equal(b[0].cls, "prose");
  assert.deepEqual(b.filter(x => x.cls === "decl").map(x => x.full), [
    "CrubyRange.MIN", "CrubyRange.MAX", "CrubyRange.Input", "CrubyRange.Input.Valid",
    "CrubyRange.Out", "CrubyRange.ChkOut", "CrubyRange.Out.toChk"]);
  assert.equal(b[4].start, 17); // docstring is attached to its declaration
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
  const src = "/-! Module doc.\ntheorem inside_a_comment : True := trivial\n/- nested -/ still the doc\n-/\n\ntheorem real : True := trivial\n";
  const b = C.splitLean(src);
  assert.deepEqual(b.map(x => [x.cls, x.start, x.end]), [["prose", 1, 4], ["decl", 6, 6]]);
  assert.equal(b[1].name, "real");
  const impl = byPath["lean/CrubyRange/Impl.lean"].blocks;
  assert.deepEqual([impl[1].cls, impl[1].start, impl[1].end], ["prose", 3, 33]); // quotes C code
});

test("demo translations (ja, en) match the block ids", () => {
  const all = ["ja", "en"].map(c => JSON.parse(fs.readFileSync(path.join(DEMO, `translations.${c}.json`), "utf8")));
  assert.deepEqual(Object.keys(all[1]).sort(), Object.keys(all[0]).sort());
  for (const tr of all) {
    for (const [p, m] of Object.entries(tr)) {
      const need = byPath[p].blocks.filter(b => b.cls !== "struct").map(b => b.id).sort();
      assert.deepEqual(Object.keys(m).sort(), need, p);
      for (const [id, e] of Object.entries(m)) assert.ok(e.id === id && e.title, `${p} ${id}`);
    }
  }
});

test("imports resolve and context includes referenced definitions", () => {
  const paths = files.map(f => f.path);
  const st = byPath["lean/CrubyRange/Statements.lean"];
  assert.deepEqual(C.importsOf(st.src), ["CrubyRange.Spec", "CrubyRange.Impl"]);
  assert.equal(C.modulePath("CrubyRange.Spec", paths), "lean/CrubyRange/Spec.lean");
  assert.equal(C.modulePath("CrubyRange", paths), "lean/CrubyRange.lean");
  const idx = C.buildIndex(files);
  const ctx = C.collectContext(st.path, st.blocks, idx);
  for (const name of ["def spec ", "def mChk ", "def specBeg ", "def Input.Valid ", "structure Input "]) assert.ok(ctx.includes(name), name);
});

test("statementPart cuts the proof or body", () => {
  const p1 = byPath["lean/CrubyRange/Statements.lean"].blocks.find(x => x.name === "P1");
  assert.match(C.statementPart(p1.text), /def P1 : Prop := …$/);
  const proofs = byPath["lean/CrubyRange/Proofs.lean"].blocks.filter(x => x.kw === "theorem");
  assert.ok(proofs.length > 0);
  for (const b of proofs) assert.ok(!/\n\s+(simp|omega|rcases|intro)\b/.test(C.statementPart(b.text)), b.name);
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

test("splitSSE returns complete events and keeps the incomplete rest", () => {
  const a = C.splitSSE('data: {"a":1}\r\n\r\ndata: {"b"');
  assert.deepEqual(a.events, ['{"a":1}']);
  const b = C.splitSSE(a.rest + ':2}\n\n: comment\n\nevent: x\ndata: one\ndata: two\n\n');
  assert.deepEqual(b.events, ['{"b":2}', "one\ntwo"]);
  assert.equal(b.rest, "");
});

test("foldGemini joins answer parts, skips thoughts and keeps the finish reason", () => {
  const chunks = [
    { candidates: [{ content: { parts: [{ text: "thinking…", thought: true }] } }] },
    { candidates: [{ content: { parts: [{ text: '[{"id":' }] } }], modelVersion: "gemini-x" },
    { candidates: [{ content: { parts: [{ text: '"b1"}]' }] }, finishReason: "STOP" }] },
  ];
  const acc = chunks.reduce(C.foldGemini, null);
  assert.equal(acc.text, '[{"id":"b1"}]');
  assert.equal(acc.finish, "STOP");
  assert.equal(acc.model, "gemini-x");
  assert.equal(C.foldGemini(null, { promptFeedback: { blockReason: "SAFETY" } }).block, "SAFETY");
  assert.throws(() => C.foldGemini(null, { error: { code: 504, message: "Deadline exceeded" } }), /504/);
});
