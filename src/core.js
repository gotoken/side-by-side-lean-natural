// ---- core: Lean block splitting, naming, identifier index, prompt building ----
// Pure functions (no DOM). Tested with node.

const STARTER_KW = new Set(("theorem lemma def abbrev structure inductive coinductive class instance axiom axioms opaque " +
  "example namespace section end open variable universe import set_option attribute macro macro_rules syntax " +
  "notation infix infixl infixr prefix postfix elab elab_rules declare_syntax_cat initialize builtin_initialize " +
  "mutual export omit include module irreducible_def register_simp_attr add_decl_doc alias private protected " +
  "noncomputable partial unsafe nonrec local scoped public meta deriving").split(/\s+/));
const STRUCT_KW = new Set("namespace section end open universe import set_option export omit include module mutual".split(" "));
const MODIFIERS = new Set("private protected noncomputable partial unsafe nonrec public meta local scoped".split(" "));
const DECL_KW = ["theorem", "lemma", "def", "abbrev", "structure", "inductive", "coinductive", "class", "instance",
  "axiom", "opaque", "example", "irreducible_def", "variable", "macro", "macro_rules", "syntax", "notation", "infix",
  "infixl", "infixr", "prefix", "postfix", "elab", "elab_rules", "attribute", "alias", "deriving", "initialize",
  "declare_syntax_cat", "register_simp_attr", "add_decl_doc"];

function isStarterLine(line) {
  if (!line || /^\s/.test(line)) return false;
  if (line.startsWith("@[") || line.startsWith("/-") || line.startsWith("--")) return true;
  if (/^#[a-z_]+/.test(line)) return true;
  const m = /^([A-Za-z_]+)\b/.exec(line);
  if (!m) return false;
  if (m[1] === "deriving") return /^deriving\s+instance\b/.test(line);
  return STARTER_KW.has(m[1]);
}

// Scan one line, updating {depth, inStr}. Returns the state after the line.
function scanLine(line, st) {
  let depth = st.depth, inStr = st.inStr;
  for (let i = 0; i < line.length; i++) {
    const c = line[i], n = line[i + 1];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (depth > 0) {
      if (c === "/" && n === "-") { depth++; i++; }
      else if (c === "-" && n === "/") { depth--; i++; }
      continue;
    }
    if (c === "-" && n === "-") break; // line comment
    if (c === "/" && n === "-") { depth++; i++; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "'") { // char literal like '"' or '\n' (but not h' identifiers)
      const prev = line[i - 1] || " ";
      if (!/[A-Za-z0-9_'!?Ͱ-Ͽ₀-ₜ]/.test(prev)) {
        if (n === "\\" && line[i + 3] === "'") { i += 3; continue; }
        if (line[i + 2] === "'") { i += 2; continue; }
      }
    }
  }
  return { depth, inStr };
}

function stripLeading(text) {
  // remove docstring /-- ... -/ , attributes @[...], and line comments at the start
  let t = text;
  for (let guard = 0; guard < 50; guard++) {
    const before = t;
    t = t.replace(/^\s+/, "");
    if (t.startsWith("/--") || (t.startsWith("/-") && !t.startsWith("/-!"))) {
      let d = 0, i = 0;
      for (; i < t.length; i++) {
        if (t[i] === "/" && t[i + 1] === "-") { d++; i++; }
        else if (t[i] === "-" && t[i + 1] === "/") { d--; i++; if (d === 0) { i++; break; } }
      }
      t = t.slice(i);
    } else if (t.startsWith("@[")) {
      let d = 0, i = 1;
      for (; i < t.length; i++) {
        if (t[i] === "[") d++;
        else if (t[i] === "]") { d--; if (d === 0) { i++; break; } }
      }
      t = t.slice(i);
    } else if (t.startsWith("--")) {
      const k = t.indexOf("\n");
      t = k < 0 ? "" : t.slice(k + 1);
    }
    if (t === before) break;
  }
  return t;
}

function headKeyword(text) {
  let t = stripLeading(text);
  for (let g = 0; g < 6; g++) {
    const m = /^([A-Za-z_]+)\b\s*/.exec(t);
    if (!m) return null;
    if (MODIFIERS.has(m[1])) { t = t.slice(m[0].length); continue; }
    if (m[1] === "class" && /^class\s+inductive\b/.test(t)) return "inductive";
    return m[1];
  }
  return null;
}

function declName(text) {
  const t = stripLeading(text).replace(/^(?:(?:private|protected|noncomputable|partial|unsafe|nonrec|public|meta|local|scoped)\s+)*/, "");
  const m = /^(theorem|lemma|def|abbrev|structure|inductive|coinductive|class(?:\s+inductive)?|instance|axiom|opaque|irreducible_def)\b\s*(?:\(\s*priority\s*:=[^)]*\)\s*)?([^\s:({\[⦃]+)?/.exec(t);
  if (!m) return null;
  const nm = m[2];
  if (!nm || nm === "where" || nm === ":=") return null;
  return nm.replace(/^«|»$/g, "");
}

// Split Lean source into blocks.
function splitLean(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const starts = [0];
  let st = { depth: 0, inStr: false };
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && st.depth === 0 && !st.inStr && isStarterLine(lines[i])) starts.push(i);
    st = scanLine(lines[i], st);
  }
  starts.push(lines.length);
  // raw chunks
  let raw = [];
  for (let k = 0; k + 1 < starts.length; k++) {
    let a = starts[k], b = starts[k + 1];
    if (a >= b) continue;
    raw.push({ start: a, end: b, lines: lines.slice(a, b) });
  }
  // classify raw chunks
  for (const c of raw) {
    const text = c.lines.join("\n");
    const first = c.lines.find(l => l.trim() !== "") || "";
    const rest = stripLeading(text).trim();
    if (first.trim() === "") c.cls = "blank";
    else if (first.startsWith("/-!")) c.cls = "prose";
    else if ((first.startsWith("/--") || first.startsWith("@[") || first.startsWith("--")) && rest === "") c.cls = "lead";
    else if (first.startsWith("/-") && rest === "") c.cls = "prose";
    else {
      const kw = headKeyword(text);
      c.kw = kw;
      if (kw && STRUCT_KW.has(kw)) c.cls = "struct";
      else if (kw === "noncomputable" || kw === "section") c.cls = "struct";
      else if (/^#/.test(stripLeading(text).trim())) c.cls = "cmd";
      else c.cls = "decl";
    }
  }
  // merge leading docs/attrs/comments into the next chunk; merge consecutive struct chunks
  const merged = [];
  let pendingLead = null;
  for (const c of raw) {
    if (c.cls === "blank") { if (merged.length && !pendingLead) { merged[merged.length - 1].end = c.end; merged[merged.length - 1].lines.push(...c.lines); } else if (pendingLead) { pendingLead.end = c.end; pendingLead.lines.push(...c.lines); } else merged.push(c); continue; }
    if (c.cls === "lead") {
      if (pendingLead) { pendingLead.end = c.end; pendingLead.lines.push(...c.lines); }
      else pendingLead = { start: c.start, end: c.end, lines: [...c.lines] };
      continue;
    }
    let cur = c;
    if (pendingLead) {
      cur = { ...c, start: pendingLead.start, lines: [...pendingLead.lines, ...c.lines] };
      pendingLead = null;
    }
    const prev = merged[merged.length - 1];
    if (prev && prev.cls === "struct" && cur.cls === "struct") {
      prev.end = cur.end; prev.lines.push(...cur.lines); continue;
    }
    merged.push(cur);
  }
  if (pendingLead) merged.push({ ...pendingLead, cls: "prose" });
  // build blocks; trim trailing blank lines for display
  const blocks = [];
  const nsStack = [];
  merged.forEach((c, idx) => {
    let ls = c.lines.slice();
    while (ls.length && ls[ls.length - 1].trim() === "") ls.pop();
    if (!ls.length) return;
    const text = ls.join("\n");
    const b = { id: "b" + blocks.length, start: c.start + 1, end: c.start + ls.length, text, cls: c.cls };
    if (c.cls === "decl") {
      b.kw = headKeyword(text) || c.kw || "decl";
      b.name = declName(text);
      const ns = nsStack.filter(Boolean).join(".");
      if (b.name) b.full = b.name.startsWith("_root_.") ? b.name.slice(7) : (ns ? ns + "." + b.name : b.name);
    }
    if (c.cls === "struct") {
      // track namespaces in order of lines
      for (const l of ls) {
        let m;
        if ((m = /^namespace\s+(\S+)/.exec(l))) nsStack.push(m[1]);
        else if (/^(?:noncomputable\s+)?section\b/.test(l) || /^public\s+section\b/.test(l)) nsStack.push("");
        else if (/^end\b/.test(l)) nsStack.pop();
      }
    }
    blocks.push(b);
  });
  return blocks;
}

// Where the statement of a declaration ends (before the proof / body).
function statementPart(text) {
  // first top-level ":=" (outside comments/strings) or a line starting with "|" / "where"
  let st = { depth: 0, inStr: false };
  const lines = text.split("\n");
  let out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (st.depth === 0 && i > 0 && /^\s*(\||where\b)/.test(l) && !/:=/.test(out.join("\n"))) { return out.join("\n"); }
    // find ':=' not in comment
    let idx = -1, s2 = { ...st };
    for (let j = 0; j < l.length; j++) {
      const c = l[j], n = l[j + 1];
      if (s2.inStr) { if (c === "\\") { j++; continue; } if (c === '"') s2.inStr = false; continue; }
      if (s2.depth > 0) { if (c === "/" && n === "-") { s2.depth++; j++; } else if (c === "-" && n === "/") { s2.depth--; j++; } continue; }
      if (c === "-" && n === "-") break;
      if (c === "/" && n === "-") { s2.depth++; j++; continue; }
      if (c === '"') { s2.inStr = true; continue; }
      if (c === ":" && n === "=") { idx = j; break; }
    }
    if (idx >= 0) { out.push(l.slice(0, idx + 2) + (/:=\s*by\b/.test(l.slice(idx)) ? " by …" : " …")); return out.join("\n"); }
    out.push(l);
    st = scanLine(l, st);
  }
  return out.join("\n");
}

// number of lines of the proof (for collapsing)
function proofSplit(b) {
  if (b.cls !== "decl" || !/^(theorem|lemma|instance|example)$/.test(b.kw)) return null;
  const lines = b.text.split("\n");
  let st = { depth: 0, inStr: false };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = /:=\s*by\s*$/.test(stripComment(l)) || /:=\s*$/.test(stripComment(l));
    st = scanLine(l, st);
    if (st.depth === 0 && m) {
      const rest = lines.length - (i + 1);
      if (rest >= 4) return { headLines: i + 1, proofLines: rest };
      return null;
    }
  }
  return null;
}
function stripComment(l) { const k = l.indexOf("--"); return k >= 0 ? l.slice(0, k).trimEnd() : l.trimEnd(); }

const IDENT_RE = /[A-Za-z_α-ωΑ-Ω][A-Za-z0-9_'!?α-ωΑ-Ω₀-₉]*(?:\.[A-Za-z_α-ωΑ-Ω][A-Za-z0-9_'!?α-ωΑ-Ω₀-₉]*)*/g;

function codeOnly(text) {
  // remove comments and strings, keep identifiers in code
  let out = "", st = { depth: 0, inStr: false };
  for (const l of text.split("\n")) {
    let s = "", d = st.depth, inS = st.inStr;
    for (let j = 0; j < l.length; j++) {
      const c = l[j], n = l[j + 1];
      if (inS) { if (c === "\\") { j++; continue; } if (c === '"') inS = false; continue; }
      if (d > 0) { if (c === "/" && n === "-") { d++; j++; } else if (c === "-" && n === "/") { d--; j++; } continue; }
      if (c === "-" && n === "-") break;
      if (c === "/" && n === "-") { d++; j++; continue; }
      if (c === '"') { inS = true; continue; }
      s += c;
    }
    st = { depth: d, inStr: inS };
    out += s + "\n";
  }
  return out;
}

function identifiers(text) {
  const set = new Set();
  const code = codeOnly(text);
  let m; IDENT_RE.lastIndex = 0;
  while ((m = IDENT_RE.exec(code))) set.add(m[0]);
  return set;
}

// Index of declarations: key (full name and each dotted suffix) -> [{path, block}]
function buildIndex(files /* [{path, blocks}] */) {
  const idx = new Map();
  for (const f of files) for (const b of f.blocks) {
    if (!b.full) continue;
    const parts = b.full.split(".");
    for (let k = 0; k < parts.length; k++) {
      const key = parts.slice(k).join(".");
      if (!idx.has(key)) idx.set(key, []);
      const arr = idx.get(key);
      if (!arr.some(e => e.path === f.path && e.block.id === b.id)) arr.push({ path: f.path, block: b });
    }
  }
  return idx;
}

function lookupIdent(idx, tok) {
  if (idx.has(tok)) return idx.get(tok);
  const parts = tok.split(".");
  // dot notation: h.len -> try suffixes
  for (let k = 1; k < parts.length; k++) {
    const key = parts.slice(k).join(".");
    if (key.length >= 3 && idx.has(key)) return idx.get(key);
  }
  return null;
}

function importsOf(src) {
  const out = [];
  for (const l of src.split("\n")) {
    const m = /^(?:public\s+|meta\s+|private\s+)*import\s+(.+)$/.exec(l.trim());
    if (m) for (const mod of m[1].split(/\s+/)) if (mod && !mod.startsWith("--")) out.push(mod.replace(/^all\s+/, ""));
  }
  return out;
}

function modulePath(mod, paths) {
  const tail = "/" + mod.replace(/\./g, "/") + ".lean";
  const exact = mod.replace(/\./g, "/") + ".lean";
  let best = null;
  for (const p of paths) {
    if (p === exact || p.endsWith(tail)) { if (!best || p.length < best.length) best = p; }
  }
  return best;
}

// Collect context: definitions referenced by `blocks` (current file) from other indexed files.
function collectContext(curPath, curBlocks, idx, budget = 24000) {
  const own = new Set(curBlocks.filter(b => b.full).map(b => b.full));
  const toks = new Set();
  for (const b of curBlocks) if (b.cls === "decl") for (const t of identifiers(b.text)) toks.add(t);
  const picked = new Map(); // key path#id -> {path, block}
  const consider = (tokSet, depth) => {
    const found = [];
    for (const t of tokSet) {
      const hits = lookupIdent(idx, t);
      if (!hits || hits.length > 4) continue; // ambiguous short names: skip
      for (const h of hits) {
        if (h.path === curPath && own.has(h.block.full)) continue;
        const key = h.path + "#" + h.block.id;
        if (picked.has(key)) continue;
        picked.set(key, { ...h, depth });
        found.push(h);
      }
    }
    return found;
  };
  const first = consider(toks, 0);
  // one more hop for definitions only
  const second = new Set();
  for (const h of first) if (!/^(theorem|lemma)$/.test(h.block.kw)) for (const t of identifiers(h.block.text)) second.add(t);
  consider(second, 1);
  // order: defs/structures first, then theorems; depth 0 first
  const items = [...picked.values()].sort((a, b) => {
    const ta = /^(theorem|lemma)$/.test(a.block.kw) ? 1 : 0, tb = /^(theorem|lemma)$/.test(b.block.kw) ? 1 : 0;
    return (a.depth - b.depth) || (ta - tb);
  });
  let out = [], used = 0;
  for (const it of items) {
    let body = /^(theorem|lemma|instance)$/.test(it.block.kw) ? statementPart(it.block.text) : it.block.text;
    if (body.length > 2500) body = body.slice(0, 2500) + "\n  …";
    const piece = `-- ${it.path}:${it.block.start}\n${body}\n`;
    if (used + piece.length > budget) continue;
    out.push(piece); used += piece.length;
  }
  return out.join("\n");
}

function fileWithMarkers(blocks) {
  return blocks.map(b => `<<<${b.id} lines ${b.start}-${b.end}${b.name ? " " + b.kw + " " + b.name : (b.cls !== "decl" ? " " + b.cls : "")}>>>\n${b.text}`).join("\n\n");
}

// Group blocks for translation into chunks
function chunkBlocks(blocks, maxChars = 9000, maxBlocks = 10) {
  const out = []; let cur = [], size = 0;
  for (const b of blocks) {
    const s = Math.min(b.text.length, 6000);
    if (cur.length && (size + s > maxChars || cur.length >= maxBlocks)) { out.push(cur); cur = []; size = 0; }
    cur.push(b); size += s;
  }
  if (cur.length) out.push(cur);
  return out;
}

const STYLE_TEXT = {
  brief: "Be brief: title plus the statement in one or two sentences; proof idea in one sentence.",
  normal: "Normal detail: state hypotheses and conclusion precisely; proof idea in 1-3 sentences.",
  detail: "Detailed: state everything precisely, explain the role of each hypothesis, and give the proof as a short numbered argument a mathematician could check (not tactic by tactic)."
};

function buildPrompt({ repoLabel, path, lang, style, blocks, allBlocks, context, fileText, elide }) {
  const whole = !elide && fileText.length <= 50000;
  const fileSection = whole
    ? fileWithMarkers(allBlocks)
    : fileWithMarkers(allBlocks.map(b => (blocks.includes(b) || b.cls !== "decl") ? b : { ...b, text: statementPart(b.text) }));
  const ids = blocks.map(b => b.id).join(", ");
  return `You are helping a reader who knows mathematics and programming, but not Lean 4, read a Lean 4 source file.
Translate each requested block into natural-language mathematics written in ${lang}.

Repository: ${repoLabel}
File: ${path}
Style: ${STYLE_TEXT[style] || STYLE_TEXT.normal}

For each requested block return one JSON object with these string fields:
- "id": the block id (e.g. "b3").
- "title": one short line in ${lang} saying what the block is ("Definition: ...", "Theorem: ...", etc.).
- "math": the content as ordinary mathematics in ${lang}. Use LaTeX inside $...$ for formulas (display math with $$...$$). Keep the variable names of the code. State hypotheses and conclusion explicitly. For a definition give the defining formula or case split; for a structure list its fields and their meaning; for a Prop-valued definition state the proposition it names. Plain text with "- " bullet lines is fine.
- "proof": for theorems/lemmas/instances with a proof, the proof idea in ${lang} (which lemmas, case splits, inductions or arithmetic facts it uses). Do not narrate tactics one by one. Empty string otherwise.
- "lean": notes in ${lang} on Lean-specific meaning a mathematician could misread, only when relevant. Examples: \`/\` on Int is Euclidean division (Int.ediv; rounds toward -∞ for positive divisors) and \`%\` is Int.emod (non-negative for a non-zero divisor); Nat subtraction truncates at 0; Option/some/none, Except/.ok/.error; Prop vs Bool and \`decide\`; dot notation \`r.WF\` = \`Range.WF r\`; implicit {…} and instance […] arguments; coercions ↑; \`sorry\`. Empty string if nothing notable.
- "src": if the block cites external source code or documents (file:line), summarize the correspondence in ${lang}; else "".

Rules:
- Be faithful to the code. Do not invent meaning that is not there. If the meaning depends on a definition you cannot see, say so in "lean".
- Keep Lean identifiers in backticks.
- For prose blocks (module docs, comments) put a translation of the prose in "math" and leave the other fields empty.
- For blocks that are only namespace/open/import/end, give a one-line "title" and leave the rest empty.

Definitions from other files that this file uses (for reference only; do not translate them):
<context>
${context || "(none found)"}
</context>

The file, split into blocks marked <<<id lines a-b ...>>>${whole ? "" : " (proofs of blocks not requested are elided)"}:
<file>
${fileSection}
</file>

Translate these blocks: ${ids}

Reply with only a JSON array with one object per requested block, in that order. Example element:
{"id":"b3","title":"…","math":"…","proof":"","lean":"","src":""}`;
}

function extractJSONArray(text) {
  if (!text) throw new Error("empty");
  const t = text.trim();
  try { const v = JSON.parse(t); return Array.isArray(v) ? v : (Array.isArray(v.blocks) ? v.blocks : [v]); } catch (e) { }
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  if (fence) { try { const v = JSON.parse(fence[1]); if (Array.isArray(v)) return v; } catch (e) { } }
  const a = t.indexOf("["), b = t.lastIndexOf("]");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("no JSON array in reply");
}

// Recover complete {...} objects from a reply that is not a clean JSON array (e.g. cut short).
function salvageObjects(text) {
  const out = [];
  let depth = 0, start = -1, inS = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inS) { if (c === "\\") { i++; continue; } if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}") { depth--; if (depth === 0 && start >= 0) { try { const o = JSON.parse(text.slice(start, i + 1)); if (o && o.id) out.push(o); } catch (e) { } start = -1; } if (depth < 0) depth = 0; }
  }
  return out;
}

function parseObject(text) {
  const t = String(text || "").trim();
  const tryParse = x => { try { const v = JSON.parse(x); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch (e) { return null; } };
  let v = tryParse(t); if (v) return v;
  const f = /```(?:json)?\s*([\s\S]*?)```/.exec(t); if (f && (v = tryParse(f[1]))) return v;
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  return a >= 0 && b > a ? tryParse(t.slice(a, b + 1)) : null;
}

function parseReply(text) {
  try { const a = extractJSONArray(text); if (a.length) return a; } catch (e) { }
  return salvageObjects(text || "");
}

// Server-sent events: the data of each complete event in buf, and the incomplete rest.
function splitSSE(buf) {
  const events = [];
  const parts = String(buf).split(/\r\n\r\n|\n\n|\r\r/);
  const rest = parts.pop();
  for (const ev of parts) {
    const data = ev.split(/\r\n|\n|\r/).filter(l => l.startsWith("data:")).map(l => l.slice(5).replace(/^ /, "")).join("\n");
    if (data) events.push(data);
  }
  return { events, rest };
}

// One chunk of a streamed Gemini reply (a GenerateContentResponse) folded into acc.
// Thought summaries are skipped; the last finishReason and modelVersion win.
function foldGemini(acc, d) {
  acc = acc || { text: "", finish: "", model: "", block: "" };
  if (!d) return acc;
  if (d.error) throw new Error("API " + (d.error.code || "") + ": " + (d.error.message || d.error.status || ""));
  if (d.modelVersion) acc.model = d.modelVersion;
  if (d.promptFeedback && d.promptFeedback.blockReason) acc.block = d.promptFeedback.blockReason;
  const c = (d.candidates || [])[0];
  if (c) {
    for (const p of (c.content && c.content.parts) || []) if (!p.thought && typeof p.text === "string") acc.text += p.text;
    if (c.finishReason) acc.finish = c.finishReason;
  }
  return acc;
}

function hashStr(s) { // FNV-1a 32 → base36, two rounds for fewer collisions
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; h2 = (h2 << 13 | h2 >>> 19) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

function parseGitHubURL(input) {
  let s = (input || "").trim();
  if (!s) return null;
  s = s.replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "");
  if (/^[\w.-]+\/[\w.-]+$/.test(s)) s = "https://github.com/" + s;
  let u;
  try { u = new URL(s); } catch (e) { return null; }
  if (!/(^|\.)github\.com$/.test(u.hostname)) return null;
  const seg = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (seg.length < 2) return null;
  const out = { owner: seg[0], repo: seg[1].replace(/\.git$/, ""), refPath: null, kind: null };
  if (seg[2] === "tree" || seg[2] === "blob") { out.kind = seg[2]; out.refPath = seg.slice(3); }
  return out;
}

const CORE = { splitLean, statementPart, proofSplit, identifiers, buildIndex, lookupIdent, importsOf, modulePath,
  collectContext, chunkBlocks, buildPrompt, extractJSONArray, salvageObjects, parseReply, parseObject, splitSSE, foldGemini, hashStr, parseGitHubURL, declName, headKeyword, codeOnly };
if (typeof module !== "undefined") module.exports = CORE;
