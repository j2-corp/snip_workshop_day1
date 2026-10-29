#!/usr/bin/env node
const childProcess = require("node:child_process");

const usage = `Usage:
  snip add <url>    Shorten an HTTP(S) URL
  snip ls           List codes, hit counts, and original URLs
  snip open <code>  Open a short link in your browser (counts one hit)
  snip help        Show this help

SNIP_API sets the backend URL (default: http://localhost:3000).
`;

function httpUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid HTTP(S) URL`);
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
    throw new Error(`${label} must be a valid HTTP(S) URL`);
  }
  return url;
}

async function request(base, pathname, options = {}) {
  let response;
  try {
    response = await fetch(new URL(pathname, base), {
      ...options,
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new Error(`Cannot reach backend at ${base.origin}: ${error.message}`);
  }
  if (response.status === 404) throw new Error("Not found: unknown code or API endpoint");
  if (!response.ok && response.status !== 302) {
    const text = await response.text();
    let detail = text;
    try {
      const body = JSON.parse(text);
      if (typeof body?.error === "string") detail = body.error;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    throw new Error(`Backend returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response;
}

function openBrowser(url) {
  let command;
  let args;
  let env = process.env;
  if (process.platform === "win32") {
    command = "powershell.exe";
    args = ["-NoProfile", "-NonInteractive", "-Command",
      "$ErrorActionPreference = 'Stop'; Start-Process -FilePath $env:SNIP_OPEN_URL"];
    // Keep the untrusted URL out of shell source and command-line parsing.
    env = { ...process.env, SNIP_OPEN_URL: url };
  } else {
    command = process.platform === "darwin" ? "open" : "xdg-open";
    args = [url];
  }
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, { env, stdio: "ignore" });
    child.once("error", (error) => reject(new Error(`Cannot open browser: ${error.message}`)));
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Browser launcher exited with code ${code}`));
    });
  });
}

async function main(args = process.argv.slice(2)) {
  const [command, value] = args;
  if (args.length === 0 || (command === "help" && args.length === 1)) {
    process.stdout.write(usage);
    return;
  }
  const expectedArgs = { add: 2, ls: 1, open: 2 };
  if (!Object.hasOwn(expectedArgs, command) || args.length !== expectedArgs[command]) {
    throw new Error("Invalid arguments. Run 'snip help' for usage.");
  }

  const base = httpUrl(process.env.SNIP_API ?? "http://localhost:3000", "SNIP_API");
  if (command === "add") {
    httpUrl(value, "URL");
    const response = await request(base, "/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: value }),
    });
    if (response.status !== 201) throw new Error("Backend did not return HTTP 201");
    const link = await response.json();
    if (typeof link?.shortUrl !== "string") throw new Error("Backend returned an invalid link");
    httpUrl(link.shortUrl, "Returned short URL");
    console.log(link.shortUrl);
  } else if (command === "ls") {
    const response = await request(base, "/api/links");
    if (response.status !== 200) throw new Error("Backend did not return HTTP 200");
    const links = await response.json();
    if (!Array.isArray(links) || links.some((link) =>
      !link || typeof link.code !== "string" || typeof link.url !== "string" ||
      !Number.isInteger(link.hits) || link.hits < 0)) {
      throw new Error("Backend returned an invalid links list");
    }
    if (links.length === 0) {
      console.log("No links yet.");
      return;
    }
    const codeWidth = Math.max(4, ...links.map((link) => link.code.length));
    const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits).length));
    console.log(`${"CODE".padEnd(codeWidth)}  ${"HITS".padStart(hitsWidth)}  URL`);
    for (const link of links) {
      console.log(`${link.code.padEnd(codeWidth)}  ${String(link.hits).padStart(hitsWidth)}  ${link.url}`);
    }
  } else {
    if (!/^[A-Za-z0-9]{6}$/.test(value)) {
      throw new Error("Code must contain exactly 6 base62 characters");
    }
    const response = await request(base, `/${value}`);
    if (response.status !== 302) throw new Error("Backend did not return an HTTP 302 redirect");
    const location = response.headers.get("Location");
    if (!location) throw new Error("Backend redirect is missing its Location header");
    await openBrowser(httpUrl(location, "Redirect target").href);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`snip: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
