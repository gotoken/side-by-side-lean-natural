// ---- app: UI, sources, translators, cache ----
(function () {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Interface strings and the language list live in i18n.js (UI, LANGS).

// ---------- storage helpers ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem("lt:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("lt:" + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem("lt:" + k); } catch (e) { } }
};
const MEM = new Map(); // translation cache in memory
let idb = null;
function openDB() {
  return new Promise(res => {
    try {
      const r = indexedDB.open("lean-taiyaku", 1); // name from before the rename, kept so saved translations stay
      r.onupgradeneeded = () => r.result.createObjectStore("tr");
      r.onsuccess = () => { idb = r.result; res(idb); };
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
function idbAll() {
  return new Promise(res => {
    if (!idb) return res([]);
    try {
      const out = []; const tx = idb.transaction("tr"); const st = tx.objectStore("tr");
      const rq = st.openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
      rq.onerror = () => res(out);
    } catch (e) { res([]); }
  });
}
function idbPut(k, v) { try { if (idb) idb.transaction("tr", "readwrite").objectStore("tr").put(v, k); } catch (e) { } }

// ---------- state ----------
const S = {
  uiMode: LS.get("uiMode", LS.get("ui", "auto")),
  lang: LS.get("lang", null), style: LS.get("style", "normal"), view: LS.get("view", "both"),
  tier: LS.get("tier", "default"), model: LS.get("model", "claude-sonnet-5-5"),
  apiKey: LS.get("apiKey", ""), ghToken: LS.get("ghToken", ""), remember: LS.get("remember", false),
  source: null, paths: [], texts: new Map(), blocks: new Map(), cur: null, hist: [],
  idxFiles: new Map(), idx: new Map(), ctxCount: 0,
  sample: null, inArtifact: !!(window.claude && typeof window.claude.use === "function"),
  job: null, confirmArm: 0,
};
// First visit: Japanese if the browser ranks any Japanese above any English, otherwise English.
function defaultLang() {
  const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]).map(x => String(x).toLowerCase());
  const rank = p => { const i = prefs.findIndex(n => n === p || n.startsWith(p + "-")); return i < 0 ? Infinity : i; };
  return rank("ja") < rank("en") ? "日本語" : "English";
}
if (!S.lang) S.lang = defaultLang();
// The interface follows the selected language unless Settings pins one; languages without
// built-in strings fall back to English.
function uiCode() {
  if (S.uiMode && S.uiMode !== "auto" && UI[S.uiMode]) return S.uiMode;
  const L = LANGS.find(l => l.name === S.lang);
  return L ? L.ui : "en";
}
// Language code of translations, the glossary and "Ask Claude" ("" = unknown, for a typed-in language).
function trCode() { const L = LANGS.find(l => l.name === S.lang); return L ? L.ui : ""; }
// A lang attribute for content in language c, only where it differs from the interface (fonts follow it).
const langAttr = c => c === uiCode() ? "" : ` lang="${esc(c)}"`;
// Language menus: each option is marked with its own language, and the closed control takes the
// language of the selected option, so every language name is drawn in that language's fonts.
const syncSelLang = sel => { const o = sel.selectedOptions[0]; sel.lang = o ? o.lang : ""; };
const scroller = () => getComputedStyle($("#main")).overflowY === "auto" ? $("#main") : (document.scrollingElement || document.documentElement);
const t = (k, ...a) => { const d = UI[uiCode()] || UI.en; let v = d[k]; if (v === undefined) v = UI.en[k]; return typeof v === "function" ? v(...a) : (v ?? k); };

function keyFor(path, b) { return `${S.lang}|${S.style}|${CORE.hashStr(path + "\n" + b.text)}`; }
function getTr(path, b) { return MEM.get(keyFor(path, b)) || null; }
function putTr(path, b, tr, model) {
  const k = keyFor(path, b);
  const v = { tr, path, id: b.id, name: b.name || "", repo: S.source ? S.source.label : "", lang: S.lang, style: S.style, model, at: Date.now() };
  MEM.set(k, v); idbPut(k, v);
}

// ---------- sources ----------
class MemorySource {
  constructor(label, files, note) { this.label = label; this.files = files; this.note = note; this.kind = "demo"; }
  async init() { return Object.keys(this.files); }
  async read(p) { if (!(p in this.files)) throw new Error("not found: " + p); return this.files[p]; }
}
class ZipSource {
  constructor(file) { this.file = file; this.label = file.name; this.kind = "zip"; }
  async init() {
    if (!window.JSZip) throw new Error("JSZip did not load");
    this.zip = await JSZip.loadAsync(this.file);
    const names = Object.keys(this.zip.files).filter(n => !this.zip.files[n].dir);
    const tops = new Set(names.map(n => n.split("/")[0]));
    this.prefix = (tops.size === 1 && names.every(n => n.includes("/"))) ? [...tops][0] + "/" : "";
    if (this.prefix) this.label = this.prefix.slice(0, -1);
    return names.map(n => n.slice(this.prefix.length));
  }
  async read(p) { const f = this.zip.file(this.prefix + p); if (!f) throw new Error("not found: " + p); return f.async("string"); }
}
class FolderSource {
  constructor(fileList) { this.list = [...fileList]; this.kind = "folder"; const first = this.list[0]; this.label = first ? (first.webkitRelativePath || first.name).split("/")[0] : "folder"; }
  async init() {
    this.map = new Map();
    for (const f of this.list) { const rp = f.webkitRelativePath || f.name; const p = rp.includes("/") ? rp.split("/").slice(1).join("/") : rp; this.map.set(p, f); }
    return [...this.map.keys()];
  }
  async read(p) { const f = this.map.get(p); if (!f) throw new Error("not found: " + p); return f.text(); }
}
class GitHubSource {
  constructor(parsed, token) { this.p = parsed; this.token = token; this.kind = "github"; this.label = `${parsed.owner}/${parsed.repo}`; }
  hdr(accept) { const h = { Accept: accept || "application/vnd.github+json" }; if (this.token) h.Authorization = "Bearer " + this.token; return h; }
  async api(path, accept) {
    let r;
    try { r = await fetch("https://api.github.com" + path, { headers: this.hdr(accept) }); }
    catch (e) { const er = new Error(S.inArtifact ? t("ghInArtifact") : t("ghNet")); er.net = true; throw er; }
    if (r.status === 404) throw Object.assign(new Error(t("gh404")), { status: 404 });
    if (r.status === 401) throw Object.assign(new Error(t("gh401")), { status: 401 });
    if (r.status === 403 || r.status === 429) { if (r.headers.get("x-ratelimit-remaining") === "0") throw new Error(t("ghRate")); throw new Error("GitHub " + r.status + ": " + (await r.text()).slice(0, 200)); }
    if (!r.ok) throw new Error("GitHub " + r.status);
    return r;
  }
  async init() {
    const { owner, repo, refPath } = this.p;
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    let ref = null, sub = [];
    if (refPath && refPath.length) {
      for (let k = 1; k <= Math.min(4, refPath.length); k++) {
        const cand = refPath.slice(0, k).join("/");
        try { const r = await this.api(`${base}/commits/${encodeURIComponent(cand)}`, "application/vnd.github.sha"); this.sha = (await r.text()).trim(); ref = cand; sub = refPath.slice(k); break; }
        catch (e) { if (e.net) throw e; }
      }
    }
    if (!ref) {
      const info = await (await this.api(base)).json();
      ref = info.default_branch;
      const r = await this.api(`${base}/commits/${encodeURIComponent(ref)}`, "application/vnd.github.sha");
      this.sha = (await r.text()).trim();
    }
    this.ref = ref; this.base = base; this.label = `${owner}/${repo} @ ${ref} (${this.sha.slice(0, 7)})`;
    if (sub.length) this.openPath = sub.join("/");
    const tree = await (await this.api(`${base}/git/trees/${this.sha}?recursive=1`)).json();
    this.truncated = !!tree.truncated;
    return tree.tree.filter(e => e.type === "blob").map(e => e.path);
  }
  async read(p) {
    const r = await this.api(`${this.base}/contents/${p.split("/").map(encodeURIComponent).join("/")}?ref=${this.sha}`, "application/vnd.github.raw+json");
    return r.text();
  }
}

// ---------- translator ----------
async function callLLM(prompt, onText, signal, opts = {}) {
  if (S.sample) {
    const r = await S.sample(prompt, { onText: ({ text }) => onText && onText(text), signal, modelTier: opts.tier || S.tier, cache: false });
    return { text: r.text, truncated: r.truncated, model: "claude (" + (r.modelTierApplied || S.tier) + ")" };
  }
  if (S.apiKey) {
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal,
        headers: { "x-api-key": S.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: S.model, max_tokens: opts.maxTokens || 16000, messages: [{ role: "user", content: prompt }] })
      });
    } catch (e) { if (e.name === "AbortError") throw { code: "cancelled" }; throw new Error((S.inArtifact ? "claude.ai " : "") + "api.anthropic.com: " + e.message); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`API ${r.status}: ${(data.error && data.error.message) || ""}`);
    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    return { text, truncated: data.stop_reason === "max_tokens", model: data.model || S.model };
  }
  throw new Error(t("noEngine"));
}

// ---------- rendering helpers ----------
let katexOK = false;
function renderMath(tex, display) {
  if (window.katex) {
    try { return katex.renderToString(tex, { displayMode: display, output: "mathml", throwOnError: false, strict: false }); } catch (e) { }
  }
  return `<code class="tex">${esc(tex)}</code>`;
}
function renderRich(src) {
  if (!src) return "";
  const ph = [];
  const hold = html => { ph.push(html); return `\u0000${ph.length - 1}\u0000`; };
  let s = String(src);
  s = s.replace(/`([^`\n]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`));
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => hold(`<div class="dm">${renderMath(m.trim(), true)}</div>`));
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => hold(`<div class="dm">${renderMath(m.trim(), true)}</div>`));
  s = s.replace(/(^|[^\\])\$([^$\n]+?)\$/g, (_, pre, m) => pre + hold(renderMath(m, false)));
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => hold(renderMath(m, false)));
  s = esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  const paras = s.split(/\n\s*\n/);
  const html = paras.map(p => {
    const lines = p.split("\n");
    const isUl = l => /^\s*([-*・•])\s+/.test(l), isOl = l => /^\s*\d+[.)]\s+/.test(l);
    if (lines.every(l => isUl(l) || !l.trim())) return "<ul>" + lines.filter(l => l.trim()).map(l => `<li>${l.replace(/^\s*([-*・•])\s+/, "")}</li>`).join("") + "</ul>";
    if (lines.every(l => isOl(l) || !l.trim())) return "<ol>" + lines.filter(l => l.trim()).map(l => `<li>${l.replace(/^\s*\d+[.)]\s+/, "")}</li>`).join("") + "</ol>";
    const h = /^#{1,4}\s+(.*)$/.exec(p.trim());
    if (h && lines.length === 1) return `<p class="h">${h[1]}</p>`;
    // mixed: lines before a list then list
    let out = "", buf = [], list = [];
    const flush = () => { if (buf.length) { out += `<p>${buf.join("<br>")}</p>`; buf = []; } if (list.length) { out += "<ul>" + list.map(x => `<li>${x}</li>`).join("") + "</ul>"; list = []; } };
    for (const l of lines) { if (isUl(l)) { if (buf.length) { out += `<p>${buf.join("<br>")}</p>`; buf = []; } list.push(l.replace(/^\s*([-*・•])\s+/, "")); } else { if (list.length) flush(); if (l.trim()) buf.push(l); } }
    flush();
    return out;
  }).join("");
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => ph[+i]);
}

const KW = new Set("theorem lemma def abbrev structure inductive class instance axiom opaque example where if then else match with fun λ let have show from by do return namespace end open section variable import deriving calc termination_by decreasing_by private protected noncomputable partial unsafe mutual universe set_option attribute at in for unless mut extends suffices only using generalizing macro syntax notation".split(" "));
const TACTIC = new Set("intro intros exact apply refine rw rwa simp simp_all omega decide rfl unfold cases rcases obtain induction constructor use by_cases split linarith nlinarith norm_num ring field_simp aesop trivial contradiction exfalso subst rename_i generalize specialize congr ext funext suffices exists left right push_neg positivity gcongr tauto first repeat try all_goals any_goals next assumption sorry native_decide simp_arith norm_cast exact_mod_cast change conv calc nofun nomatch injection rintro dsimp simpa simp? set case symm trans grind iterate focus done clear revert delta push_cast erw choose subst_vars ac_rfl by_contra contrapose interval_cases fin_cases simp_rw nth_rewrite nth_rw refine' split_ifs bv_decide exact? apply? rw? ring_nf linear_combination zify absurd".split(" "));
const TYPES = new Set("Prop Type Sort Int Nat Option Except Bool String List Array Unit True False Decidable Fin UInt64 Char Float".split(" "));
function hlLean(text) {
  // returns array of html lines
  const lines = text.split("\n");
  let depth = 0, inStr = false;
  const out = [];
  const symRe = /^(<;>|<\$>|>>=|\|>\.|\|>|<\||:=|=>|::|\+\+|#\[|!\[|←|→|↔|↦|∀|∃|¬|∧|∨|≠|≤|≥|∈|∉|⊆|∩|∪|∑|∏|⟨|⟩|‹|↑|∘|×|·|▸|∣|⁻¹|≡|•|\^\^\^|&&&|\|\|\||\?_|%|\/|@(?=[A-Za-z_\[]))/;
  for (const l of lines) {
    let h = "", i = 0;
    while (i < l.length) {
      const c = l[i], n = l[i + 1];
      if (inStr) { let j = i; while (j < l.length && l[j] !== '"') { if (l[j] === "\\") j++; j++; } h += `<span class="s">${esc(l.slice(i, Math.min(j + 1, l.length)))}</span>`; if (j < l.length) inStr = false; i = j + 1; continue; }
      if (depth > 0 || (c === "/" && n === "-")) {
        let j = i, d = depth;
        while (j < l.length) { if (l[j] === "/" && l[j + 1] === "-") { d++; j += 2; continue; } if (l[j] === "-" && l[j + 1] === "/") { d--; j += 2; if (d === 0) break; continue; } j++; }
        h += `<span class="c">${esc(l.slice(i, j))}</span>`; depth = d; i = j; continue;
      }
      if (c === "-" && n === "-") { h += `<span class="c">${esc(l.slice(i))}</span>`; break; }
      if (c === '"') { inStr = true; let j = i + 1; while (j < l.length && l[j] !== '"') { if (l[j] === "\\") j++; j++; } h += `<span class="s">${esc(l.slice(i, Math.min(j + 1, l.length)))}</span>`; if (j < l.length) inStr = false; i = j + 1; continue; }
      const m = /^[A-Za-z_α-κμ-ωΑ-Ω][A-Za-z0-9_'!?α-ωΑ-Ω₀-₉]*(?:\.[A-Za-z_α-ωΑ-Ω][A-Za-z0-9_'!?α-ωΑ-Ω₀-₉]*)*/.exec(l.slice(i));
      if (m && !/[A-Za-z0-9_']/.test(l[i - 1] || "")) {
        const w = m[0];
        const cls = KW.has(w) ? "k" : TACTIC.has(w) ? "t" : TYPES.has(w) ? "ty" : "i";
        h += `<span class="${cls} tok" data-t="${esc(w)}">${esc(w)}</span>`; i += w.length; continue;
      }
      const nm = /^\d+/.exec(l.slice(i));
      if (nm && !/[A-Za-z_]/.test(l[i - 1] || "")) { h += `<span class="n">${nm[0]}</span>`; i += nm[0].length; continue; }
      const sm = symRe.exec(l.slice(i));
      if (sm) { h += `<span class="y tok" data-t="${esc(sm[0])}">${esc(sm[0])}</span>`; i += sm[0].length; continue; }
      if (c === "λ") { h += `<span class="k tok" data-t="λ">λ</span>`; i++; continue; }
      h += esc(c); i++;
    }
    out.push(h || " ");
  }
  return out;
}

function structDesc(b) {
  const out = [];
  for (const l of b.text.split("\n")) {
    let m;
    if ((m = /^(?:public\s+|meta\s+)*import\s+(.+)/.exec(l))) out.push(t("sdImport", m[1]));
    else if ((m = /^namespace\s+(\S+)/.exec(l))) out.push(t("sdNs", m[1]));
    else if ((m = /^open\s+(.+)/.exec(l))) out.push(t("sdOpen", m[1]));
    else if ((m = /^end\s*(\S*)/.exec(l))) out.push(m[1] ? t("sdEnd", m[1]) : t("sdEndSec"));
    else if (/^(?:noncomputable\s+|public\s+)?section/.test(l)) out.push(t("sdSection"));
    else if (/^set_option/.test(l)) out.push(t("sdOpt"));
    else if (/^module\b/.test(l)) out.push(t("sdModule"));
  }
  return out.join(" / ");
}

function kindOf(b) {
  if (b.cls !== "decl") return b.cls;
  if (b.kw === "def" && /:\s*Prop\s*:=/.test(CORE.statementPart(b.text).replace(/\s+/g, " ") + ":=")) return "prop";
  return b.kw;
}
function kindLabel(k) { const K = t("kinds"); return (K && K[k]) || k; }

// ---------- UI building ----------
function setStatus(msg, kind) { const el = $("#status"); el.textContent = msg || ""; el.dataset.kind = kind || ""; }
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.tm); toast.tm = setTimeout(() => el.hidden = true, 2600); }

function applyUI() {
  document.documentElement.lang = uiCode();
  $$("[data-i]").forEach(el => el.textContent = t(el.dataset.i));
  $$("[data-ph]").forEach(el => el.placeholder = t(el.dataset.ph));
  const ls = $("#lang"); ls.innerHTML = LANGS.map(l => `<option lang="${l.ui}"${l.name === S.lang ? " selected" : ""}>${l.name}</option>`).join("") + (LANGS.some(l => l.name === S.lang) ? "" : `<option lang="" selected>${esc(S.lang)}</option>`) + `<option value="__other" lang="${uiCode()}">${t("other")}</option>`;
  syncSelLang(ls);
  if (S.paths.length) $("#repoCount").textContent = t("repoLoaded", S.paths.filter(p => p.endsWith(".lean")).length);
  if (S.source && S.source.kind === "demo") $("#repoNote").textContent = t("demoNote");
  showGlossProg();
  $("#style").innerHTML = ["brief", "normal", "detail"].map(s => `<option value="${s}" ${s === S.style ? "selected" : ""}>${t(s)}</option>`).join("");
  $$("#viewSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === S.view));
  $("#blocks").dataset.view = S.view;
}

function buildTree() {
  const tree = $("#tree"); const q = $("#filter").value.trim().toLowerCase();
  const lean = S.paths.filter(p => p.endsWith(".lean"));
  if (!lean.length) { tree.innerHTML = `<p class="muted pad">${t("noLean")}</p>`; return; }
  if (q) {
    const hits = lean.filter(p => p.toLowerCase().includes(q)).slice(0, 400);
    tree.innerHTML = hits.map(p => `<button class="f ${p === S.cur ? "on" : ""}" data-p="${esc(p)}" title="${esc(p)}"><span>${esc(p.split("/").pop())}</span><small>${esc(p.split("/").slice(0, -1).join("/"))}</small></button>`).join("");
    return;
  }
  const root = {};
  for (const p of lean) { let n = root; const parts = p.split("/"); parts.forEach((s, i) => { if (i === parts.length - 1) { (n.__f || (n.__f = [])).push(p); } else n = n[s] || (n[s] = {}); }); }
  // collapse single-child chains
  const curDirs = S.cur ? S.cur.split("/").slice(0, -1) : [];
  const render = (n, prefix, depth) => {
    let h = "";
    const dirs = Object.keys(n).filter(k => k !== "__f").sort();
    for (let d of dirs) {
      let node = n[d], name = d, path = prefix ? prefix + "/" + d : d;
      while (Object.keys(node).length === 1 && !node.__f) { const k = Object.keys(node)[0]; name += "/" + k; path += "/" + k; node = node[k]; }
      const open = depth < 1 || (S.cur && S.cur.startsWith(path + "/")) || Object.keys(n).length <= 2;
      h += `<details ${open ? "open" : ""}><summary>${esc(name)}</summary><div class="sub">${render(node, path, depth + 1)}</div></details>`;
    }
    for (const p of (n.__f || []).sort()) h += `<button class="f ${p === S.cur ? "on" : ""}" data-p="${esc(p)}" title="${esc(p)}"><span>${esc(p.split("/").pop())}</span></button>`;
    return h;
  };
  tree.innerHTML = render(root, "", 0);
}

async function loadSource(src) {
  setStatus(t("loading"));
  $("#repoLabel").textContent = "…";
  S.job && S.job.abort();
  try {
    const paths = await src.init();
    S.source = src; S.paths = paths; S.lastFailed = null; $("#hint").hidden = true;
    if (!S.inArtifact && src.kind !== "github" && location.search) { try { history.replaceState(null, "", location.pathname); } catch (e) { } } S.texts.clear(); S.blocks.clear(); S.idxFiles.clear(); S.idx = new Map(); S.hist = []; S.cur = null;
    $("#repoLabel").textContent = src.label;
    $("#repoNote").textContent = src.note || (src.truncated ? t("treeTrunc") : "");
    $("#repoNote").hidden = !$("#repoNote").textContent;
    const lean = paths.filter(p => p.endsWith(".lean"));
    $("#repoCount").textContent = t("repoLoaded", lean.length);
    buildTree();
    setStatus("");
    const nb = await loadBundles(src, paths);
    if (nb) setStatus(t("bundled", nb));
    let first = src.openPath && lean.find(p => p === src.openPath || p.startsWith(src.openPath + "/"));
    if (!first) first = src.startPath || lean.find(p => /(^|\/)(Main|Basic)\.lean$/.test(p)) || lean[0];
    let fid = null;
    if (first && src.focus && first === src.openPath) {
      const bl = await blocksOf(first).catch(() => []);
      const fb = bl.find(b => src.focus.decl && b.name === src.focus.decl) || bl.find(b => b.id === src.focus.id);
      fid = fb ? fb.id : null;
    }
    if (first) await openFile(first, fid, false);
  } catch (e) {
    setStatus(e.message || String(e), "err");
    if (src.kind === "github") { S.lastFailed = (e.status === 404 || e.status === 401) ? src : null; showGhHint(src.p, e.status); }
  }
}
async function loadBundles(src, paths) {
  let n = 0;
  // .taiyak/*.json; .lean-taiyaku/ is the directory name from before the rename and is still read.
  // The legacy files go first, so .taiyak/ wins where both have a block.
  const isNew = p => p.startsWith(".taiyak/");
  for (const bp of paths.filter(p => /^\.(taiyak|lean-taiyaku)\/[^/]+\.json$/.test(p)).sort((a, b) => isNew(a) - isNew(b))) {
    try {
      const d = JSON.parse(await src.read(bp));
      for (const [k, v] of Object.entries(d.entries || {})) {
        if (!v || !v.tr) continue;
        if (!MEM.has(k) || MEM.get(k).bundled) { MEM.set(k, { ...v, bundled: true, model: (v.model || "") + " · bundled" }); n++; }
      }
    } catch (e) { }
  }
  return n;
}
function linkable() { return !S.inArtifact && S.source && S.source.kind === "github" && /^https?:/.test(location.protocol); }
function linkFor(path, b) {
  const s = S.source; const q = new URLSearchParams();
  q.set("repo", s.p.owner + "/" + s.p.repo);
  if (s.ref) q.set("ref", s.ref);
  if (path) q.set("path", path);
  if (b) { if (b.name) q.set("decl", b.name); else q.set("id", b.id); }
  q.set("lang", S.lang);
  return location.origin + location.pathname + "?" + q.toString();
}
function syncURL() {
  if (!linkable()) return;
  try { history.replaceState(null, "", linkFor(S.cur, null)); } catch (e) { }
}
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch (e) {
    try { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; } catch (e2) { return false; }
  }
}
const SITE = "https://taiyak.pages.dev";
// The site moved from side-by-side-lean-natural.pages.dev: send old links (with their query) to the new one.
const MOVED = location.hostname === "side-by-side-lean-natural.pages.dev";
if (MOVED) location.replace(SITE + location.pathname + location.search + location.hash);
function patURL(owner) {
  const origin = /^https?:/.test(location.protocol) ? location.origin : SITE;
  const q = new URLSearchParams({ name: "Taiyak (read)", description: `Read-only token for Taiyak (${origin}). Contents: read only.`, expires_in: "30", contents: "read" });
  if (owner) q.set("target_name", owner);
  return "https://github.com/settings/personal-access-tokens/new?" + q.toString();
}
function currentOwner() {
  const p = CORE.parseGitHubURL($("#url").value) || (S.source && S.source.p) || null;
  return p ? p.owner : "";
}
function showGhHint(p, status) {
  const el = $("#hint");
  if (!p) { el.hidden = true; return; }
  const zip = `https://github.com/${encodeURIComponent(p.owner)}/${encodeURIComponent(p.repo)}/archive/HEAD.zip`;
  if (S.inArtifact) {
    el.innerHTML = `${esc(t("ghInArtifact"))} <a href="${zip}" target="_blank" rel="noopener">${t("zipLink")}</a>`;
  } else if (status === 404 || status === 401) {
    el.innerHTML = `${esc(t("ghPrivateHint"))} <a href="${esc(patURL(p.owner))}" target="_blank" rel="noopener">${t("patLinkShort")}</a> → <button type="button" class="linkbtn" id="hintSettings">${t("openSettings")}</button> · <a href="${zip}" target="_blank" rel="noopener">${t("orZip")}</a>`;
  } else {
    el.innerHTML = `<a href="${zip}" target="_blank" rel="noopener">${t("zipLink")}</a>`;
  }
  el.hidden = false;
}

async function readFile(p) {
  if (S.texts.has(p)) return S.texts.get(p);
  const tx = await S.source.read(p);
  S.texts.set(p, tx);
  return tx;
}
async function blocksOf(p) {
  if (S.blocks.has(p)) return S.blocks.get(p);
  const b = CORE.splitLean(await readFile(p));
  S.blocks.set(p, b);
  return b;
}
function indexFile(p, blocks) {
  if (S.idxFiles.has(p)) return;
  S.idxFiles.set(p, blocks);
  S.idx = CORE.buildIndex([...S.idxFiles].map(([path, bl]) => ({ path, blocks: bl })));
}
// load imports (transitively, bounded) and index them
async function loadImports(p, maxFiles = 30, maxDepth = 3) {
  const seen = new Set([p]); let frontier = [p], depth = 0, count = 0;
  while (frontier.length && depth < maxDepth && count < maxFiles) {
    const next = [];
    for (const f of frontier) {
      const tx = await readFile(f).catch(() => null); if (tx == null) continue;
      for (const mod of CORE.importsOf(tx)) {
        const mp = CORE.modulePath(mod, S.paths);
        if (!mp || seen.has(mp)) continue;
        seen.add(mp); next.push(mp); count++;
        if (count >= maxFiles) break;
      }
      if (count >= maxFiles) break;
    }
    await Promise.all(next.map(async f => { try { indexFile(f, await blocksOf(f)); } catch (e) { } }));
    frontier = next; depth++;
  }
}

async function openFile(p, focusId, push = true) {
  if (push && S.cur) S.hist.push({ p: S.cur, y: scroller().scrollTop });
  if (S.cur === p && S.blocks.has(p) && document.getElementById("blk-" + (focusId || "b0"))) {
    $("#back").hidden = !S.hist.length;
    if (focusId) focusBlock(focusId); else scroller().scrollTop = 0;
    return;
  }
  S.cur = p; S.confirmArm = 0;
  $("#back").hidden = !S.hist.length;
  $$("#tree .f").forEach(b => b.classList.toggle("on", b.dataset.p === p));
  document.body.classList.remove("drawer");
  $("#path").textContent = p;
  $("#blocks").innerHTML = `<p class="muted pad">${t("loading")}</p>`;
  let blocks;
  try { blocks = await blocksOf(p); } catch (e) { $("#blocks").innerHTML = `<p class="err pad">${esc(e.message)}</p>`; return; }
  indexFile(p, blocks);
  renderBlocks(p, blocks);
  updateCounts();
  $("#copyLink").hidden = !linkable();
  syncURL();
  if (focusId) focusBlock(focusId); else scroller().scrollTop = 0;
  loadImports(p).then(() => { if (S.cur === p) markRefs(); }).catch(() => { });
}
function focusBlock(id) {
  const el = document.getElementById("blk-" + id);
  if (!el) return;
  el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600);
}

function renderBlocks(p, blocks) {
  const wrap = $("#blocks");
  const text = S.texts.get(p) || "";
  $("#meta").textContent = t("lines", text.split("\n").length);
  wrap.innerHTML = blocks.map(b => blockHTML(p, b)).join("");
  markRefs();
}
function codeHTML(b) {
  const hl = hlLean(b.text);
  const ps = CORE.proofSplit(b);
  const row = (h, i) => `<span class="ln" data-n="${b.start + i}"></span><span class="lc">${h}</span>`;
  if (!ps) return `<pre class="code">${hl.map(row).join("\n")}</pre>`;
  const head = hl.slice(0, ps.headLines).map(row).join("\n");
  const body = hl.slice(ps.headLines).map((h, i) => row(h, i + ps.headLines)).join("\n");
  return `<pre class="code">${head}</pre><button class="proofT" data-n="${ps.proofLines}">${t("showProof", ps.proofLines)}</button><pre class="code proof" hidden>${body}</pre>`;
}
function trHTML(p, b) {
  if (b.cls === "struct") return `<div class="tr struct"><p class="muted">${esc(structDesc(b))}</p></div>`;
  const v = getTr(p, b);
  if (!v) return `<div class="tr empty"><p class="muted">${t("notYet")}</p><button class="trOne" data-id="${b.id}">${t("translate")}</button></div>`;
  const tr = v.tr || {};
  const tl = langAttr(trCode()), ul = tl ? ` lang="${uiCode()}"` : "";
  const sec = (k, cls) => tr[k] && String(tr[k]).trim() ? `<div class="sec ${cls}"><div class="lbl"${ul}>${t(k)}</div>${renderRich(tr[k])}</div>` : "";
  return `<div class="tr"${tl}>
    ${tr.title ? `<h3 class="tt">${renderRich(tr.title).replace(/^<p>|<\/p>$/g, "")}</h3>` : ""}
    ${tr.math ? `<div class="mathbody">${renderRich(tr.math)}</div>` : ""}
    ${sec("proof", "pf")}${sec("lean", "lnote")}${sec("src", "sr")}
    <div class="foot"${ul}><span>${esc(v.model || "")}</span><button class="trOne ghost" data-id="${b.id}" data-re="1">${t("retranslate")}</button></div>
  </div>`;
}
function blockHTML(p, b) {
  const k = kindOf(b);
  const label = b.cls === "decl" ? `<span class="chip k-${esc(k)}">${esc(kindLabel(k))}</span>${b.name ? `<code class="nm">${esc(b.name)}</code>` : ""}` : `<span class="chip k-${b.cls}">${esc(kindLabel(b.cls))}</span>`;
  return `<section class="blk c-${b.cls}" id="blk-${b.id}" data-id="${b.id}">
    <div class="bh">${label}${linkable() ? `<button type="button" class="lines linkb" data-id="${b.id}" title="${esc(t("copyLink"))}">L${b.start}${b.end > b.start ? "–" + b.end : ""}</button>` : `<span class="lines">L${b.start}${b.end > b.start ? "–" + b.end : ""}</span>`}</div>
    <div class="pair"><div class="left">${codeHTML(b)}</div><div class="right">${trHTML(p, b)}</div></div>
  </section>`;
}
function rerenderBlock(p, b) {
  if (S.cur !== p) return;
  const el = document.getElementById("blk-" + b.id); if (!el) return;
  el.querySelector(".right").innerHTML = trHTML(p, b);
}
function updateCounts() {
  if (!S.cur) return;
  const bl = S.blocks.get(S.cur) || [];
  const need = bl.filter(b => b.cls !== "struct");
  const done = need.filter(b => getTr(S.cur, b)).length;
  $("#count").textContent = t("translated", done, need.length);
}
function markRefs() {
  $$("#blocks .tok.i").forEach(el => {
    const hits = CORE.lookupIdent(S.idx, el.dataset.t);
    if (hits && hits.length) el.classList.add("ref");
  });
}

// ---------- translation jobs ----------
async function translate(p, which, opts = {}) {
  if (S.job) return;
  if (!S.sample && !S.apiKey) { setStatus(t("noEngine"), "err"); openSettings(); return; }
  const all = await blocksOf(p);
  const fileText = await readFile(p);
  let todo = which.filter(b => b.cls !== "struct" && (opts.force || !getTr(p, b)));
  if (!todo.length) return;
  const chunks = CORE.chunkBlocks(todo);
  if (chunks.length > 6 && !opts.confirmed) {
    if (S.confirmArm !== chunks.length) { S.confirmArm = chunks.length; setStatus(t("confirmMany", chunks.length), "warn"); return; }
  }
  S.confirmArm = 0;
  const ctl = new AbortController(); S.job = ctl;
  document.body.classList.add("busy");
  todo.forEach(b => { const el = document.getElementById("blk-" + b.id); el && el.classList.add("pending"); });
  try {
    setStatus(t("loading"));
    await loadImports(p);
    markRefs();
    const ctx = CORE.collectContext(p, all, S.idx);
    for (let i = 0; i < chunks.length; i++) {
      if (ctl.signal.aborted) break;
      const chunk = chunks[i];
      let prompt = CORE.buildPrompt({ repoLabel: S.source.label, path: p, lang: S.lang, style: S.style, blocks: chunk, allBlocks: all, context: ctx, fileText });
      if (new Blob([prompt]).size > 230000) prompt = CORE.buildPrompt({ repoLabel: S.source.label, path: p, lang: S.lang, style: S.style, blocks: chunk, allBlocks: all, context: ctx.slice(0, 8000), fileText, elide: true });
      const pre = chunks.length > 1 ? t("chunkOf", i + 1, chunks.length) + " · " : "";
      setStatus(pre + t("thinking"));
      const t0 = Date.now();
      const tick = setInterval(() => { if ($("#status").dataset.kind !== "recv") setStatus(pre + t("thinking") + ` ${Math.round((Date.now() - t0) / 1000)}s`); }, 1000);
      let res;
      try {
        res = await callLLM(prompt, text => { setStatus(pre + t("receiving", text.length), "recv"); }, ctl.signal);
      } finally { clearInterval(tick); }
      const arr = CORE.parseReply(res.text);
      if (!arr.length) throw new Error(t("parseErr"));
      for (const o of arr) {
        const b = chunk.find(x => x.id === String(o.id)); if (!b) continue;
        putTr(p, b, { title: o.title || "", math: o.math || "", proof: o.proof || "", lean: o.lean || "", src: o.src || "" }, res.model);
        const el = document.getElementById("blk-" + b.id); el && el.classList.remove("pending");
        rerenderBlock(p, b);
      }
      updateCounts();
    }
    const left = todo.filter(b => !getTr(p, b)).length;
    if (ctl.signal.aborted) setStatus(t("stopped")); else if (left) setStatus(t("partial", left), "warn"); else setStatus(t("done"));
  } catch (e) {
    if (e && e.code === "cancelled") setStatus(t("stopped"));
    else if (e && e.code) setStatus(`${t("apiErr")}: ${e.code}${e.message ? " — " + e.message : ""}`, "err");
    else setStatus(`${t("apiErr")}: ${e && e.message || e}`, "err");
  } finally {
    S.job = null; document.body.classList.remove("busy");
    $$(".blk.pending").forEach(el => el.classList.remove("pending"));
  }
}

// ---------- popover ----------
function showPop(target, html) {
  const pop = $("#pop"); pop.innerHTML = html; pop.hidden = false;
  if (innerWidth < 720) { pop.classList.add("sheet"); pop.style.left = pop.style.top = ""; return; }
  pop.classList.remove("sheet");
  const r = target.getBoundingClientRect(), w = Math.min(420, innerWidth - 32);
  pop.style.width = w + "px";
  let x = Math.min(Math.max(16, r.left), innerWidth - w - 16);
  let y = r.bottom + 6; pop.style.left = x + "px"; pop.style.top = y + "px";
  const ph = pop.offsetHeight; if (y + ph > innerHeight - 8) pop.style.top = Math.max(8, r.top - ph - 6) + "px";
}
function hidePop() { $("#pop").hidden = true; tickAsk(); }
function tokenPop(el) {
  const w = el.dataset.t;
  let html = "";
  const hits = el.classList.contains("i") || el.classList.contains("ty") ? CORE.lookupIdent(S.idx, w) : null;
  if (hits && hits.length) {
    html += hits.slice(0, 4).map(h => {
      const v = getTr(h.path, h.block);
      return `<div class="pdef"><div class="pk">${t("defIn")}</div><code>${esc(h.block.full || h.block.name)}</code>
        <div class="muted small">${esc(h.path)}:${h.block.start}</div>
        ${v && v.tr.title ? `<div class="ptitle"${langAttr(trCode())}>${renderRich(v.tr.title)}</div>` : `<pre class="mini">${esc(CORE.statementPart(h.block.text).split("\n").filter(l => !/^\s*(\/--|--|@\[)/.test(l)).slice(0, 6).join("\n"))}</pre>`}
        <button class="jump" data-p="${esc(h.path)}" data-id="${h.block.id}">${t("jumpDef")}</button></div>`;
    }).join("");
  }
  let needGloss = false;
  if (GLOSSARY[w]) { html += glossHTML(w); needGloss = glossPending(w); }
  const blkEl = el.closest(".blk");
  let key = null;
  if (!(hits && hits.length) && blkEl && (S.sample || S.apiKey)) {
    key = askKey(w, blkEl.dataset.id);
    html += `<div class="pg"><div class="pk">${t("claudeSays")}</div><div class="askout" aria-live="polite" data-k="${esc(key)}" data-t="${esc(w)}" data-b="${esc(blkEl.dataset.id)}">${askHTML(key)}</div></div>`;
  }
  if (!html) return;
  showPop(el, html);
  $("#pop").dataset.k = key || "";
  tickAsk();
  if (needGloss) glossNow(w);
}

// ---------- glossary in other languages ----------
// Japanese and English are built in. For any other language the English text is translated
// by Claude: the word just clicked at once, the rest in the background with a progress chip.
const GL = new Map();        // `${lang}|${key}` -> translated text
const GLFAIL = new Set();    // `${lang}|${key}` that failed this session
const GLOSS_KEYS = Object.keys(GLOSSARY);
const GJ = { lang: null, ctl: null, total: 0, done: 0 };
function glossBuiltIn(lang) { return lang === "日本語" ? 0 : lang === "English" ? 1 : -1; }
function glossText(k) {
  const i = glossBuiltIn(S.lang);
  if (i >= 0) return { text: GLOSSARY[k][i], native: true };
  const v = GL.get(S.lang + "|" + k);
  return v ? { text: v, native: true } : { text: GLOSSARY[k][1], native: false };
}
function glossPending(k) { return !glossText(k).native && !!(S.sample || S.apiKey) && !GLFAIL.has(S.lang + "|" + k); }
function glossHTML(k) {
  const g = glossText(k);
  const gl = langAttr(g.native ? trCode() : "en"), ul = gl ? ` lang="${uiCode()}"` : "";
  return `<div class="pg" data-g="${esc(k)}"${gl}><div class="pk"${ul}>${t("glossary")}${g.native ? "" : ` · ${esc(t("glossInEnglish"))}`}</div><code>${esc(k)}</code> ${renderRich(g.text)}`
    + (glossPending(k) ? `<div class="askstat"${ul}><span class="spin" aria-hidden="true"></span><span>${t("glossWorking")}</span></div>` : "") + `</div>`;
}
function glossMissing(lang) { return GLOSS_KEYS.filter(k => !GL.has(lang + "|" + k)); }
function showGlossProg() {
  const el = $("#glossProg"); if (!el) return;
  if (!GJ.ctl || GJ.lang !== S.lang) { el.hidden = true; return; }
  el.hidden = false;
  el.querySelector(".lbl").textContent = t("glossProg", GJ.done, GJ.total);
  el.style.setProperty("--p", (GJ.total ? Math.round(GJ.done / GJ.total * 100) : 0) + "%");
}
async function glossTranslate(lang, keys, signal) {
  const src = {}; for (const k of keys) src[k] = GLOSSARY[k][1];
  const prompt = `Translate these short explanations of Lean 4 keywords, tactics and notation from English into ${lang}.
Keep everything inside backticks exactly as it is, and keep symbols and formulas unchanged.
Keep each explanation about as short as the original, and use the usual mathematical terminology of ${lang}.
Reply with only a JSON object that maps each key to its translation.

${JSON.stringify(src, null, 1)}`;
  const r = await callLLM(prompt, null, signal, { tier: "quick", maxTokens: 8000 });
  const obj = CORE.parseObject(r.text) || {};
  let n = 0;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) {
      GL.set(lang + "|" + k, v.trim());
      idbPut(`g|${lang}|${k}`, { gloss: v.trim(), lang, k, h: CORE.hashStr(GLOSSARY[k][1]) });
      n++;
    }
  }
  return n;
}
async function startGlossJob() {
  const lang = S.lang;
  if (GJ.ctl && GJ.lang === lang) return;
  if (GJ.ctl) GJ.ctl.abort();
  GJ.ctl = null;
  if (glossBuiltIn(lang) >= 0 || !(S.sample || S.apiKey) || !glossMissing(lang).length) { showGlossProg(); return; }
  const ctl = new AbortController();
  Object.assign(GJ, { lang, ctl, total: GLOSS_KEYS.length, done: GLOSS_KEYS.length - glossMissing(lang).length });
  showGlossProg();
  let fails = 0;
  try {
    while (!ctl.signal.aborted) {
      const todo = glossMissing(lang);
      GJ.done = GLOSS_KEYS.length - todo.length; showGlossProg();
      if (!todo.length) break;
      const n = await glossTranslate(lang, todo.slice(0, 40), ctl.signal);
      if (!n && ++fails >= 2) break;
    }
    if (!ctl.signal.aborted && !glossMissing(lang).length && S.lang === lang) toast(t("glossDone"));
  } catch (e) { /* stop quietly; English remains as the fallback */ }
  finally { if (GJ.ctl === ctl) GJ.ctl = null; showGlossProg(); }
}
async function glossNow(k) {
  const lang = S.lang;
  try { if (!(await glossTranslate(lang, [k]))) GLFAIL.add(lang + "|" + k); }
  catch (e) { GLFAIL.add(lang + "|" + k); }
  if (S.lang !== lang) return;
  const el = $(`#pop:not([hidden]) .pg[data-g="${CSS.escape(k)}"]`);
  if (el) el.outerHTML = glossHTML(k);
  if (GJ.lang === lang && GJ.ctl) { GJ.done = GLOSS_KEYS.length - glossMissing(lang).length; showGlossProg(); }
}

// "Ask Claude": one entry per (language, token, declaration); survives closing the popover.
const ASK = new Map(); // key -> {state: "pending"|"done"|"error", text, t0, t1, model, err, ctl, w}
function askKey(w, id) { const b = (S.blocks.get(S.cur) || []).find(x => x.id === id); return `${S.lang}|${w}|${CORE.hashStr((S.cur || "") + "\n" + (b ? b.text : id))}`; }
const secs = (a, b) => Math.max(0, Math.round(((b || Date.now()) - a) / 1000));
function askHTML(key) {
  const a = ASK.get(key);
  if (!a) return `<button type="button" class="jump askc">${t("askClaude")}</button>`;
  if (a.state === "pending") {
    return `<div class="askstat"><span class="spin" aria-hidden="true"></span><span>${a.text ? t("askWriting") : t("askWaiting")}</span><span class="el">${t("secs", secs(a.t0))}</span><button type="button" class="linkbtn askstop">${t("stop")}</button></div>`
      + (a.text ? `<div class="asktext"${langAttr(trCode())}>${esc(a.text)}</div>` : "");
  }
  if (a.state === "error") {
    return `<div class="askstat err">${esc(a.err)}</div><button type="button" class="jump askc">${t("askRetry")}</button>`;
  }
  return `<div class="asktext"${langAttr(trCode())}>${renderRich(a.text)}</div><div class="askfoot"><span class="dot" aria-hidden="true"></span>${t("askDone", secs(a.t0, a.t1))}${a.model ? " · " + esc(a.model) : ""}<button type="button" class="linkbtn askc">${t("askAgain")}</button></div>`;
}
function refreshAsk(key) {
  const out = $(`#pop:not([hidden]) .askout[data-k="${CSS.escape(key)}"]`);
  if (out) out.innerHTML = askHTML(key);
  return !!out;
}
let askTimer = null;
function tickAsk() {
  const k = $("#pop").dataset.k, a = k && ASK.get(k);
  if (a && a.state === "pending" && !$("#pop").hidden) {
    const el = $("#pop .askstat .el"); if (el) el.textContent = t("secs", secs(a.t0));
    if (!askTimer) askTimer = setInterval(tickAsk, 1000);
  } else if (askTimer) { clearInterval(askTimer); askTimer = null; }
}
async function askClaude(out) {
  const key = out.dataset.k, w = out.dataset.t, id = out.dataset.b;
  const prev = ASK.get(key); if (prev && prev.state === "pending") return;
  const path = S.cur;
  const b = (await blocksOf(path)).find(x => x.id === id); if (!b) return;
  const a = { state: "pending", text: "", t0: Date.now(), w, ctl: new AbortController() };
  ASK.set(key, a); refreshAsk(key); tickAsk();
  const prompt = `You explain Lean 4 code to a reader who knows mathematics but not Lean.
In ${S.lang}, explain in 2-4 short sentences what \`${w}\` means or does at this place in the declaration below.
If it is a tactic, say what it does to the goal here. If it is notation or a library name, say what it denotes.
Plain text only, Lean identifiers in backticks, formulas in $...$. Say so if it cannot be determined from this code alone.

File: ${path}
<decl>
${b.text.slice(0, 12000)}
</decl>`;
  try {
    const r = await callLLM(prompt, text => {
      const first = !a.text; a.text = text;
      const tx = $(`#pop:not([hidden]) .askout[data-k="${CSS.escape(key)}"] .asktext`);
      if (tx && !first) tx.textContent = text; else refreshAsk(key);
    }, a.ctl.signal, { tier: "quick", maxTokens: 800 });
    Object.assign(a, { state: "done", text: r.text.trim(), t1: Date.now(), model: r.model });
  } catch (e) {
    if (e && e.code === "cancelled" || (a.ctl.signal.aborted)) { ASK.delete(key); refreshAsk(key); tickAsk(); return; }
    Object.assign(a, { state: "error", err: `${t("apiErr")}: ${(e && (e.code || e.message)) || e}`, t1: Date.now() });
  }
  tickAsk();
  if (!refreshAsk(key)) toast(a.state === "done" ? t("askReady", w) : a.err);
}

// ---------- settings ----------
function openSettings() {
  const d = $("#settings");
  $("#sApiRow").hidden = S.inArtifact;
  $("#sDownload").hidden = S.inArtifact;
  $("#sClaudeRow").hidden = !S.sample;
  $("#sNote").textContent = S.sample ? t("sNoteArtifact") : t("sNoteStandalone");
  $("#apiKey").value = S.apiKey; $("#model").value = S.model; $("#ghToken").value = S.ghToken;
  $("#patLink").href = patURL(currentOwner());
  $("#remember").checked = S.remember;
  $("#uiLang").innerHTML = `<option value="auto" lang="${uiCode()}">${esc(t("uiAuto"))}</option>` + LANGS.map(L => `<option value="${L.ui}" lang="${L.ui}">${L.name}</option>`).join("");
  $("#uiLang").value = UI[S.uiMode] ? S.uiMode : "auto";
  syncSelLang($("#uiLang"));
  $("#tier").innerHTML = ["default", "complex", "quick"].map(v => `<option value="${v}" ${v === S.tier ? "selected" : ""}>${t("tier" + v[0].toUpperCase() + v.slice(1))}</option>`).join("");
  d.hidden = false; $("#apiKey").focus();
}
function saveSettings() {
  const oldGh = S.ghToken, hadKey = !!S.apiKey;
  S.apiKey = $("#apiKey").value.trim(); S.model = $("#model").value.trim() || "claude-sonnet-5-5"; S.ghToken = $("#ghToken").value.trim();
  if (S.ghToken && S.ghToken !== oldGh && S.lastFailed) { const f = S.lastFailed; S.lastFailed = null; $("#hint").hidden = true; setTimeout(() => { const gs = new GitHubSource(f.p, S.ghToken); gs.openPath = f.openPath; gs.focus = f.focus; loadSource(gs); }, 0); }
  S.remember = $("#remember").checked; S.tier = $("#tier").value || S.tier;
  LS.set("model", S.model); LS.set("tier", S.tier); LS.set("remember", S.remember);
  if (S.remember) { LS.set("apiKey", S.apiKey); LS.set("ghToken", S.ghToken); } else { LS.del("apiKey"); LS.del("ghToken"); }
  setEngineLabel();
  const um = $("#uiLang").value; if (um !== S.uiMode) { S.uiMode = um; LS.set("uiMode", um); LS.del("ui"); applyUI(); refresh(); }
  if (!hadKey && S.apiKey) startGlossJob();
}
function exportJSON() {
  const have = new Set(S.paths);
  const rows = [...MEM].filter(([k, v]) => v && v.tr && have.has(v.path) && (!v.demo || (S.source && S.source.kind === "demo")));
  rows.sort((a, b) => (a[1].lang + a[1].path).localeCompare(b[1].lang + b[1].path) || (parseInt(String(a[1].id).slice(1)) - parseInt(String(b[1].id).slice(1))));
  const entries = {};
  for (const [k, v] of rows) entries[k] = { path: v.path, id: v.id, name: v.name || "", lang: v.lang, style: v.style, model: String(v.model || "").replace(/ · bundled$/, ""), at: v.at || null, tr: v.tr };
  return JSON.stringify({ format: "taiyak/1", repo: S.source ? S.source.label : "", exported: new Date().toISOString(), entries }, null, 1);
}

// ---------- events ----------
function bind() {
  $("#srcForm").addEventListener("submit", e => {
    e.preventDefault();
    const p = CORE.parseGitHubURL($("#url").value);
    if (!p) { setStatus("URL?", "err"); return; }
    $("#hint").hidden = true;
    loadSource(new GitHubSource(p, S.ghToken));
  });
  $("#zipIn").addEventListener("change", e => { const f = e.target.files[0]; if (f) { $("#hint").hidden = true; loadSource(new ZipSource(f)); } e.target.value = ""; });
  $("#dirIn").addEventListener("change", e => { if (e.target.files.length) { $("#hint").hidden = true; loadSource(new FolderSource(e.target.files)); } e.target.value = ""; });
  document.addEventListener("dragover", e => { e.preventDefault(); });
  document.addEventListener("drop", e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /\.zip$/i.test(f.name)) loadSource(new ZipSource(f)); });
  $("#lang").addEventListener("change", e => {
    if (e.target.value === "__other") { syncSelLang(e.target); $("#otherLang").hidden = false; $("#otherLang").focus(); return; }
    S.lang = e.target.value; LS.set("lang", S.lang); $("#otherLang").hidden = true; applyUI(); refresh(); startGlossJob();
  });
  $("#otherLang").addEventListener("change", e => { const v = e.target.value.trim(); if (v) { S.lang = v; LS.set("lang", v); applyUI(); refresh(); startGlossJob(); } e.target.hidden = true; });
  $("#uiLang").addEventListener("change", e => syncSelLang(e.target));
  $("#style").addEventListener("change", e => { S.style = e.target.value; LS.set("style", S.style); refresh(); });
  $("#viewSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.view = b.dataset.v; LS.set("view", S.view); applyUI(); });
  $("#filter").addEventListener("input", buildTree);
  $("#tree").addEventListener("click", e => { const b = e.target.closest(".f"); if (b) openFile(b.dataset.p); });
  $("#trFile").addEventListener("click", async () => { if (S.cur) translate(S.cur, await blocksOf(S.cur)); });
  $("#stop").addEventListener("click", () => S.job && S.job.abort());
  $("#copyLink").addEventListener("click", async () => { if (S.cur && await copyText(linkFor(S.cur, null))) toast(t("linkCopied")); });
  $("#back").addEventListener("click", () => { const h = S.hist.pop(); if (h) openFile(h.p, null, false).then(() => { scroller().scrollTop = h.y; }); $("#back").hidden = !S.hist.length; });
  $("#blocks").addEventListener("click", async e => {
    const tb = e.target.closest(".trOne");
    if (tb) { const bl = await blocksOf(S.cur); const b = bl.find(x => x.id === tb.dataset.id); if (b) translate(S.cur, [b], { force: !!tb.dataset.re, confirmed: true }); return; }
    const lb = e.target.closest(".linkb");
    if (lb) { const bl = await blocksOf(S.cur); const b = bl.find(x => x.id === lb.dataset.id); if (b && await copyText(linkFor(S.cur, b))) toast(t("linkCopied")); return; }
    const pt = e.target.closest(".proofT");
    if (pt) { const pr = pt.nextElementSibling; pr.hidden = !pr.hidden; pt.textContent = pr.hidden ? t("showProof", pt.dataset.n) : t("hideProof"); return; }
    const tok = e.target.closest(".tok");
    if (tok) { e.stopPropagation(); tokenPop(tok); return; }
  });
  $("#pop").addEventListener("click", e => {
    const out = e.target.closest(".askout");
    if (out && e.target.closest(".askstop")) { const a = ASK.get(out.dataset.k); if (a && a.ctl) a.ctl.abort(); return; }
    if (out && e.target.closest(".askc")) { const a = ASK.get(out.dataset.k); if (a && a.state !== "pending") ASK.delete(out.dataset.k); askClaude(out); return; }
    const j = e.target.closest(".jump"); if (j) { hidePop(); openFile(j.dataset.p, j.dataset.id); }
  });
  document.addEventListener("click", e => { const path = e.composedPath ? e.composedPath() : []; if (!path.includes($("#pop")) && !(e.target.closest && e.target.closest(".tok"))) hidePop(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { hidePop(); $("#settings").hidden = true; $("#aboutBox").hidden = true; } });
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#hint").addEventListener("click", e => { if (e.target.closest("#hintSettings")) openSettings(); });
  $("#sClose").addEventListener("click", () => { saveSettings(); $("#settings").hidden = true; });
  $("#settings").addEventListener("click", e => { if (e.target.id === "settings") { saveSettings(); $("#settings").hidden = true; } });
  $("#sCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(exportJSON()); toast(t("copied")); } catch (e) { $("#sImportTxt").value = exportJSON(); $("#sImportTxt").select(); } });
  $("#sDownload").addEventListener("click", () => {
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: "application/json" })); a.download = "taiyak.json"; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { }
  });
  const doImport = txt => {
    try { const d = JSON.parse(txt); let n = 0; for (const [k, v] of Object.entries(d.entries || {})) { MEM.set(k, v); idbPut(k, v); n++; } toast(t("imported", n)); refresh(); } catch (e) { toast(e.message); }
  };
  $("#sImportFile").addEventListener("change", async e => { const f = e.target.files[0]; if (f) doImport(await f.text()); e.target.value = ""; });
  $("#sImportBtn").addEventListener("click", () => doImport($("#sImportTxt").value));
  $("#drawerBtn").addEventListener("click", () => document.body.classList.toggle("drawer"));
  $("#scrim").addEventListener("click", () => document.body.classList.remove("drawer"));
  $("#aboutBtn").addEventListener("click", () => { $("#aboutBox").hidden = !$("#aboutBox").hidden; });
}
function refresh() { if (S.cur && S.blocks.get(S.cur)) { const sc = scroller(), y = sc.scrollTop; renderBlocks(S.cur, S.blocks.get(S.cur)); sc.scrollTop = y; updateCounts(); } }

// ---------- boot ----------
async function boot() {
  applyUI(); bind();
  $("#hint").hidden = true;
  // demo data
  const demo = JSON.parse(document.getElementById("demo-data").textContent);
  const demoTr = JSON.parse(document.getElementById("demo-tr").textContent);
  for (const [lang, byPath] of Object.entries(demoTr)) {
    for (const [p, m] of Object.entries(byPath)) {
      const bl = CORE.splitLean(demo.files[p]);
      for (const b of bl) { const tr = m[b.id]; if (!tr) continue; const k = `${lang}|normal|${CORE.hashStr(p + "\n" + b.text)}`; MEM.set(k, { tr, path: p, id: b.id, name: b.name || "", repo: demo.label, lang, style: "normal", model: "Claude (demo)", demo: true }); }
    }
  }
  await openDB();
  for (const [k, v] of await idbAll()) {
    if (String(k).startsWith("g|")) { if (v && v.gloss && GLOSSARY[v.k] && v.h === CORE.hashStr(GLOSSARY[v.k][1])) GL.set(v.lang + "|" + v.k, v.gloss); }
    else if (!MEM.has(k)) MEM.set(k, v);
  }
  const q = new URLSearchParams(S.inArtifact ? "" : location.search);
  if (q.get("lang")) { S.lang = q.get("lang"); applyUI(); }
  const qp = q.get("repo") && CORE.parseGitHubURL(q.get("repo"));
  if (qp) {
    if (q.get("ref")) qp.refPath = q.get("ref").split("/");
    const gs = new GitHubSource(qp, S.ghToken);
    gs.openPath = q.get("path") || "";
    gs.focus = { decl: q.get("decl"), id: q.get("id") };
    $("#url").value = `https://github.com/${qp.owner}/${qp.repo}`;
    await loadSource(gs);
  } else {
    const src = new MemorySource(demo.label, demo.files, t("demoNote"));
    src.startPath = demo.start;
    await loadSource(src);
  }
  // translator availability
  if (S.inArtifact) {
    try { S.sample = await window.claude.use("sample"); } catch (e) { S.sample = null; }
  }
  setEngineLabel();
  startGlossJob();
}
function setEngineLabel() {
  const el = $("#engine");
  el.textContent = S.sample ? "Claude" : (S.apiKey ? S.model : "—");
  el.classList.toggle("off", !S.sample && !S.apiKey);
}
if (!MOVED) document.addEventListener("DOMContentLoaded", boot);
})();
