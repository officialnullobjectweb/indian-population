# India — Population by State & District (Census 2011)

Interactive choropleth of India with state → district drill-down. **Next.js + React**,
d3 for the map (bundled via npm) — no CDN, no API calls. All data files are local.

![India choropleth](docs/og-image.png)

🎬 Demo tour (click to play — MP4 plays right on GitHub):

[![Demo tour: drill from India to a district](docs/screenshot-focus.png)](docs/demo.mp4)

([webm version](docs/demo.webm)) Click a state to zoom into its districts,
click a district to focus it, recolor by literacy / sex ratio / electricity.

| India (dark) | Districts | District focus |
|---|---|---|
| ![dark](docs/screenshot-india-dark.png) | ![districts](docs/screenshot-districts.png) | ![focus](docs/screenshot-focus.png) |

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run clean-data # rebuild public/data/districts.json from the raw CSV
```

Production: `npm run build && npm start`.

## Test

```bash
npm run test:e2e      # 9 Playwright tests: views, drill-down, dropdown, theme, fallback, locality
npm run capture-assets -- http://localhost:3000  # regenerate docs/ screenshots + demo
```

The suite also asserts the page makes **zero external network requests**.

## SEO

App-router metadata included: title, description, keywords, Open Graph + Twitter cards
(`docs/og-image.png`), JSON-LD (`WebApplication` + Census `Dataset`), SVG favicon,
`robots.txt`, and `sitemap.xml` (replace the placeholder domain on deploy).

## Tech

- Next.js 14 App Router + React 18 (`app/`, `components/`)
- d3 v7 (SVG map, zoom, scales) — imported from npm, bundled
- Tailwind configured (preflight off; the hand-rolled `app/globals.css` is the design system)
- Scripts: `scripts/clean-data.js` (CSV → JSON + mismatch report), `scripts/capture-assets.mjs`

## Data (`public/data/`)

| File | What |
|---|---|
| `india-states.geojson` | State boundaries (GADM vintage; J&K north restored from districts) |
| `india-districts.geojson` | 641 district shapes, converted from DataMeet `Districts/Census_2011` (CC BY 4.0), simplified |
| `states.json` | State populations, Census 2011 |
| `districts.json` | 640 districts × 118 Census columns, built by `scripts/clean-data.js` |
| `districts.csv` | Same data as CSV (fallback input for the script) |

Names are matched after lower-casing, `&` → `and`, punctuation stripping, plus an alias
table (`bangalore/bengaluru`, `orissa/odisha`, …). Unmatched districts show
“Data not available” and are logged to the console. Run `node scripts/clean-data.js`
to print the full GeoJSON ↔ CSV mismatch report.
