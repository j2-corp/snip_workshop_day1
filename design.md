# Snip design language

An original dark interpretation of the reference's centered hero, oversized
chat-like input, soft atmospheric color, and spacious rounded surfaces.
Use Snip's own identity and copy; no reference-site branding or assets.

## Tokens (implemented in `src/styles.css`)

| Token | Value / role |
| --- | --- |
| Background | `#0e0d12`, near-black |
| Surface / raised | `#19171e` / `#221f28` |
| Text / muted | `#faf5f2` / `#b8afbf` |
| Accent / link | `#ffc4b2` |
| Primary gradient | `135deg`, `#ffd4bd` to `#f39ab7`; dark button text |
| Hero glow | Pink `rgba(218,86,145,.22)`, coral `rgba(246,108,83,.20)`, orange `rgba(245,153,76,.12)` radial layers |
| Border | `rgba(255,255,255,.10)`; stronger input border `.18` |
| Shadow | `0 24px 80px #00000030`; input `0 16px 64px #00000040` |
| Focus | `#ffc4b2`, 2px outline with 4px offset |
| Status | Error `#ffb8bf` on `#351d27`; success `#b9edce` on `#182b24` |
| Font | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Type | Hero `clamp(3.5rem, 8vw, 5.5rem)`; section 1.1rem; body 1rem; small .85rem; eyebrow .7rem |
| Spacing | 8 / 12 / 16 / 24 / 32 / 48 / 80px; content width 880px |
| Radii | Cards 28px; notices 16px; hero input 32px; buttons pill (999px) |

## Element mapping

- **Page header:** centered hero, tight bold headline, small tracked eyebrow,
  muted subline. Keep generous space above and below.
- **URL form:** transparent section; visually hidden but accessible heading and
  label. One large chat-style input shell with an attached gradient action.
  Stack the action inside the same shell on narrow screens.
- **Result / error:** rounded, tinted inline notices; preserve status/alert roles
  and clear link underlines. No color-only error communication.
- **Links table:** generously rounded dark card, subtle border, quiet header,
  fine row dividers, warm code links, right-aligned tabular hit counts.
- **Refresh / footer:** secondary surface button and subdued supporting text.
- **Glow:** `body::before`, fixed at the top, `left: 0; right: 0`,
  height 680px, `pointer-events: none`; layered behind the content, never
  constrained by the centered column. Entire page retains its near-black base.
- **Responsive / interaction:** no motion required; retain visible keyboard focus,
  readable contrast, disabled states, mobile padding, and horizontal table scroll.
