// Obtenha o código fonte — servidor Node (Render, Railway, Koyeb, etc.).
// Arquivo único: a página e a API estão aqui. Requer Node 18+.
const http = require("http");

const PORT = process.env.PORT || 3000;
const MAX_BYTES = 5 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

function normalizeUrl(input) {
  let u = String(input || "").trim();
  if (!u) throw new Error("Informe uma URL.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = "https://" + u;
  const p = new URL(u);
  if (!["http:", "https:"].includes(p.protocol)) throw new Error("Só http/https.");
  return p.toString();
}

async function getSource(raw) {
  const url = normalizeUrl(raw);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error("Arquivo maior que 5 MB.");
    return {
      url,
      finalUrl: r.url,
      status: r.status,
      contentType: r.headers.get("content-type") || "",
      source: buf.toString("utf8"),
    };
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Tempo esgotado (20 s).");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

http
  .createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname === "/api") {
      try {
        const out = await getSource(u.searchParams.get("url"));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: e.message || "Erro ao buscar o site." }));
      }
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE);
  })
  .listen(PORT, "0.0.0.0", () => console.log("Rodando na porta " + PORT));

const PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Obtenha o código fonte</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f4fb; --fg:#1d1b24; --muted:#6d6a78;
          --accent:#7a4fc4; --card:#fff; --line:#e3deef; --code:#faf9fd; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14121a; --fg:#ece9f4; --muted:#9a96a8; --accent:#a98aea;
            --card:#1d1a26; --line:#2d2939; --code:#17141f; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:system-ui,sans-serif; }
  header { padding:2.2rem 1.2rem 1.4rem; background:linear-gradient(135deg,#4b3a7a,#a8567a); color:#fff; }
  header h1 { margin:0 0 .5rem; font-size:1.5rem; font-weight:500; }
  header p { margin:0; font-size:.85rem; opacity:.85; line-height:1.4; }
  .bar { display:flex; margin:1.2rem; border:1px solid var(--accent); border-radius:999px;
         overflow:hidden; background:var(--card); }
  .bar input { flex:1; min-width:0; border:0; background:transparent; color:inherit;
               padding:.9rem 1rem; font-size:1rem; outline:none; }
  .bar button { border:0; border-left:1px solid var(--line); background:transparent;
                color:var(--fg); font-weight:700; padding:0 1.3rem; font-size:.9rem; }
  .bar button:disabled { opacity:.5; }
  #status { text-align:center; color:var(--muted); font-size:.9rem; padding:0 1.2rem; }
  #status.err { color:#d9534f; }
  #result { display:none; }
  .tools { display:flex; gap:.5rem; padding:.2rem 1.2rem .8rem; flex-wrap:wrap; }
  .tools button { border:1px solid var(--line); background:var(--card); color:var(--fg);
                  padding:.55rem .9rem; border-radius:10px; font-size:.85rem; }
  .meta { padding:0 1.2rem .6rem; font-size:.78rem; color:var(--muted); word-break:break-all; }
  .code { display:flex; overflow:auto; background:var(--code); border-top:1px solid var(--line);
          border-bottom:1px solid var(--line); max-height:70vh;
          font:12px/1.55 ui-monospace,Menlo,Consolas,monospace; }
  .nums { padding:.8rem .6rem; text-align:right; color:var(--muted); user-select:none;
          border-right:1px solid var(--line); position:sticky; left:0; background:var(--code);
          white-space:pre; }
  pre#src { margin:0; padding:.8rem 1rem; white-space:pre; tab-size:2; }
  iframe { width:100%; height:70vh; border:0; background:#fff; display:none; }
  #res { padding:1rem 1.2rem 2rem; }
  #res h2 { font-size:.9rem; margin:0 0 .5rem; color:var(--muted); font-weight:600; }
  #res a { display:block; padding:.55rem .7rem; margin-bottom:.35rem; border:1px solid var(--line);
           border-radius:8px; background:var(--card); color:var(--accent); font-size:.8rem;
           word-break:break-all; text-decoration:none; }
</style>
</head>
<body>
<header>
  <h1>Obtenha o código fonte</h1>
  <p>Digite uma URL e toque em “VAI” para obter o código-fonte usado por um site.
     Depois, você pode copiar, salvar ou visualizar.</p>
</header>

<form class="bar" id="f">
  <input id="url" type="text" inputmode="url" autocapitalize="off" autocorrect="off"
         placeholder="URL: https://exemplo.com" required>
  <button id="go" type="submit">VAI</button>
</form>
<div id="status"></div>

<section id="result">
  <div class="meta" id="meta"></div>
  <div class="tools">
    <button id="copy" type="button">Copiar</button>
    <button id="save" type="button">Salvar</button>
    <button id="view" type="button">Visualizar</button>
  </div>
  <div class="code" id="codebox">
    <div class="nums" id="nums"></div>
    <pre id="src"></pre>
  </div>
  <iframe id="preview" sandbox="allow-scripts"></iframe>
  <div id="res"></div>
</section>

<script>
var $ = function (id) { return document.getElementById(id); };
var current = null, previewing = false;

function load(url) {
  $("go").disabled = true;
  $("status").className = ""; $("status").textContent = "Buscando…";
  return fetch("/api?url=" + encodeURIComponent(url))
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (x) {
      if (!x.ok) throw new Error(x.d.error || "Erro desconhecido");
      current = x.d; $("url").value = x.d.finalUrl;
      show(x.d); $("status").textContent = "";
      if (x.d.status >= 400) {
        $("status").className = "err";
        $("status").textContent = "O site respondeu HTTP " + x.d.status + ".";
      }
    })
    .catch(function (err) {
      $("status").className = "err"; $("status").textContent = err.message;
    })
    .then(function () { $("go").disabled = false; });
}

$("f").addEventListener("submit", function (e) {
  e.preventDefault(); $("result").style.display = "none"; load($("url").value);
});

function show(d) {
  var lines = d.source.split("\\n").length, n = [];
  for (var i = 1; i <= lines; i++) n.push(i);
  $("meta").textContent = d.finalUrl + " · HTTP " + d.status + " · " + lines + " linhas";
  $("src").textContent = d.source;
  $("nums").textContent = n.join("\\n");
  listResources(d);
  setPreview(false);
  $("result").style.display = "block";
}

function listResources(d) {
  var box = $("res"); box.innerHTML = "";
  var re = /(?:src|href)\\s*=\\s*["']([^"'#]+)["']/gi, m, seen = {}, items = [];
  while ((m = re.exec(d.source))) {
    try {
      var abs = new URL(m[1], d.finalUrl).toString();
      if (/\\.(m?js|css|json)(\\?|$)/i.test(abs) && !seen[abs]) { seen[abs] = 1; items.push(abs); }
    } catch (e) {}
  }
  if (!items.length) return;
  var h = document.createElement("h2");
  h.textContent = "Arquivos usados pela página (toque para ver o código)";
  box.appendChild(h);
  items.forEach(function (u) {
    var a = document.createElement("a");
    a.href = "#"; a.textContent = u;
    a.onclick = function (ev) { ev.preventDefault(); window.scrollTo(0, 0); load(u); };
    box.appendChild(a);
  });
}

function setPreview(on) {
  previewing = on;
  $("codebox").style.display = on ? "none" : "flex";
  $("preview").style.display = on ? "block" : "none";
  $("view").textContent = on ? "Ver código" : "Visualizar";
  if (on) $("preview").srcdoc = '<base href="' + current.finalUrl.replace(/"/g, "&quot;") + '">' + current.source;
}

$("view").onclick = function () { if (current) setPreview(!previewing); };

$("copy").onclick = function () {
  if (!current) return;
  var done = function (t) { $("copy").textContent = t; setTimeout(function () { $("copy").textContent = "Copiar"; }, 1500); };
  if (navigator.clipboard) navigator.clipboard.writeText(current.source).then(function () { done("Copiado ✓"); }, function () { done("Falhou"); });
  else done("Falhou");
};

$("save").onclick = function () {
  if (!current) return;
  var u = new URL(current.finalUrl);
  var base = u.pathname.split("/").filter(Boolean).pop();
  var name = /\\.[a-z0-9]+$/i.test(base || "") ? base : u.hostname.replace(/[^a-z0-9.-]/gi, "_") + ".html";
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([current.source], { type: "text/plain" }));
  a.download = name; a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
};
</script>
</body>
</html>`;
