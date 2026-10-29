# Snip frontend

A small Angular 19 client for the Snip URL shortener: one standalone component,
one HttpClient service, and signals for UI state.

## Run

Start the backend from its separate checkout on `http://localhost:3000`, then:

```sh
npm install
npx ng serve
```

Open `http://localhost:4200`. Paste an HTTP(S) URL to create a short link.
The links table shows all links and hit counts; use **Refresh** after opening a
short link to see its updated count. Validation, API, and network errors appear
inline. Links are held in memory by the backend and disappear on restart.

The API endpoint is defined in `src/app/links.service.ts`:

- `POST http://localhost:3000/api/links` with `{ "url": "https://..." }`
- `GET http://localhost:3000/api/links`
- Short-code links open the backend's redirect URL in a new tab.

## Build and test

```sh
npx ng build
npx ng test --watch=false --browsers=ChromeHeadless
```

The project name **snip-frontend** is intentional: the production build must
contain `dist/snip-frontend/browser/index.html` for the later bundle build.
Tests require a local Chrome installation (or set `CHROME_BIN` to a compatible
Chromium browser).
