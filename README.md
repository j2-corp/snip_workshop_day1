# Snip CLI

A zero-dependency CommonJS CLI for Node 20+. Start the Snip backend separately.

```sh
node cli.js help
node cli.js add https://example.com
node cli.js ls
node cli.js open Ab12Cd
```

The default backend is `http://localhost:3000`. Set `SNIP_API` to another HTTP(S)
origin when needed (PowerShell: `$env:SNIP_API = 'http://localhost:3000'`).
Requests time out after 10 seconds.

`add` prints the short URL. `ls` prints an aligned code/hits/url table, or
`No links yet.`. `open` requests the code without following its redirect, then
launches the Location target with Windows PowerShell `Start-Process`, macOS
`open`, or Linux `xdg-open`. The redirect request increments the backend hit count.
Errors go to stderr with exit code 1; no arguments or `help` prints usage.

Wrappers: `./snip` on Unix, `.\snip.cmd` or `.\snip.ps1` on Windows. All forward
arguments to `cli.js`; the PowerShell wrapper is subject to your execution policy.
You can also run `npm link` to install the `snip` command locally.

Keep `cli.js` CommonJS: do not add `"type": "module"` to its package scope.
Run `npm test` for the zero-dependency tests.
