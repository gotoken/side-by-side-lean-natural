// ---- app: UI, sources, translators, cache ----
(function () {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- i18n ----------
const UI = {
  ja: {
    open: "開く", zip: "ZIP を開く", folder: "フォルダ", settings: "設定", files: "ファイル", filter: "ファイル名で絞り込み",
    lang: "訳す言語", style: "詳しさ", brief: "要点", normal: "標準", detail: "詳しく", other: "その他…",
    translateFile: "このファイルを訳す", stop: "停止", translate: "訳す", retranslate: "訳し直す", back: "戻る",
    viewBoth: "対訳", viewLean: "Lean", viewTr: "訳",
    showProof: n => `証明を表示（${n} 行）`, hideProof: "証明をたたむ",
    math: "内容", proof: "証明の方針", lean: "Lean の読み方", src: "元のソースとの対応",
    notYet: "まだ訳していません", struct: "構造", translated: (a, b) => `訳済み ${a} / ${b}`,
    lines: n => `${n} 行`, thinking: "考え中…", receiving: n => `受信中… ${n} 文字`,
    chunkOf: (i, n) => `${i} / ${n} 回目`, done: "完了", stopped: "停止しました",
    confirmMany: n => `${n} 回に分けて訳します。もう一度押すと開始`,
    noEngine: "翻訳エンジンがありません。設定で Anthropic API キーを入れるか、claude.ai 上で開いてください。",
    urlPh: "https://github.com/owner/repo（private 可）",
    demoLabel: "デモ", jumpDef: "定義へ移動", defIn: "定義", glossary: "Lean の用語・記号",
    loading: "読み込み中…", repoLoaded: n => `${n} 個の .lean ファイル`,
    ghNet: "GitHub に接続できませんでした。",
    ghInArtifact: "claude.ai の中のページからは GitHub に接続できません。GitHub で Code → Download ZIP した ZIP を「ZIP を開く」で読み込んでください（private リポジトリも可）。この HTML を手元で開けば URL から直接読めます。",
    zipLink: "このリポジトリの ZIP をダウンロード",
    gh404: "見つかりません。非公開リポジトリなら設定で GitHub トークンを入れてください。",
    gh401: "GitHub トークンが無効です。", ghRate: "GitHub API の回数制限に達しました。トークンを設定すると上限が上がります。",
    treeTrunc: "ファイル数が多く一覧の一部しか取得できませんでした。", noLean: ".lean ファイルが見つかりません。",
    apiErr: "翻訳に失敗しました", parseErr: "返答を読み取れませんでした。もう一度試してください。",
    sEngine: "翻訳エンジン", sClaude: "Claude（claude.ai のあなたのアカウント）", sTier: "モデル",
    tierDefault: "標準", tierComplex: "高精度（時間がかかる）", tierQuick: "高速",
    sApi: "Anthropic API キー", sModel: "モデル名", sGh: "GitHub トークン（private 用。fine-grained PAT で Contents: Read-only）",
    sRemember: "このブラウザに保存する", sUi: "表示言語", sExport: "訳をエクスポート", sImport: "訳をインポート",
    sCopy: "JSON をコピー", sDownload: "ダウンロード", sClose: "閉じる", copied: "コピーしました",
    imported: n => `${n} 件取り込みました`, sNoteArtifact: "claude.ai 上では API キーは不要です。訳はこのブラウザに保存されます。",
    sNoteStandalone: "キーはこのページから api.anthropic.com と api.github.com に直接送られるだけです。共用 PC では保存しないでください。",
    ctx: n => `参照した定義 ${n} 件`, about: "このツールについて",
    aboutText: "Lean 4 のソースを宣言ごとに区切り、各ブロックを指定した言語の数学的な文章に訳して並べます。import 先から参照している定義も文脈として渡します。Lean のビルドは不要です。訳は LLM によるもので、誤りがありえます。必ずコードと照らして読んでください。識別子や記号をタップすると定義や意味を表示します。",
    demoNote: "デモ: Broyojo/python-formalization @7d5a5ed の range 長に関する部分（Apache-2.0, © 2026 David Andrews）。Spec.lean と Length.lean は日本語訳済み。",
    otherLangPh: "例: Italiano",
    partial: n => `${n} 件は訳せませんでした（返答が長さの上限で切れた可能性）。もう一度押すと残りだけ訳します。`,
    bundled: n => `リポジトリに同梱された訳を ${n} 件読み込みました。`,
    sExportHint: "いま開いているリポジトリの訳だけを書き出します。そのリポジトリの .lean-taiyaku/ja.json（言語ごとに 1 ファイル）として置くと、開いた人はキーなしで訳を読めます。",
    copyLink: "リンク", linkCopied: "リンクをコピーしました", lic: "ライセンスと帰属表示",
    patLink: "GitHub でトークンを作る（読み取り専用の設定を記入済み）",
    patSteps: "開いた画面で Repository access を「Only select repositories」にして読みたいリポジトリを選び、Generate token を押します。表示された github_pat_… をここに貼ってください。期限は 30 日です。",
    ghPrivateHint: "非公開リポジトリを読むには、読み取り専用の GitHub トークンが要ります。",
    patLinkShort: "トークンを作る（記入済み）", openSettings: "設定を開く", orZip: "または ZIP で開く",
    askClaude: "この箇所について Claude に聞く", claudeSays: "Claude の説明（この宣言の中で）",
    askWaiting: "Claude に問い合わせ中…", askWriting: "Claude が回答中…", secs: n => `${n} 秒`, askDone: n => `回答済み（${n} 秒）`,
    askAgain: "もう一度聞く", askRetry: "もう一度試す", askReady: w => `「${w}」の説明ができました。もう一度タップすると表示します。`,
  },
  en: {
    open: "Open", zip: "Open ZIP", folder: "Folder", settings: "Settings", files: "Files", filter: "Filter files",
    lang: "Translate into", style: "Detail", brief: "Brief", normal: "Normal", detail: "Detailed", other: "Other…",
    translateFile: "Translate this file", stop: "Stop", translate: "Translate", retranslate: "Retranslate", back: "Back",
    viewBoth: "Side by side", viewLean: "Lean", viewTr: "Prose",
    showProof: n => `Show proof (${n} lines)`, hideProof: "Hide proof",
    math: "Content", proof: "Proof idea", lean: "Reading the Lean", src: "Source correspondence",
    notYet: "Not translated yet", struct: "Structure", translated: (a, b) => `${a} / ${b} translated`,
    lines: n => `${n} lines`, thinking: "Thinking…", receiving: n => `Receiving… ${n} chars`,
    chunkOf: (i, n) => `call ${i} of ${n}`, done: "Done", stopped: "Stopped",
    confirmMany: n => `This takes ${n} calls. Press again to start`,
    noEngine: "No translator available. Add an Anthropic API key in Settings, or open this page on claude.ai.",
    urlPh: "https://github.com/owner/repo (private OK)",
    demoLabel: "Demo", jumpDef: "Go to definition", defIn: "Defined", glossary: "Lean keywords and notation",
    loading: "Loading…", repoLoaded: n => `${n} .lean files`,
    ghNet: "Could not reach GitHub.",
    ghInArtifact: "Pages inside claude.ai cannot reach GitHub. Download the repository with Code → Download ZIP and open it with \"Open ZIP\" (private repositories work). Opened as a local HTML file, this page reads GitHub URLs directly.",
    zipLink: "Download this repository as ZIP",
    gh404: "Not found. For a private repository, add a GitHub token in Settings.",
    gh401: "The GitHub token is invalid.", ghRate: "GitHub API rate limit reached. A token raises the limit.",
    treeTrunc: "The repository is large; only part of the file list was returned.", noLean: "No .lean files found.",
    apiErr: "Translation failed", parseErr: "Could not read the reply. Please try again.",
    sEngine: "Translator", sClaude: "Claude (your claude.ai account)", sTier: "Model",
    tierDefault: "Default", tierComplex: "Most capable (slower)", tierQuick: "Fast",
    sApi: "Anthropic API key", sModel: "Model", sGh: "GitHub token (for private repos; fine-grained PAT with Contents: Read-only)",
    sRemember: "Remember in this browser", sUi: "Interface language", sExport: "Export translations", sImport: "Import translations",
    sCopy: "Copy JSON", sDownload: "Download", sClose: "Close", copied: "Copied",
    imported: n => `Imported ${n} entries`, sNoteArtifact: "No API key is needed on claude.ai. Translations are kept in this browser.",
    sNoteStandalone: "Keys are sent only from this page to api.anthropic.com and api.github.com. Do not save them on shared computers.",
    ctx: n => `${n} referenced definitions`, about: "About",
    aboutText: "Splits Lean 4 source into declarations and shows each next to a natural-language mathematical translation in the language you pick. Definitions referenced from imported files are passed as context. No Lean build is needed. Translations come from an LLM and can be wrong: read them against the code. Tap identifiers and symbols for their definition or meaning.",
    demoNote: "Demo: the range-length part of Broyojo/python-formalization @7d5a5ed (Apache-2.0, © 2026 David Andrews). Spec.lean and Length.lean come pre-translated into Japanese.",
    otherLangPh: "e.g. Italiano",
    partial: n => `${n} blocks were not translated (the reply may have hit the length limit). Press again to translate only the rest.`,
    bundled: n => `Loaded ${n} translations bundled with the repository.`,
    sExportHint: "Exports translations for the repository that is open now. Commit it to that repository as .lean-taiyaku/<lang>.json and anyone who opens it sees the translations without a key.",
    copyLink: "Link", linkCopied: "Link copied", lic: "Licenses and attribution",
    patLink: "Create a token on GitHub (read-only, pre-filled)",
    patSteps: "On the page that opens, set Repository access to \"Only select repositories\", pick the repositories to read, and press Generate token. Paste the github_pat_… it shows here. It expires in 30 days.",
    ghPrivateHint: "Reading a private repository needs a read-only GitHub token.",
    patLinkShort: "Create a token (pre-filled)", openSettings: "Open settings", orZip: "or open a ZIP",
    askClaude: "Ask Claude about this spot", claudeSays: "Claude's explanation (in this declaration)",
    askWaiting: "Asking Claude…", askWriting: "Claude is answering…", secs: n => `${n}s`, askDone: n => `Answered (${n}s)`,
    askAgain: "Ask again", askRetry: "Try again", askReady: w => `The explanation of “${w}” is ready. Tap it again to see it.`,
  }
};
const LANGS = ["日本語", "English", "简体中文", "繁體中文", "한국어", "Français", "Deutsch", "Español", "Português", "Русский"];

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
      const r = indexedDB.open("lean-taiyaku", 1);
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
  ui: LS.get("ui", (navigator.language || "ja").startsWith("ja") ? "ja" : "en"),
  lang: LS.get("lang", null), style: LS.get("style", "normal"), view: LS.get("view", "both"),
  tier: LS.get("tier", "default"), model: LS.get("model", "claude-sonnet-5-5"),
  apiKey: LS.get("apiKey", ""), ghToken: LS.get("ghToken", ""), remember: LS.get("remember", false),
  source: null, paths: [], texts: new Map(), blocks: new Map(), cur: null, hist: [],
  idxFiles: new Map(), idx: new Map(), ctxCount: 0,
  sample: null, inArtifact: !!(window.claude && typeof window.claude.use === "function"),
  job: null, confirmArm: 0,
};
if (!S.lang) S.lang = S.ui === "ja" ? "日本語" : "English";
const scroller = () => getComputedStyle($("#main")).overflowY === "auto" ? $("#main") : (document.scrollingElement || document.documentElement);
const t = (k, ...a) => { const v = (UI[S.ui] || UI.ja)[k]; return typeof v === "function" ? v(...a) : (v ?? k); };

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
  const ja = S.ui === "ja", out = [];
  for (const l of b.text.split("\n")) {
    let m;
    if ((m = /^(?:public\s+|meta\s+)*import\s+(.+)/.exec(l))) out.push(ja ? `読み込み: ${m[1]}` : `imports ${m[1]}`);
    else if ((m = /^namespace\s+(\S+)/.exec(l))) out.push(ja ? `名前空間 ${m[1]} に入る（以下の f は ${m[1]}.f）` : `enter namespace ${m[1]}`);
    else if ((m = /^open\s+(.+)/.exec(l))) out.push(ja ? `${m[1]} の名前を短く書けるようにする` : `open ${m[1]}`);
    else if ((m = /^end\s*(\S*)/.exec(l))) out.push(ja ? `${m[1] || "セクション"} を閉じる` : `close ${m[1] || "section"}`);
    else if (/^(?:noncomputable\s+|public\s+)?section/.test(l)) out.push(ja ? "セクション開始" : "begin section");
    else if (/^set_option/.test(l)) out.push(ja ? "Lean のオプション設定" : "Lean option");
    else if (/^module\b/.test(l)) out.push(ja ? "モジュール宣言" : "module header");
  }
  return out.join(" / ");
}

const KIND_LABEL = {
  ja: { theorem: "定理", lemma: "補題", def: "定義", abbrev: "定義", structure: "構造体", inductive: "帰納型", class: "クラス", instance: "インスタンス", axiom: "公理", example: "例", variable: "変数", prose: "説明", struct: "構造", cmd: "コマンド" },
  en: { theorem: "theorem", lemma: "lemma", def: "def", abbrev: "abbrev", structure: "structure", inductive: "inductive", class: "class", instance: "instance", axiom: "axiom", example: "example", variable: "variable", prose: "doc", struct: "structure", cmd: "command" }
};
function kindOf(b) {
  if (b.cls !== "decl") return b.cls;
  if (b.kw === "def" && /:\s*Prop\s*:=/.test(CORE.statementPart(b.text).replace(/\s+/g, " ") + ":=")) return "prop";
  return b.kw;
}
function kindLabel(k) { if (k === "prop") return S.ui === "ja" ? "命題" : "property"; return (KIND_LABEL[S.ui] || KIND_LABEL.ja)[k] || k; }

// ---------- UI building ----------
function setStatus(msg, kind) { const el = $("#status"); el.textContent = msg || ""; el.dataset.kind = kind || ""; }
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.tm); toast.tm = setTimeout(() => el.hidden = true, 2600); }

function applyUI() {
  document.documentElement.lang = S.ui;
  $$("[data-i]").forEach(el => el.textContent = t(el.dataset.i));
  $$("[data-ph]").forEach(el => el.placeholder = t(el.dataset.ph));
  const ls = $("#lang"); ls.innerHTML = LANGS.map(l => `<option ${l === S.lang ? "selected" : ""}>${l}</option>`).join("") + (LANGS.includes(S.lang) ? "" : `<option selected>${esc(S.lang)}</option>`) + `<option value="__other">${t("other")}</option>`;
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
  for (const bp of paths.filter(p => /^\.lean-taiyaku\/[^/]+\.json$/.test(p))) {
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
const SITE = "https://side-by-side-lean-natural.pages.dev";
function patURL(owner) {
  const origin = /^https?:/.test(location.protocol) ? location.origin : SITE;
  const q = new URLSearchParams({ name: "side-by-side-lean-natural (read)", description: `Read-only token for Lean 対訳ブラウザ (${origin}). Contents: read only.`, expires_in: "30", contents: "read" });
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
  const sec = (k, cls) => tr[k] && String(tr[k]).trim() ? `<div class="sec ${cls}"><div class="lbl">${t(k)}</div>${renderRich(tr[k])}</div>` : "";
  return `<div class="tr">
    ${tr.title ? `<h3 class="tt">${renderRich(tr.title).replace(/^<p>|<\/p>$/g, "")}</h3>` : ""}
    ${tr.math ? `<div class="mathbody">${renderRich(tr.math)}</div>` : ""}
    ${sec("proof", "pf")}${sec("lean", "lnote")}${sec("src", "sr")}
    <div class="foot"><span>${esc(v.model || "")}</span><button class="trOne ghost" data-id="${b.id}" data-re="1">${t("retranslate")}</button></div>
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
  const w = el.dataset.t; const gi = S.ui === "ja" ? 0 : 1;
  let html = "";
  const hits = el.classList.contains("i") || el.classList.contains("ty") ? CORE.lookupIdent(S.idx, w) : null;
  if (hits && hits.length) {
    html += hits.slice(0, 4).map(h => {
      const v = getTr(h.path, h.block);
      return `<div class="pdef"><div class="pk">${t("defIn")}</div><code>${esc(h.block.full || h.block.name)}</code>
        <div class="muted small">${esc(h.path)}:${h.block.start}</div>
        ${v && v.tr.title ? `<div class="ptitle">${renderRich(v.tr.title)}</div>` : `<pre class="mini">${esc(CORE.statementPart(h.block.text).split("\n").filter(l => !/^\s*(\/--|--|@\[)/.test(l)).slice(0, 6).join("\n"))}</pre>`}
        <button class="jump" data-p="${esc(h.path)}" data-id="${h.block.id}">${t("jumpDef")}</button></div>`;
    }).join("");
  }
  const g = GLOSSARY[w];
  if (g) html += `<div class="pg"><div class="pk">${t("glossary")}</div><code>${esc(w)}</code> ${renderRich(g[gi])}</div>`;
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
      + (a.text ? `<div class="asktext">${esc(a.text)}</div>` : "");
  }
  if (a.state === "error") {
    return `<div class="askstat err">${esc(a.err)}</div><button type="button" class="jump askc">${t("askRetry")}</button>`;
  }
  return `<div class="asktext">${renderRich(a.text)}</div><div class="askfoot"><span class="dot" aria-hidden="true"></span>${t("askDone", secs(a.t0, a.t1))}${a.model ? " · " + esc(a.model) : ""}<button type="button" class="linkbtn askc">${t("askAgain")}</button></div>`;
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
  $("#remember").checked = S.remember; $("#uiLang").value = S.ui;
  $("#tier").innerHTML = ["default", "complex", "quick"].map(v => `<option value="${v}" ${v === S.tier ? "selected" : ""}>${t("tier" + v[0].toUpperCase() + v.slice(1))}</option>`).join("");
  d.hidden = false; $("#apiKey").focus();
}
function saveSettings() {
  const oldGh = S.ghToken;
  S.apiKey = $("#apiKey").value.trim(); S.model = $("#model").value.trim() || "claude-sonnet-5-5"; S.ghToken = $("#ghToken").value.trim();
  if (S.ghToken && S.ghToken !== oldGh && S.lastFailed) { const f = S.lastFailed; S.lastFailed = null; $("#hint").hidden = true; setTimeout(() => { const gs = new GitHubSource(f.p, S.ghToken); gs.openPath = f.openPath; gs.focus = f.focus; loadSource(gs); }, 0); }
  S.remember = $("#remember").checked; S.tier = $("#tier").value || S.tier;
  LS.set("model", S.model); LS.set("tier", S.tier); LS.set("remember", S.remember);
  if (S.remember) { LS.set("apiKey", S.apiKey); LS.set("ghToken", S.ghToken); } else { LS.del("apiKey"); LS.del("ghToken"); }
  setEngineLabel();
  const ui = $("#uiLang").value; if (ui !== S.ui) { S.ui = ui; LS.set("ui", ui); applyUI(); if (S.cur) renderBlocks(S.cur, S.blocks.get(S.cur)); updateCounts(); }
}
function exportJSON() {
  const have = new Set(S.paths);
  const rows = [...MEM].filter(([k, v]) => v && v.tr && have.has(v.path) && (!v.demo || (S.source && S.source.kind === "demo")));
  rows.sort((a, b) => (a[1].lang + a[1].path).localeCompare(b[1].lang + b[1].path) || (parseInt(String(a[1].id).slice(1)) - parseInt(String(b[1].id).slice(1))));
  const entries = {};
  for (const [k, v] of rows) entries[k] = { path: v.path, id: v.id, name: v.name || "", lang: v.lang, style: v.style, model: String(v.model || "").replace(/ · bundled$/, ""), at: v.at || null, tr: v.tr };
  return JSON.stringify({ format: "lean-taiyaku/1", repo: S.source ? S.source.label : "", exported: new Date().toISOString(), entries }, null, 1);
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
    if (e.target.value === "__other") { $("#otherLang").hidden = false; $("#otherLang").focus(); return; }
    S.lang = e.target.value; LS.set("lang", S.lang); $("#otherLang").hidden = true; refresh();
  });
  $("#otherLang").addEventListener("change", e => { const v = e.target.value.trim(); if (v) { S.lang = v; LS.set("lang", v); applyUI(); refresh(); } e.target.hidden = true; });
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
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: "application/json" })); a.download = "lean-taiyaku.json"; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { }
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
  for (const [p, m] of Object.entries(demoTr)) {
    const bl = CORE.splitLean(demo.files[p]);
    for (const b of bl) { const tr = m[b.id]; if (!tr) continue; const k = `日本語|normal|${CORE.hashStr(p + "\n" + b.text)}`; MEM.set(k, { tr, path: p, id: b.id, name: b.name || "", repo: demo.label, lang: "日本語", style: "normal", model: "Claude (demo)", demo: true }); }
  }
  await openDB();
  for (const [k, v] of await idbAll()) if (!MEM.has(k)) MEM.set(k, v);
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
}
function setEngineLabel() {
  const el = $("#engine");
  el.textContent = S.sample ? "Claude" : (S.apiKey ? S.model : "—");
  el.classList.toggle("off", !S.sample && !S.apiKey);
}
document.addEventListener("DOMContentLoaded", boot);
})();
