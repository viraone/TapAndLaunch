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
  // Every message says which page it came from, so the builder can ignore a page it has already replaced.
  window.__tlDoc = opts.doc || "";
  var send = function (type, message) { try { parent.postMessage({ source: "tl-app", type: type, message: message, doc: window.__tlDoc }, "*"); } catch (e) {} };

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

  var shown = false;
  function fail(message) {
    send("error", message);
    if (shown) return; shown = true;
    var root = document.getElementById("root");
    if (root) root.innerHTML = '<div style="font:14px/1.5 system-ui;padding:24px;max-width:560px;margin:40px auto;color:#7f1d1d;background:#fef2f2;border:1px solid #fecaca;border-radius:12px"><b>This app hit an error.</b><pre style="white-space:pre-wrap;margin:8px 0 0;font:12px/1.5 ui-monospace,monospace"></pre></div>';
    var pre = root && root.querySelector("pre"); if (pre) pre.textContent = message;
  }
  window.addEventListener("error", function (e) { fail(e.message || String(e.error || "Unknown error")); });
  window.addEventListener("unhandledrejection", function (e) { fail(String((e.reason && e.reason.message) || e.reason || "Unhandled promise rejection")); });

  var files = JSON.parse(document.getElementById("tl-files").textContent);
  var css = [], code = {};

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
    return source.replace(/(\bfrom\s*|\bimport\s*\(?\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\2/g, function (m, pre, q, rel) {
      return pre + q + resolve(path, rel) + q;
    });
  }

  try {
    var imports = JSON.parse(document.getElementById("tl-libs").textContent);
    var outputs = [];
    Object.keys(files).forEach(function (path) {
      if (path.endsWith(".css")) { css.push(files[path]); return; }
      var out = Babel.transform(rewrite(path, files[path]), { presets: [["react", { runtime: "classic" }]], filename: path, sourceType: "module" }).code;
      outputs.push(out);
      var url = URL.createObjectURL(new Blob([out], { type: "text/javascript" }));
      imports[spec(path)] = url; imports["@/" + path.replace(/^src\//, "")] = url;
    });
    // While the AI is still writing, files that don't exist yet are shown as shimmering placeholders.
    if (opts.stubs) {
      var wanted = {};
      outputs.forEach(function (out) {
        var re = /import\s+([\w$]+)?\s*,?\s*(\{[^}]*\})?\s*from\s*["'](@\/[^"']+)["']/g, m;
        while ((m = re.exec(out))) {
          if (imports[m[3]]) continue;
          var names = wanted[m[3]] || (wanted[m[3]] = {});
          if (m[2]) m[2].slice(1, -1).split(",").forEach(function (part) { var n = part.trim().split(/\s+as\s+/)[0].trim(); if (n && n !== "default") names[n] = 1; });
        }
      });
      Object.keys(wanted).forEach(function (s) {
        var lines = ["import React from 'react';", "function TlStub() { return React.createElement('div', { className: 'tl-stub', 'aria-hidden': true }); }", "export default TlStub;"];
        Object.keys(wanted[s]).forEach(function (n) { if (n !== "TlStub") lines.push("export const " + n + " = " + (/^[A-Z][a-z]/.test(n) ? "TlStub" : "[]") + ";"); });
        imports[s] = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/javascript" }));
      });
    }
    var style = document.createElement("style"); style.textContent = css.join("\n"); document.head.appendChild(style);
    var map = document.createElement("script"); map.type = "importmap"; map.textContent = JSON.stringify({ imports: imports }); document.head.appendChild(map);
  } catch (e) { fail("Couldn't read the app's code: " + (e && e.message ? e.message : e)); return; }

  var boot = document.createElement("script"); boot.type = "module";
  boot.textContent = [
    "import React from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import App from '@/App';",
    "class Boundary extends React.Component {",
    "  constructor(p) { super(p); this.state = { error: null }; }",
    "  static getDerivedStateFromError(error) { return { error: error }; }",
    "  componentDidCatch(error) { window.dispatchEvent(new ErrorEvent('error', { message: String(error && error.message || error) })); }",
    "  render() { return this.state.error ? null : this.props.children; }",
    "}",
    "createRoot(document.getElementById('root')).render(React.createElement(Boundary, null, React.createElement(App)));",
    "parent.postMessage({ source: 'tl-app', type: 'ready', doc: window.__tlDoc }, '*');"
  ].join("\n");
  boot.onerror = function () { fail("The app couldn't start."); };
  document.body.appendChild(boot);
})();
`;

export interface DocumentOptions {
  title: string;
  /** Shown while the app loads. */
  accent?: string;
  /** Show files that are imported but not written yet as placeholders (the preview while the AI is still writing). */
  stubs?: boolean;
  /** Sent back with every message from the page, so the builder knows which page is speaking. */
  doc?: string;
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
<style>html,body{margin:0;min-height:100%;font-family:Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}#tl-loading{position:fixed;inset:0;display:grid;place-items:center;background:#fff}#tl-loading i{width:28px;height:28px;border-radius:50%;border:3px solid ${accent}33;border-top-color:${accent};animation:tlspin .8s linear infinite}@keyframes tlspin{to{transform:rotate(360deg)}}#root:not(:empty)~#tl-loading{display:none}.tl-stub{margin:24px auto;width:calc(100% - 32px);max-width:1120px;height:220px;border-radius:24px;background:linear-gradient(100deg,#f1f5f9 30%,#e2e8f0 50%,#f1f5f9 70%);background-size:200% 100%;animation:tlshimmer 1.2s linear infinite}@keyframes tlshimmer{to{background-position:-200% 0}}</style>
</head>
<body>
<div id="root"></div>
<div id="tl-loading"><i></i></div>
<script type="application/json" id="tl-files">${embedJson(files)}</script>
<script type="application/json" id="tl-libs">${embedJson(LIBS)}</script>
<script type="application/json" id="tl-opts">${embedJson({ stubs: options.stubs === true, doc: options.doc ?? "" })}</script>
<script src="${BABEL_URL}"></script>
<script>${RUNTIME}</script>
</body>
</html>`;
}
