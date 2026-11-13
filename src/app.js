// ---- app: UI, sources, translators, cache ----
(function () {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Interface strings and the language list live in i18n.js (UI, LANGS).

// ---------- storage helpers ----------
// Settings live in localStorage under "taiyak:" and translations in the IndexedDB database "taiyak".
// What was saved under the names used before the rename ("lt:" keys, the "lean-taiyaku" database)
// is moved over once.
const LS_PREFIX = "taiyak:", OLD_LS_PREFIX = "lt:";
const DB_NAME = "taiyak", OLD_DB_NAME = "lean-taiyaku";
try {
  const old = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(OLD_LS_PREFIX)) old.push(k); }
  for (const k of old) {
    const nk = LS_PREFIX + k.slice(OLD_LS_PREFIX.length);
    if (localStorage.getItem(nk) == null) localStorage.setItem(nk, localStorage.getItem(k));
    localStorage.removeItem(k);
  }
} catch (e) { }
const LS = {
  get(k, d) { try { const v = localStorage.getItem(LS_PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) { } }
};
const MEM = new Map(); // translation cache in memory
let idb = null;
// IndexedDB requests can wait indefinitely (another tab holding the database, a delete queued behind
// it), so storage never holds up loading: after a few seconds the page goes on without it.
const withTimeout = (p, ms, fallback) => Promise.race([p, new Promise(res => setTimeout(() => res(fallback), ms))]);
function openDB() {
  return withTimeout(new Promise(res => {
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("tr");
      r.onsuccess = () => { idb = r.result; res(idb); };
      r.onerror = r.onblocked = () => res(null);
    } catch (e) { res(null); }
  }), 3000, null);
}
function idbAll(db = idb) {
  return new Promise(res => {
    if (!db) return res([]);
    try {
      const out = []; const tx = db.transaction("tr"); const st = tx.objectStore("tr");
      const rq = st.openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
      rq.onerror = () => res(out);
    } catch (e) { res([]); }
  });
}
// Copies translations from the database used before the rename (keeping any already in the new
// one), then deletes the old database once the copy has been committed.
function migrateOldDB() { return withTimeout(migrateOldDB1(), 1500, undefined); }
async function migrateOldDB1() {
  try {
    if (!idb || !indexedDB.databases || !(await indexedDB.databases()).some(d => d.name === OLD_DB_NAME)) return;
    // A tab still running the version from before the rename keeps the old database open; then the
    // delete below stays pending and later opens queue behind it, so give up rather than wait.
    const old = await new Promise((res, rej) => { const r = indexedDB.open(OLD_DB_NAME); r.onsuccess = () => res(r.result); r.onerror = r.onblocked = () => rej(r.error); });
    const rows = old.objectStoreNames.contains("tr") ? await idbAll(old) : [];
    old.close();
    const ok = await new Promise(res => {
      const tx = idb.transaction("tr", "readwrite"); const st = tx.objectStore("tr");
      for (const [k, v] of rows) { const rq = st.add(v, k); rq.onerror = e => { e.preventDefault(); e.stopPropagation(); }; }
      tx.oncomplete = () => res(true); tx.onerror = tx.onabort = () => res(false);
    });
    if (ok) indexedDB.deleteDatabase(OLD_DB_NAME);
  } catch (e) { }
}
function idbPut(k, v) { try { if (idb) idb.transaction("tr", "readwrite").objectStore("tr").put(v, k); } catch (e) { } }

// ---------- translation providers (web version; the claude.ai version uses the viewer's Claude) ----------
const PROVIDERS = {
  anthropic: { name: "Anthropic", host: "api.anthropic.com", ph: "sk-ant-…", keyURL: "https://console.anthropic.com/settings/keys",
    models: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"] },
  openai: { name: "OpenAI", host: "api.openai.com", ph: "sk-…", keyURL: "https://platform.openai.com/api-keys",
    models: ["gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.6-luna", "gpt-6-astra"] },
  google: { name: "Google Gemini", host: "generativelanguage.googleapis.com", ph: "AIza…", keyURL: "https://aistudio.google.com/apikey",
    models: ["gemini-3.8-flash", "gemini-4-argon", "gemini-3.5-flash-lite"] },
  // One key for many vendors' models, obtainable with a button (OAuth PKCE) instead of copying a key.
  openrouter: { name: "OpenRouter", host: "openrouter.ai", ph: "sk-or-…", keyURL: "https://openrouter.ai/settings/keys", oauth: true,
    models: ["google/gemma-4-31b-it:free", "nvidia/nemotron-3-super:free", "anthropic/claude-sonnet-5-5", "openai/gpt-5.6-terra", "google/gemini-3.8-flash"] },
  // Gemini Nano inside Chrome (Prompt API): no key, nothing leaves the device, small context.
  chrome: { local: true, models: ["gemini-nano"] },
};
const providerName = id => PROVIDERS[id].name || t("chromeName");
const hasLM = () => typeof self.LanguageModel === "function" || typeof self.LanguageModel === "object" && !!self.LanguageModel;
// Is there something to translate with? (the viewer's Claude, a key, or Chrome's built-in model)
const engineOK = () => !!(S.sample || (PROVIDERS[S.provider].local ? hasLM() : S.apiKey));

// Model names: the built-in list above is only a fallback. With a key, each API is asked which
// models it offers; the answer is kept for a day.
const MODEL_SKIP = /(audio|realtime|transcri|tts|image|embed|moderation|search|live|robotics|aqa|omni|banana|computer-use|diariz|instruct|veo|lyria|imagen)/i;
const LIST_MODELS = {
  async anthropic(key) {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } });
    if (!r.ok) throw new Error("API " + r.status);
    return ((await r.json()).data || []).map(m => m.id);
  },
  async openai(key) {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { authorization: "Bearer " + key } });
    if (!r.ok) throw new Error("API " + r.status);
    return ((await r.json()).data || []).sort((a, b) => (b.created || 0) - (a.created || 0)).map(m => m.id).filter(id => /^(gpt-|o\d|chatgpt-)/.test(id) && !MODEL_SKIP.test(id));
  },
  // Free models (":free", 50 requests a day without a purchase) come first, then the newest.
  // /models/user leaves out what the account's privacy settings and guardrails would refuse.
  async openrouter(key) {
    const h = { headers: { authorization: "Bearer " + key } };
    let r = await fetch("https://openrouter.ai/api/v1/models/user", h);
    if (r.status === 404) throw new Error(t("orPolicy"));
    if (!r.ok) r = await fetch("https://openrouter.ai/api/v1/models?output_modalities=text", h);
    if (!r.ok) throw new Error("API " + r.status);
    const free = m => /:free$/.test(m.id);
    return ((await r.json()).data || []).filter(m => !m.architecture || !m.architecture.output_modalities || m.architecture.output_modalities.includes("text"))
      .filter(m => !MODEL_SKIP.test(m.id)).sort((a, b) => free(b) - free(a) || (b.created || 0) - (a.created || 0)).map(m => m.id);
  },
  async google(key) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key } });
    if (!r.ok) throw new Error("API " + r.status);
    return ((await r.json()).models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map(m => String(m.name).replace(/^models\//, "")).filter(id => /^gemini-/.test(id) && !MODEL_SKIP.test(id));
  },
};
async function modelList(provider, key, force) {
  const P = PROVIDERS[provider];
  if (P.local || !key || !LIST_MODELS[provider]) return { ids: P.models, from: "builtin" };
  const cache = LS.get("modelList", {}), c = cache[provider];
  if (!force && c && c.key === hashKey(key) && Date.now() - c.at < 864e5) return { ids: c.ids, from: "api" };
  try {
    const ids = [...new Set(await LIST_MODELS[provider](key))];
    if (!ids.length) throw new Error("empty");
    cache[provider] = { at: Date.now(), key: hashKey(key), ids }; LS.set("modelList", cache);
    return { ids, from: "api" };
  } catch (e) { return { ids: P.models, from: "failed", err: e.message }; }
}
const hashKey = k => CORE.hashStr("k:" + k); // so a new key refreshes the list without storing the key twice

// Chrome's built-in model. Languages it accepts for output; others are asked for anyway, unmarked.
const LM_LANGS = ["en", "ja", "es", "de", "fr"];
const lmOptions = () => {
  const c = trCode();
  return { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: LM_LANGS.includes(c) ? [c] : ["en"] }] };
};
async function lmAvailability() {
  if (!hasLM()) return "missing";
  try { return await LanguageModel.availability(lmOptions()); } catch (e) { return "unavailable"; }
}
// Keys and model names are kept per provider; "apiKey" and "model" are the settings from before
// there was a choice and count as Anthropic's.
const savedKeys = () => { const k = LS.get("keys", null) || {}; const old = LS.get("apiKey", ""); if (old && !k.anthropic) k.anthropic = old; return k; };
const savedModels = () => { const m = LS.get("models", null) || {}; const old = LS.get("model", ""); if (old && !m.anthropic) m.anthropic = old; return m; };

// ---------- state ----------
const S = {
  provider: PROVIDERS[LS.get("provider", "")] ? LS.get("provider", "") : "anthropic", keys: savedKeys(), models: savedModels(),
  get apiKey() { return this.keys[this.provider] || ""; },
  get model() { return this.models[this.provider] || PROVIDERS[this.provider].models[0]; },
  uiMode: LS.get("uiMode", LS.get("ui", "auto")),
  lang: LS.get("lang", null), style: LS.get("style", "normal"), view: LS.get("view", "both"),
  tier: LS.get("tier", "default"),
  ghToken: LS.get("ghToken", ""), remember: LS.get("remember", false),
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
const sleep = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej({ code: "cancelled" });
  const id = setTimeout(res, ms);
  if (signal) signal.addEventListener("abort", () => { clearTimeout(id); rej({ code: "cancelled" }); }, { once: true });
});
// Busy or temporarily failing APIs (429, 5xx, Anthropic's 529) are retried a few times, waiting
// as long as the server asks or 2, 5 and 10 seconds. Not retried: a request that ran out of time
// (504, or Gemini's 503 "Deadline expired"), which would run out of time again; a wait of more
// than a minute; and a quota of 0 (Gemini's free tier has none for some models, e.g. Argon).
const RETRY_STATUS = new Set([429, 500, 502, 503, 504, 529]), RETRY_WAIT = [2000, 5000, 10000];
const isDeadline = (status, msg) => status === 504 || /deadline/i.test(msg || "");
const isZeroQuota = (status, msg) => status === 429 && /\blimit: 0(?![\d.])/.test(msg || "");
// Seconds to wait: Retry-After, or Gemini's google.rpc.RetryInfo in the body ("19808s").
function retryAfter(r, data) {
  const h = Number(r.headers.get("retry-after"));
  if (h > 0) return h;
  const info = ((data.error && data.error.details) || []).find(d => d && d.retryDelay);
  const s = info ? parseFloat(info.retryDelay) : 0;
  return s > 0 ? s : 0;
}
async function post(url, headers, body, signal) {
  for (let attempt = 0; ; attempt++) {
    let r;
    try { r = await fetch(url, { method: "POST", signal, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); }
    catch (e) { if (e.name === "AbortError") throw { code: "cancelled" }; throw new Error(new URL(url).host + ": " + e.message); }
    if (r.ok) return r;
    const data = await r.json().catch(() => ({}));
    const msg = apiErrText(data);
    const wait = retryAfter(r, data), zero = isZeroQuota(r.status, msg);
    if (RETRY_STATUS.has(r.status) && !isDeadline(r.status, msg) && !zero && wait <= 60 && attempt < RETRY_WAIT.length) {
      await sleep(wait > 0 ? wait * 1000 : RETRY_WAIT[attempt], signal);
      continue;
    }
    throw new Error(`API ${r.status}: ` + (zero ? t("quotaZero") + " — " : "") + msg + (attempt ? ` (${attempt + 1}×)` : ""));
  }
}
// The error message, plus what a gateway passed on from the provider behind it (OpenRouter puts it
// in error.metadata: provider_name and the provider's raw reply).
function apiErrText(data) {
  const e = data && data.error; if (!e) return "";
  let s = typeof e === "string" ? e : e.message || "";
  const m = (typeof e === "object" && e.metadata) || {};
  if (m.provider_name) s += ` [${m.provider_name}]`;
  if (m.raw) {
    let raw = m.raw;
    try { const j = typeof raw === "string" ? JSON.parse(raw) : raw; raw = (j.error && (j.error.message || j.error)) || j.message || j; } catch (x) { }
    raw = typeof raw === "string" ? raw : JSON.stringify(raw);
    if (raw && !s.includes(raw)) s += ": " + raw.slice(0, 300);
  }
  return s;
}
async function postJSON(url, headers, body, signal) {
  const r = await post(url, headers, body, signal);
  return r.json().catch(() => ({}));
}
// Reads a text/event-stream response, handing the data of each event to onData.
async function readSSE(r, signal, onData) {
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buf += done ? dec.decode() + "\n\n" : dec.decode(value, { stream: true });
      const s = CORE.splitSSE(buf);
      buf = s.rest;
      for (const ev of s.events) onData(ev);
      if (done) return;
    }
  } catch (e) {
    reader.cancel().catch(() => { });
    if (signal && signal.aborted || e && e.name === "AbortError") throw { code: "cancelled" };
    throw e;
  }
}
// One request per provider: prompt in, { text, truncated, model } out. OpenAI and Gemini count
// hidden reasoning against the output limit, so they get twice the room.
const REQUEST = {
  async anthropic(prompt, signal, max) {
    const d = await postJSON("https://api.anthropic.com/v1/messages",
      { "x-api-key": S.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      { model: S.model, max_tokens: max, messages: [{ role: "user", content: prompt }] }, signal);
    return { text: (d.content || []).filter(c => c.type === "text").map(c => c.text).join(""), truncated: d.stop_reason === "max_tokens", model: d.model || S.model };
  },
  async openai(prompt, signal, max) {
    const d = await postJSON("https://api.openai.com/v1/responses", { authorization: "Bearer " + S.apiKey },
      { model: S.model, input: prompt, max_output_tokens: max * 2, store: false }, signal);
    const text = (d.output || []).filter(o => o.type === "message").flatMap(o => o.content || []).filter(c => c.type === "output_text").map(c => c.text).join("");
    return { text, truncated: d.status === "incomplete", model: d.model || S.model };
  },
  async openrouter(prompt, signal, max) {
    let d;
    try {
      d = await postJSON("https://openrouter.ai/api/v1/chat/completions", { authorization: "Bearer " + S.apiKey, "x-title": "Taiyak" },
        { model: S.model, messages: [{ role: "user", content: prompt }], max_tokens: max * 2 }, signal);
    } catch (e) {
      // Free models are mostly served by providers that may train on prompts; an account that does not
      // allow that gets "No endpoints found matching your data policy".
      if (e instanceof Error && /data policy|guardrail|eligible endpoints/i.test(e.message)) e.message += " — " + t("orPolicy");
      throw e;
    }
    if (d.error) throw new Error("API: " + (apiErrText(d) || d.error.code));
    const c = (d.choices || [])[0] || {};
    return { text: (c.message && c.message.content) || "", truncated: c.finish_reason === "length", model: d.model || S.model };
  },
  async chrome(prompt, signal, max, onText) {
    if (!hasLM()) throw new Error(t("chromeState", "missing"));
    const st = await lmAvailability();
    if (st !== "available") throw new Error(t("chromeState", st));
    let session;
    try { session = await LanguageModel.create({ ...lmOptions(), signal }); }
    catch (e) { if (signal && signal.aborted) throw { code: "cancelled" }; throw new Error("Chrome: " + e.message); }
    try {
      const win = session.contextWindow || session.inputQuota, need = session.measureContextUsage ? await session.measureContextUsage(prompt) : session.measureInputUsage ? await session.measureInputUsage(prompt) : 0;
      if (win && need > win) throw new Error(t("chromeTooLong", need, win));
      let text = "";
      for await (const part of session.promptStreaming(prompt, { signal })) { text += part; onText && onText(text); }
      return { text, truncated: false, model: "gemini-nano (Chrome)" };
    } catch (e) {
      if (signal && signal.aborted || e && e.name === "AbortError") throw { code: "cancelled" };
      throw e;
    } finally { try { session.destroy(); } catch (e) { } }
  },
  // Streamed: a whole file in one non-streaming generateContent call can outlast the server's
  // deadline (504 DEADLINE_EXCEEDED), and the stream also shows progress while the reply arrives.
  async google(prompt, signal, max, onText) {
    const r = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(S.model)}:streamGenerateContent?alt=sse`, { "x-goog-api-key": S.apiKey },
      { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: max * 2 } }, signal);
    let acc = CORE.foldGemini(null, null);
    await readSSE(r, signal, data => {
      let d; try { d = JSON.parse(data); } catch (e) { return; }
      const before = acc.text.length;
      acc = CORE.foldGemini(acc, d);
      if (onText && acc.text.length > before) onText(acc.text);
    });
    if (!acc.text && acc.block) throw new Error("API: " + acc.block);
    if (!acc.text && !acc.finish) throw new Error("API: no candidates");
    return { text: acc.text, truncated: acc.finish === "MAX_TOKENS", model: acc.model || S.model };
  },
};
async function callLLM(prompt, onText, signal, opts = {}) {
  if (S.sample) {
    const r = await S.sample(prompt, { onText: ({ text }) => onText && onText(text), signal, modelTier: opts.tier || S.tier, cache: false });
    return { text: r.text, truncated: r.truncated, model: "claude (" + (r.modelTierApplied || S.tier) + ")" };
  }
  if (engineOK()) return REQUEST[S.provider](prompt, signal, opts.maxTokens || 16000, onText);
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
  if (!engineOK()) { setStatus(t("noEngine"), "err"); openSettings(); return; }
  const all = await blocksOf(p);
  const fileText = await readFile(p);
  let todo = which.filter(b => b.cls !== "struct" && (opts.force || !getTr(p, b)));
  if (!todo.length) return;
  // Chrome's built-in model has a small context: a block or two at a time, little context, proofs elided.
  const small = !S.sample && PROVIDERS[S.provider].local;
  const chunks = small ? CORE.chunkBlocks(todo, 2500, 2) : CORE.chunkBlocks(todo);
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
    const ctx = CORE.collectContext(p, all, S.idx, small ? 2500 : undefined);
    for (let i = 0; i < chunks.length; i++) {
      if (ctl.signal.aborted) break;
      const chunk = chunks[i];
      let prompt = CORE.buildPrompt({ repoLabel: S.source.label, path: p, lang: S.lang, style: S.style, blocks: chunk, allBlocks: all, context: ctx, fileText, elide: small });
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
  if (!(hits && hits.length) && blkEl && engineOK()) {
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
function glossPending(k) { return !glossText(k).native && !!engineOK() && !GLFAIL.has(S.lang + "|" + k); }
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
  if (glossBuiltIn(lang) >= 0 || !engineOK() || !glossMissing(lang).length) { showGlossProg(); return; }
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
  for (const b of document.querySelectorAll(".reveal")) if (b.getAttribute("aria-pressed") === "true") b.click();
  DRAFT = { provider: S.provider, keys: { ...S.keys }, models: { ...S.models } };
  $("#provider").innerHTML = Object.keys(PROVIDERS).map(id => `<option value="${id}">${esc(providerName(id))}</option>`).join("");
  showProvider();
  $("#ghToken").value = S.ghToken;
  $("#patLink").href = patURL(currentOwner());
  $("#remember").checked = S.remember;
  $("#uiLang").innerHTML = `<option value="auto" lang="${uiCode()}">${esc(t("uiAuto"))}</option>` + LANGS.map(L => `<option value="${L.ui}" lang="${L.ui}">${L.name}</option>`).join("");
  $("#uiLang").value = UI[S.uiMode] ? S.uiMode : "auto";
  syncSelLang($("#uiLang"));
  $("#tier").innerHTML = ["default", "complex", "quick"].map(v => `<option value="${v}" ${v === S.tier ? "selected" : ""}>${t("tier" + v[0].toUpperCase() + v.slice(1))}</option>`).join("");
  d.hidden = false; $("#apiKey").focus();
}
// ---------- "Connect OpenRouter" (OAuth PKCE: no client registration, no server) ----------
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const OR_PENDING = "taiyak:orPending"; // sessionStorage: verifier, state and where to come back to
async function orConnect() {
  if (!PROVIDERS[DRAFT.provider].local) stashProvider();
  DRAFT.provider = "openrouter"; saveSettings();
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  // Come back to the same address, with the language even where the address does not carry it (the demo).
  const back = new URL(location.href); if (!back.searchParams.has("lang")) back.searchParams.set("lang", S.lang);
  try { sessionStorage.setItem(OR_PENDING, JSON.stringify({ verifier, state, back: back.pathname + back.search + back.hash })); } catch (e) { }
  const q = new URLSearchParams({ callback_url: location.origin + location.pathname, code_challenge: challenge, code_challenge_method: "S256", state, key_label: "Taiyak" });
  location.assign("https://openrouter.ai/auth?" + q);
}
// Back from OpenRouter with ?code=…: exchange it for a key, then restore the address the user left from.
async function orCallback() {
  const q = new URLSearchParams(location.search), code = q.get("code");
  let pend = null; try { pend = JSON.parse(sessionStorage.getItem(OR_PENDING) || "null"); } catch (e) { }
  if (!code && !(pend && q.has("state"))) return;
  try { sessionStorage.removeItem(OR_PENDING); } catch (e) { }
  try { history.replaceState(null, "", pend ? pend.back : location.pathname); } catch (e) { }
  if (!pend || !code || q.get("state") !== pend.state) { if (pend) setStatus(t("orFailed", code ? "state" : "denied"), "err"); return; }
  try {
    const r = await fetch("https://openrouter.ai/api/v1/auth/keys", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, code_verifier: pend.verifier, code_challenge_method: "S256" }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.key) throw new Error(r.status + " " + ((d.error && d.error.message) || ""));
    S.provider = "openrouter"; S.keys.openrouter = d.key;
    LS.set("provider", S.provider); if (S.remember) LS.set("keys", S.keys);
    setEngineLabel(); toast(t("orConnected"));
  } catch (e) { setStatus(t("orFailed", e.message), "err"); }
}

// The settings dialog edits a draft, so each provider's key and model survive switching between them.
let DRAFT = null;
function stashProvider() {
  const k = $("#apiKey").value.trim(), m = $("#model").value.trim();
  if (k) DRAFT.keys[DRAFT.provider] = k; else delete DRAFT.keys[DRAFT.provider];
  if (m) DRAFT.models[DRAFT.provider] = m; else delete DRAFT.models[DRAFT.provider];
}
function showProvider() {
  const id = DRAFT.provider, P = PROVIDERS[id];
  $("#provider").value = id;
  $("#keyRow").hidden = $("#modelRow").hidden = !!P.local; $("#chromeRow").hidden = !P.local;
  if (P.local) { $("#sNote").textContent = t("chromeNote"); showChrome(); return; }
  $("#apiKey").value = DRAFT.keys[id] || ""; $("#apiKey").placeholder = P.ph;
  $("#model").value = DRAFT.models[id] || P.models[0];
  $("#keyLink").href = P.keyURL; $("#keyLink").textContent = t("keyLink", P.name);
  $("#orRow").hidden = !P.oauth;
  $("#sNote").textContent = S.sample ? t("sNoteArtifact") : t("sNoteStandalone", P.host);
  fillModels(false);
}
let MLSEQ = 0;
async function fillModels(force) {
  const id = DRAFT.provider, key = $("#apiKey").value.trim(), seq = ++MLSEQ;
  if (key && !force) $("#modelInfo").textContent = "";
  const r = await modelList(id, key, force);
  if (seq !== MLSEQ || DRAFT.provider !== id) return;
  $("#models").innerHTML = r.ids.map(m => `<option value="${esc(m)}"></option>`).join("");
  $("#modelInfo").textContent = r.from === "api" ? t("modelsFetched", r.ids.length) : r.from === "failed" ? t("modelsFailed", r.err) : "";
}
async function showChrome() {
  const st = await lmAvailability();
  if (DRAFT.provider !== "chrome") return;
  $("#chromeState").textContent = t("chromeState", st);
  $("#chromeDl").hidden = st !== "downloadable";
}
// Downloading the model needs a click (user activation), so it is started from Settings.
async function chromeDownload() {
  $("#chromeDl").hidden = true;
  try {
    const sess = await LanguageModel.create({ ...lmOptions(), monitor(m) { m.addEventListener("downloadprogress", e => { $("#chromeState").textContent = t("chromeState", "downloading") + ` ${Math.round((e.loaded || 0) * 100)}%`; }); } });
    sess.destroy();
  } catch (e) { $("#chromeState").textContent = "Chrome: " + e.message; return; }
  showChrome(); setEngineLabel();
}
function saveSettings() {
  const oldGh = S.ghToken, hadKey = engineOK();
  if (!PROVIDERS[DRAFT.provider].local) stashProvider();
  S.provider = DRAFT.provider; S.keys = DRAFT.keys; S.models = DRAFT.models; S.ghToken = $("#ghToken").value.trim();
  if (S.ghToken && S.ghToken !== oldGh && S.lastFailed) { const f = S.lastFailed; S.lastFailed = null; $("#hint").hidden = true; setTimeout(() => { const gs = new GitHubSource(f.p, S.ghToken); gs.openPath = f.openPath; gs.focus = f.focus; loadSource(gs); }, 0); }
  S.remember = $("#remember").checked; S.tier = $("#tier").value || S.tier;
  LS.set("provider", S.provider); LS.set("models", S.models); LS.set("tier", S.tier); LS.set("remember", S.remember);
  LS.del("apiKey"); LS.del("model");
  if (S.remember) { LS.set("keys", S.keys); LS.set("ghToken", S.ghToken); } else { LS.del("keys"); LS.del("ghToken"); }
  setEngineLabel();
  const um = $("#uiLang").value; if (um !== S.uiMode) { S.uiMode = um; LS.set("uiMode", um); LS.del("ui"); applyUI(); refresh(); }
  if (!hadKey && engineOK()) startGlossJob();
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
  $("#provider").addEventListener("change", e => { if (!PROVIDERS[DRAFT.provider].local) stashProvider(); DRAFT.provider = e.target.value; showProvider(); });
  $("#apiKey").addEventListener("change", () => fillModels(false));
  $("#modelRefresh").addEventListener("click", () => fillModels(true));
  $("#chromeDl").addEventListener("click", chromeDownload);
  $("#orConnect").addEventListener("click", orConnect);
  // Masked key fields: see .secret in the stylesheet.
  const cssMask = window.CSS && CSS.supports && CSS.supports("-webkit-text-security", "disc");
  for (const btn of document.querySelectorAll(".reveal")) {
    const inp = btn.previousElementSibling;
    if (!cssMask) inp.type = "password";
    const show = on => { btn.setAttribute("aria-pressed", on); inp.classList.toggle("shown", on); if (!cssMask) inp.type = on ? "text" : "password"; btn.title = btn.ariaLabel = t(on ? "hideKey" : "showKey"); };
    show(false);
    btn.addEventListener("click", () => show(btn.getAttribute("aria-pressed") !== "true"));
  }
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
  if (!S.inArtifact) await orCallback();
  await openDB(); await migrateOldDB();
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
  el.textContent = S.sample ? "Claude" : (engineOK() ? S.model : "—");
  el.classList.toggle("off", !engineOK());
}
if (!MOVED) document.addEventListener("DOMContentLoaded", boot);
})();
