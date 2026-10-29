# Snip backend

A zero-dependency Bun URL shortener. Links are kept in memory and are cleared
when the server restarts.

## Run

Install [Bun](https://bun.sh/), then run:

```sh
bun start
```

The server listens on port `3000` by default. Configure `PORT`, `BASE_URL`,
and optionally `PUBLIC_DIR` with environment variables.

## API

- `POST /api/links` with `{"url":"https://example.com"}` creates a short link.
- `GET /api/links` lists links and their hit counts.
- `GET /:code` redirects to the original URL and increments its hit count.
