# Snip repository rules

Keep root `CLAUDE.md` and `.github/copilot-instructions.md` identical and in sync.
Snip is one backend with two clients. `main` is a superproject; each layer is an
orphan branch of this same repository, mounted as a submodule pinned to a SHA.

| Path | Branch | Stack / role |
| --- | --- | --- |
| `backend/` | `backend` | Single-file Bun server, zero dependencies |
| `frontend/` | `frontend` | Angular 19, standalone component + HttpClient service, signals |
| `cli/` | `cli` | Node 20+, global fetch, zero-dependency CommonJS CLI |
| `bundle/` | `bundle` | GENERATED server + built UI + CLI + Docker/Railway files |
| `scripts/`, `.github/` | `main` | Zero-dependency Node builder, Actions; CI uses Node 24 |

## Contract: change it everywhere or nowhere

Link: `{ code, url, shortUrl, hits, createdAt }`; six random base62 characters,
HTTP(S) URL, hit count initially 0, ISO timestamp. Open CORS and OPTIONS.

| Request | Result |
| --- | --- |
| `POST /api/links` with `{ "url": "https://..." }` | `201` link; `400` `{ error }` for invalid JSON/URL |
| `GET /api/links` | `200` array of links |
| `GET /:code` | `302` to destination, increment hits; `404` if unknown |

## Commands and changes

- Populate pinned checkouts: `git submodule update --init --recursive`.
- In `backend/`: `bun start` (port 3000). Config: `PORT`, `BASE_URL`,
  `RAILWAY_PUBLIC_DOMAIN`, optional `PUBLIC_DIR`; existing static files beat codes.
- In `frontend/`: `npm install`, `npx ng serve` (4200), `npx ng build`;
  `npx ng test --watch=false --browsers=ChromeHeadless`. Use `frontend/design.md`.
- In `cli/`: `node cli.js help`, `node cli.js ls`, `npm test`.
  `SNIP_API` defaults to `http://localhost:3000`.
- From clean `main`: `node scripts/build-bundle.mjs` builds and commits locally;
  add `--push` to publish bundle and main. Repeated unchanged builds must create
  no commits; guard commits with a staged-diff check.
- In `bundle/`: `bun start` serves UI + API + redirects on 3000.
  Stop any other server using that port first.

Edit a source layer, not its release copy. Inside its submodule, switch to its
branch first (clones may have detached HEADs), edit and test, then commit and push.
Back on `main`: `git submodule update --remote <path>`, `git add <path>`, commit
the pointer bump, and push. Rebuild the release separately with the builder.
Use `--remote` to advance a pointer intentionally, not to reproduce pinned SHAs.

## Do / don't

- Never hand-edit `bundle/`; change sources or `scripts/build-bundle.mjs`.
  Push detached release checkouts as `HEAD:bundle`.
- Keep `cli.js` CommonJS: never add `"type": "module"` to its package scope,
  including the generated package. Copy backend and CLI into the bundle as-is.
- Do not rename `snip-frontend` or change the load-bearing build output
  `frontend/dist/snip-frontend/browser/index.html` without updating the builder.
- Keep storage in-memory by design: restarts clear links; do not add persistence.
- The frontend currently calls localhost:3000; remote deployment requires an
  explicit source-level API-origin change, not a generated-file patch.
- Bundle CI intentionally has no push trigger: hourly schedule + manual dispatch
  on default branch `main`; source branches do not contain the workflow.
- Docker CI filters `main` pushes on the `bundle` GITLINK (not `bundle/**`) and
  its own workflow file, plus manual dispatch. Tags: `latest`, `sha-<short-SHA>`.
- `GITHUB_TOKEN` pushes do not trigger downstream push workflows; preserve the
  bundle job's explicit image dispatch for changed releases and `actions: write`.
