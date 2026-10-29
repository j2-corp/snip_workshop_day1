# Snip

One backend, two clients: shorten URLs in an Angular web app or a Node CLI.
Both clients use the same Bun API and see the same in-memory links and hit counts.
Restarting the backend clears all links by design.

## One repository, independent layers

Each layer has its own orphan branch with independent history and files at its
branch root. This `main` branch is a superproject: submodule gitlinks pin exact
commits from those branches of this same repository.

```text
snip-demo/                 main: superproject, README, .gitmodules
  backend/                backend branch: zero-dependency Bun server
  frontend/               frontend branch: Angular 19 web app
  cli/                    cli branch: zero-dependency Node CLI
  bundle/                 generated release: server, built UI, CLI, deployment files
```

`.gitmodules` records each submodule's URL and tracked branch. Tracking a branch
does not automatically update a pinned commit: pointer bumps are explicit.

## Clone

```sh
git clone --branch main --recurse-submodules https://github.com/j2-corp/snip_workshop_day1.git
cd snip_workshop_day1
```

Plain clones leave submodule folders empty. To populate an existing clone:

```sh
git submodule update --init --recursive
```

The explicit `--branch main` also works if GitHub's default branch is still
`backend`.

## Run

Install Bun 1.x and Node 20+ with npm. From the `main` checkout, use three terminals:

**Backend** ([details](backend/README.md)):

```sh
cd backend
bun start
```

The API listens at `http://localhost:3000`. Optional environment variables:
`PORT` (default `3000`), `BASE_URL` (short-link origin), and `PUBLIC_DIR` (serve
static files, with `/` mapped to `index.html`). Without `BASE_URL`, the short-link
origin uses `https://$RAILWAY_PUBLIC_DOMAIN` when set, otherwise localhost.
Existing static files take precedence over a same-named short code.

**Web client** ([details](frontend/README.md)):

```sh
cd frontend
npm install
npx ng serve
```

Open `http://localhost:4200`, paste an HTTP(S) URL, and submit. Refresh the links
table to see updated hit counts. The web client calls `http://localhost:3000`.
Reusable styling tokens live in [frontend/design.md](frontend/design.md).
`npx ng build` outputs `dist/snip-frontend/browser` inside the frontend checkout.

**CLI** ([details](cli/README.md)):

```sh
cd cli
node cli.js help
node cli.js add https://example.com
node cli.js ls
node cli.js open Ab12Cd
```

Replace `Ab12Cd` with a returned code. `SNIP_API` overrides the CLI backend origin
(default `http://localhost:3000`). No dependency installation is needed for the
backend or CLI.

## API contract

Every link has `{ code, url, shortUrl, hits, createdAt }`: a six-character random
base62 code, HTTP(S) destination, short URL, hit count starting at zero, and ISO
timestamp. CORS is open and OPTIONS preflight is supported.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/links` | `{ "url": "https://example.com" }` | `201` link object; `400` `{ error }` for invalid JSON or a non-HTTP(S) URL |
| GET | `/api/links` | None | `200` array of link objects |
| GET | `/:code` | None | `302` to the destination and increment hits; `404` if unknown |

Keep the API contract consistent across all three layers.

## Update a layer and pin its commit

Submodules may be checked out with a detached HEAD after cloning. Switch to the
layer's branch before editing. For example:

```sh
cd backend
git switch backend
# Edit and verify the backend.
git add -A
git commit -m "Update backend"
git push origin backend
cd ..
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push origin main
```

Use `frontend` or `cli` instead for those layers. The first commit changes the
layer; the second records its new pinned SHA on `main`. After pulling updates to
`main`, run `git submodule update --init --recursive` to materialize the pinned
versions. Use `--remote` only when intentionally advancing a pointer to a branch
tip rather than reproducing the current pinned snapshot.

## Generate a release bundle

`bundle` is generated output on its own branch, pinned as a fourth submodule.
Never hand-edit it. From a clean `main` checkout:

```sh
node scripts/build-bundle.mjs
node scripts/build-bundle.mjs --push
```

The zero-dependency Node script updates source submodules to their branch tips,
runs `npm install` and the production Angular build, then copies the backend,
CLI, and `dist/snip-frontend/browser` into `bundle`. It generates `.env`
(`PUBLIC_DIR=./public`), a CommonJS-compatible package manifest, Dockerfile,
`.dockerignore`, and Railway Dockerfile configuration. It commits only changed
release files and submodule pointers. Repeating an unchanged build creates no
commits. Only `--push` publishes commits; it also publishes commits left by an
earlier local-only run. Dirty checkouts or pre-staged changes fail explicitly.

Run the assembled release:

```sh
cd bundle
bun start
# Or: docker build -t snip .
#     docker run --rm -p 3000:3000 snip
```

Stop any existing backend on port 3000 first. One Bun process serves the UI, API,
and redirects at `http://localhost:3000`; `node cli.js ls` uses the same API.
The current frontend still targets `http://localhost:3000`, so remote deployment
requires a separate frontend API-origin change in its source branch.
