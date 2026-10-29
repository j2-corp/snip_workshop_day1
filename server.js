const fs = require("node:fs");
const path = require("node:path");

const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const portValue = process.env.PORT ?? "3000";
if (!/^\d+$/.test(portValue)) {
  throw new Error("PORT must be an integer between 1 and 65535");
}
const port = Number(portValue);
if (port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const configuredBaseUrl =
  process.env.BASE_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`);
const parsedBaseUrl = new URL(configuredBaseUrl);
if (!["http:", "https:"].includes(parsedBaseUrl.protocol) || !parsedBaseUrl.hostname) {
  throw new Error("BASE_URL must be an HTTP(S) origin");
}
const baseUrl = parsedBaseUrl.origin;

const publicRoot = process.env.PUBLIC_DIR
  ? path.resolve(process.env.PUBLIC_DIR)
  : null;
if (publicRoot && (!fs.existsSync(publicRoot) || !fs.statSync(publicRoot).isDirectory())) {
  throw new Error(`PUBLIC_DIR is not an existing directory: ${publicRoot}`);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function respond(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, ...headers },
  });
}

function json(body, status = 200) {
  return respond(JSON.stringify(body), status, {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function createCode() {
  let code;
  do {
    code = "";
    while (code.length < 6) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      for (const byte of bytes) {
        if (byte < 248) {
          code += alphabet[byte % alphabet.length];
          if (code.length === 6) break;
        }
      }
    }
  } while (links.has(code));
  return code;
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function serveStaticFile(request, pathname) {
  if (!publicRoot || !["GET", "HEAD"].includes(request.method)) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const candidate = path.resolve(publicRoot, `.${requestedPath}`);
  const relativePath = path.relative(publicRoot, candidate);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  try {
    const realRoot = fs.realpathSync(publicRoot);
    const realCandidate = fs.realpathSync(candidate);
    const realRelativePath = path.relative(realRoot, realCandidate);
    if (
      realRelativePath === ".." ||
      realRelativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(realRelativePath) ||
      !fs.statSync(realCandidate).isFile()
    ) {
      return null;
    }

    const headers = {
      "Content-Type":
        contentTypes[path.extname(realCandidate).toLowerCase()] ?? "application/octet-stream",
    };
    return request.method === "HEAD"
      ? respond(null, 200, headers)
      : respond(Bun.file(realCandidate), 200, headers);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}

Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return respond(null, 204);
    }

    if (pathname === "/api/links" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Request body must be valid JSON" }, 400);
      }

      if (typeof body?.url !== "string") {
        return json({ error: "url must be an HTTP(S) URL" }, 400);
      }

      let originalUrl;
      try {
        originalUrl = new URL(body.url);
      } catch {
        return json({ error: "url must be an HTTP(S) URL" }, 400);
      }
      if (
        !["http:", "https:"].includes(originalUrl.protocol) ||
        !originalUrl.hostname
      ) {
        return json({ error: "url must be an HTTP(S) URL" }, 400);
      }

      const link = {
        code: createCode(),
        url: originalUrl.href,
        shortUrl: "",
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      link.shortUrl = `${baseUrl}/${link.code}`;
      links.set(link.code, link);
      return json(link, 201);
    }

    if (pathname === "/api/links" && request.method === "GET") {
      return json(Array.from(links.values()));
    }

    const staticResponse = serveStaticFile(request, pathname);
    if (staticResponse) return staticResponse;

    if (request.method === "GET" && /^\/[^/]+$/.test(pathname)) {
      let code;
      try {
        code = decodeURIComponent(pathname.slice(1));
      } catch {
        return json({ error: "Not found" }, 404);
      }

      const link = links.get(code);
      if (!link) return json({ error: "Not found" }, 404);
      link.hits += 1;
      return respond(null, 302, { Location: link.url });
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Snip backend listening on ${baseUrl}`);
