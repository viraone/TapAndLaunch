import type { CodeFiles } from "./files";

/**
 * Turns an app's files into one HTML page that runs the app. It is shown in a sandboxed iframe (opaque origin, no
 * access to TapAndLaunch's cookies or storage), both in the builder preview and for visitors of a published app.
 *
 * The page loads React and a few libraries from esm.sh (pinned versions), Tailwind from its CDN and Babel to turn JSX
 * into JavaScript in the browser. Each file becomes a blob URL and an import map lets files import each other as
 * `@/components/Hero` (meaning `src/components/Hero.jsx`).
 */
export const LIBS = {
  react: "https://esm.sh/react@18.3.1",
  "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
  "react-dom": "https://esm.sh/react-dom@18.3.1",
  "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
  "react-router-dom": "https://esm.sh/react-router-dom@6.28.0?deps=react@18.3.1,react-dom@18.3.1",
  "lucide-react": "https://esm.sh/lucide-react@0.469.0?deps=react@18.3.1",
  "framer-motion": "https://esm.sh/framer-motion@11.15.0?deps=react@18.3.1,react-dom@18.3.1",
  recharts: "https://esm.sh/recharts@2.15.0?deps=react@18.3.1,react-dom@18.3.1",
  clsx: "https://esm.sh/clsx@2.1.1",
  "date-fns": "https://esm.sh/date-fns@4.1.0",
} as const;

export const BABEL_URL = "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.26.4/babel.min.js";

/** Embeds JSON inside a <script> tag safely (no early </script>, no HTML comment tricks). */
export function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The few lines that run inside the iframe. Kept as plain strings so they can be tested and read as code. */
const RUNTIME = String.raw`
(function () {
  var opts = JSON.parse(document.getElementById("tl-opts").textContent);
  // Which version of the files is on screen, and whether it is half-written (the AI is still typing it). Every message
  // to the builder carries the version, so it can ignore news about a version it has already replaced.
  var rev = opts.rev || 0;
  var draft = !!opts.stubs;
  var send = function (type, message) { try { parent.postMessage({ source: "tl-app", type: type, message: message, rev: rev }, "*"); } catch (e) {} };

  // A sandboxed page has no localStorage; give apps an in-memory one so libraries and simple code keep working.
  function memoryStorage() {
    var data = {};
    return { getItem: function (k) { return k in data ? data[k] : null; }, setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }, clear: function () { data = {}; }, key: function (i) { return Object.keys(data)[i] || null; },
      get length() { return Object.keys(data).length; } };
  }
  ["localStorage", "sessionStorage"].forEach(function (name) {
    try { window[name].getItem("x"); } catch (e) { try { Object.defineProperty(window, name, { value: memoryStorage(), configurable: true }); } catch (e2) {} }
  });

  // Errors show on top of the app (not instead of it), so the next version can simply replace them.
  var errorBox = null;
  function fail(message) {
    send("error", message);
    if (draft || errorBox) return; // half-written code isn't really broken yet
    errorBox = document.createElement("div");
    errorBox.style.cssText = "position:fixed;left:16px;right:16px;top:24px;z-index:2147483647;margin:0 auto;max-width:560px;font:14px/1.5 system-ui;padding:20px 24px;color:#7f1d1d;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.12)";
    errorBox.innerHTML = '<b>This app hit an error.</b><pre style="white-space:pre-wrap;margin:8px 0 0;font:12px/1.5 ui-monospace,monospace"></pre>';
    errorBox.querySelector("pre").textContent = message;
    document.body.appendChild(errorBox);
  }
  function clearError() { if (errorBox) { errorBox.remove(); errorBox = null; } }
  window.addEventListener("error", function (e) { fail(e.message || String(e.error || "Unknown error")); });
  window.addEventListener("unhandledrejection", function (e) { fail(String((e.reason && e.reason.message) || e.reason || "Unhandled promise rejection")); });

  // "@/components/Hero" and "src/components/Hero.jsx" are the same file; relative imports are rewritten to the @/ form.
  function spec(path) { return "@/" + path.replace(/^src\//, "").replace(/\.(jsx|js)$/, ""); }
  function resolve(from, to) {
    var parts = from.replace(/^src\//, "").split("/"); parts.pop();
    to.split("/").forEach(function (seg) { if (seg === "..") parts.pop(); else if (seg !== ".") parts.push(seg); });
    return "@/" + parts.join("/").replace(/\.(jsx|js)$/, "");
  }
  function rewrite(path, source) {
    // Style files are added to the page directly, so importing them is a no-op.
    source = source.replace(/^[ \t]*import\s+["'][^"']+\.css["'];?[ \t]*$/gm, "");
    // An icon name lucide doesn't have would stop the whole app; it shows as a plain circle instead.
    var icons = 0;
    source = source.replace(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["'];?/g, function (m, names) {
      var ns = "__tlIcons" + (icons++);
      var out = "import * as " + ns + " from 'lucide-react';";
      names.split(",").forEach(function (part) {
        var bits = part.trim().split(/\s+as\s+/), name = (bits[0] || "").trim(), local = (bits[1] || bits[0] || "").trim();
        if (name) out += " const " + local + " = " + ns + "[" + JSON.stringify(name) + "] || " + ns + ".CircleHelp || " + ns + ".Circle;";
      });
      return out;
    });
    return source.replace(/(\bfrom\s*|\bimport\s*\(?\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\2/g, function (m, pre, q, rel) {
      return pre + q + resolve(path, rel) + q;
    });
  }

  // Libraries come from an import map (set once). The app's own files become blob modules that import each other by
  // address, so a new version can be loaded into the same page without reloading it.
  var map = document.createElement("script"); map.type = "importmap";
  map.textContent = JSON.stringify({ imports: JSON.parse(document.getElementById("tl-libs").textContent) });
  document.head.appendChild(map);
  var style = document.createElement("style"); document.head.appendChild(style);

  var compiled = {}; // path -> { source, out }: a file that didn't change isn't compiled again
  var modules = {};  // code -> blob address: the same code is the same module
  function moduleUrl(code) { return modules[code] || (modules[code] = URL.createObjectURL(new Blob([code], { type: "text/javascript" }))); }

  // A file that is imported but not written yet is a placeholder saying what's coming ("Writing Recipe List...").
  function placeholder(s, names) {
    var label = "Writing " + s.split("/").pop().replace(/([a-z])([A-Z])/g, "$1 $2") + "…";
    var lines = ["import { createElement } from 'react';", "function TlStub() { return createElement('div', { className: 'tl-stub', 'aria-hidden': true }, createElement('span', null, " + JSON.stringify(label) + ")); }", "export default TlStub;"];
    Object.keys(names).forEach(function (n) { if (n !== "TlStub" && n !== "createElement") lines.push("export const " + n + " = " + (/^[A-Z][a-z]/.test(n) ? "TlStub" : "[]") + ";"); });
    return lines.join("\n");
  }

  function build(files, stubs) {
    var css = [], out = {};
    Object.keys(files).sort().forEach(function (path) {
      var source = files[path];
      if (/\.css$/.test(path)) { css.push(source); return; }
      var hit = compiled[path];
      if (hit && hit.source === source) { out[path] = hit.out; return; }
      try {
        var code = Babel.transform(rewrite(path, source), { presets: [["react", { runtime: "automatic" }]], filename: path, sourceType: "module" }).code;
        compiled[path] = { source: source, out: code };
        out[path] = code;
      } catch (e) {
        if (!stubs) throw e; // half-written and not readable yet: its placeholder shows instead
      }
    });
    style.textContent = css.join("\n");

    var bySpec = {};
    Object.keys(out).forEach(function (p) { bySpec[spec(p)] = p; bySpec["@/" + p.replace(/^src\//, "")] = p; });
    var wanted = {};
    if (stubs) Object.keys(out).forEach(function (p) {
      var re = /import\s+([\w$]+)?\s*,?\s*(\{[^}]*\})?\s*from\s*["'](@\/[^"']+)["']/g, m;
      while ((m = re.exec(out[p]))) {
        if (bySpec[m[3]]) continue;
        var names = wanted[m[3]] || (wanted[m[3]] = {});
        if (m[2]) m[2].slice(1, -1).split(",").forEach(function (part) { var n = part.trim().split(/\s+as\s+/)[0].trim(); if (n && n !== "default") names[n] = 1; });
      }
    });

    var done = {}, visiting = {};
    function link(s) {
      var p = bySpec[s];
      if (!p) return wanted[s] ? moduleUrl(placeholder(s, wanted[s])) : null;
      if (done[p]) return done[p];
      if (visiting[p]) return null; // files that import each other in a loop: the browser reports it
      visiting[p] = true;
      var code = out[p].replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(@\/[^"']+)\2/g, function (m, pre, q, s2) {
        var u = link(s2);
        return u ? pre + q + u + q : m;
      });
      return (done[p] = moduleUrl(code));
    }
    var app = link("@/App");
    if (!app) throw new Error("The app needs a src/App.jsx file.");
    return { url: app, motion: Object.keys(files).some(function (p) { return files[p].indexOf("framer-motion") !== -1; }) };
  }

  var React, ReactDOM, Boundary, root = null, latest = 0;
  var libs = Promise.all([import("react"), import("react-dom/client")]).then(function (m) {
    React = m[0].default || m[0];
    ReactDOM = m[1];
    Boundary = class extends React.Component {
      constructor(p) { super(p); this.state = { error: null }; }
      static getDerivedStateFromError(error) { return { error: error }; }
      componentDidCatch(error) { fail(String((error && error.message) || error)); }
      render() { return this.state.error ? null : this.props.children; }
    };
  });

  function start(files, stubs, r) {
    var n = ++latest;
    var built;
    try { built = build(files, stubs); } catch (e) {
      if (stubs) return; // keep showing the last version that worked
      rev = r; draft = false;
      fail("Couldn't read the app's code: " + (e && e.message ? e.message : e));
      return;
    }
    // While the AI is writing, the page is rebuilt every moment; animations would replay each time, so they're skipped.
    var motion = built.motion ? import("framer-motion").then(function (m) { if (m.MotionGlobalConfig) m.MotionGlobalConfig.skipAnimations = stubs; }, function () {}) : null;
    Promise.all([libs, motion]).then(function () { return import(built.url); }).then(function (mod) {
      if (n !== latest) return;
      rev = r; draft = stubs;
      clearError();
      if (!root) root = ReactDOM.createRoot(document.getElementById("root"));
      root.render(React.createElement(Boundary, { key: n }, mod.default ? React.createElement(mod.default) : null));
      send("ready");
    }, function (e) {
      if (n !== latest || stubs) return;
      rev = r; draft = false;
      fail(String((e && e.message) || e));
    });
  }

  // New versions from the builder arrive as messages and replace the app in place.
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (e.source !== parent || !d || d.source !== "tl-builder" || d.type !== "files") return;
    start(d.files, !!d.stubs, d.rev);
  });
  start(JSON.parse(document.getElementById("tl-files").textContent), draft, rev);
  send("booted");
})();
`;

export interface DocumentOptions {
  title: string;
  /** Shown while the app loads. */
  accent?: string;
  /** Show files that are imported but not written yet as placeholders (the preview while the AI is still writing). */
  stubs?: boolean;
  /** The version number of these files; the page sends it back with every message. */
  rev?: number;
}

export function buildCodeDocument(files: CodeFiles, options: DocumentOptions): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(options.accent ?? "") ? (options.accent as string) : "#6366f1";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(options.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@500;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config = { theme: { extend: { fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], serif: ['"Playfair Display"', 'ui-serif', 'serif'] } } } };</script>
<style>html,body{margin:0;min-height:100%;font-family:Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}#tl-loading{position:fixed;inset:0;display:grid;place-items:center;background:#fff}#tl-loading i{width:28px;height:28px;border-radius:50%;border:3px solid ${accent}33;border-top-color:${accent};animation:tlspin .8s linear infinite}@keyframes tlspin{to{transform:rotate(360deg)}}#root:not(:empty)~#tl-loading{display:none}.tl-stub{display:grid;place-items:center;margin:24px auto;width:calc(100% - 32px);max-width:1120px;height:220px;border-radius:24px;background:linear-gradient(100deg,#f1f5f9 30%,#e2e8f0 50%,#f1f5f9 70%);background-size:200% 100%;animation:tlshimmer 1.2s linear infinite}@keyframes tlshimmer{to{background-position:-200% 0}}.tl-stub span{color:#64748b;font:600 14px/1.4 Inter,ui-sans-serif,system-ui,sans-serif}</style>
</head>
<body>
<div id="root"></div>
<div id="tl-loading"><i></i></div>
<script type="application/json" id="tl-files">${embedJson(Object.fromEntries(Object.keys(files).sort().map((path) => [path, files[path]])))}</script>
<script type="application/json" id="tl-libs">${embedJson(LIBS)}</script>
<script type="application/json" id="tl-opts">${embedJson({ stubs: options.stubs === true, rev: options.rev ?? 0 })}</script>
<script src="${BABEL_URL}"></script>
<script>${RUNTIME}</script>
</body>
</html>`;
}
