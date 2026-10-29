const { test } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const { EventEmitter } = require("node:events");
const http = require("node:http");
const path = require("node:path");
const { promisify } = require("node:util");
const { main } = require("./cli");

const execFile = promisify(childProcess.execFile);
const cli = path.join(__dirname, "cli.js");

test("help and no arguments work without a backend", async () => {
  for (const args of [[], ["help"]]) {
    const result = await execFile(process.execPath, [cli, ...args]);
    assert.match(result.stdout, /Usage:/);
    assert.equal(result.stderr, "");
  }
});

test("bad input and an unreachable backend exit 1 with stderr only", async () => {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  for (const args of [["add", "ftp://example.com"], ["open", "bad"], ["wat"], ["ls", "extra"], ["ls"]]) {
    await assert.rejects(
      execFile(process.execPath, [cli, ...args], {
        env: { ...process.env, SNIP_API: `http://127.0.0.1:${port}` }
      }),
      (error) => {
        assert.equal(error.code, 1);
        assert.equal(error.stdout, "");
        assert.match(error.stderr, /snip:/);
        return true;
      }
    );
  }
});

test("add/list work against HTTP and API failures exit 1", async (t) => {
  const links = [];
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/links" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const { url } = JSON.parse(raw);
      assert.equal(url, "https://example.com/article");
      const link = { code: "Ab12Cd", hits: 0, url, shortUrl: "http://localhost:3000/Ab12Cd" };
      links.push(link);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(link));
    } else if (req.url === "/api/links") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(links));
    } else {
      res.writeHead(404);
      res.end('{"error":"Unknown code"}');
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const env = { ...process.env, SNIP_API: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => execFile(process.execPath, [cli, ...args], { env });
  assert.equal((await run("ls")).stdout.trim(), "No links yet.");
  assert.equal((await run("add", "https://example.com/article")).stdout.trim(),
    "http://localhost:3000/Ab12Cd");
  assert.equal((await run("ls")).stdout,
    "CODE    HITS  URL\nAb12Cd     0  https://example.com/article\n");
  await assert.rejects(run("open", "000000"), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /unknown code/);
    return true;
  });
});

test("open requests a manual redirect and launches the Location safely", async (t) => {
  const target = "https://example.com/?a=1&b=2";
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.pathname, "/Ab12Cd");
    assert.equal(options.redirect, "manual");
    return new Response(null, { status: 302, headers: { Location: target } });
  });
  const spawn = t.mock.method(childProcess, "spawn", (command, args, options) => {
    if (process.platform === "win32") {
      assert.equal(command, "powershell.exe");
      assert.equal(options.env.SNIP_OPEN_URL, target);
      assert.ok(!args.join(" ").includes(target));
    } else {
      assert.equal(command, process.platform === "darwin" ? "open" : "xdg-open");
      assert.deepEqual(args, [target]);
    }
    const child = new EventEmitter();
    process.nextTick(() => child.emit("close", 0));
    return child;
  });
  await main(["open", "Ab12Cd"]);
  assert.equal(spawn.mock.callCount(), 1);
});

test("open surfaces missing Location, unsafe target, and launcher failures", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 302 }));
  await assert.rejects(main(["open", "Ab12Cd"]), /missing its Location/);
  fetch.mock.mockImplementation(async () =>
    new Response(null, { status: 302, headers: { Location: "file:///private" } }));
  await assert.rejects(main(["open", "Ab12Cd"]), /HTTP\(S\)/);
  fetch.mock.mockImplementation(async () =>
    new Response(null, { status: 302, headers: { Location: "https://example.com" } }));
  t.mock.method(childProcess, "spawn", () => {
    const child = new EventEmitter();
    process.nextTick(() => child.emit("close", 1));
    return child;
  });
  await assert.rejects(main(["open", "Ab12Cd"]), /launcher exited with code 1/);
});

test("API error messages are surfaced", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "URL rejected" }, { status: 400 }));
  await assert.rejects(main(["add", "https://example.com"]), /HTTP 400: URL rejected/);
});
