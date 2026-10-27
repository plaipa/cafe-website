# STRATA

وب‌سایتِ دوزبانهٔ یک کافهٔ **مفهومی** در تبریز. ایدهٔ مرکزی: «هر فنجان چند لایه است.» صفحهٔ اول یک لاته را جلوی چشمِ بازدیدکننده لایه‌به‌لایه می‌سازد (لیوان، اسپرسو، کرما، شیر، فوم) و بعد آن را مثل یک نقشهٔ فنی از هم باز می‌کند. منو هم به همین زبان است: هر نوشیدنی برشی از همان لیوان.

A bilingual (Persian default, English) site for **STRATA**, a concept café in Tabriz, art-directed like a magazine. The idea in one line: *every cup is layered.* The home page builds a latte layer by layer in 3D, then pulls it apart into an exploded, annotated view. The menu speaks the same language: each drink is a cross-section of the house glass.

> The name, address, phone and opening hours are placeholders for a concept; see *Replace before launch*.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/ (relative paths, host anywhere)
npm run preview
```

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).

## Pages

| Persian (default) | English | 3D |
|---|---|---|
| `index.html` | `en/index.html` | scroll story: empty glass → espresso → crema → milk → foam → exploded anatomy, each chapter on its own backdrop colour |
| `menu.html` | `en/menu.html` | a glass that rebuilds itself as whichever drink is on screen; exploded view on demand |
| `about.html` | `en/about.html` | the manifesto, beside the exploded latte as "Fig. 1" |
| `contact.html` | `en/contact.html` | — (address, hours, drawn map, booking form) |

## Structure

- `partials/menu-data.js`: **one source** for the glass dimensions, the ingredients (with their colours) and every drink's layers in millilitres. The build draws the SVG cross-sections from it (`partials/render.js`) and the browser builds the 3D glass from the same numbers.
- `partials/strings.js`, `header.html`, `footer.html`, `head.html`, `loader.html`: shared markup and UI strings per language, filled by the small plugin in `vite.config.js`.
- `src/js/scene/`
  - `studio.js`: a seamless colour backdrop, soft key and rim light, a room environment for reflections, and shadows on the backdrop. There are no downloaded assets.
  - `glass.js`: the tumbler (real glass transmission), the coaster, and the stack of liquid layers that follow the inside of the glass. Covers latte art, crema and ice, plus the exploded view.
  - `story.js`: the scroll timeline (camera, pours, explosion, backdrop colours, the wordmark the glass refracts) and the inner-page vignettes.
- `src/js/loader.js`: the intro loader, a glass whose layers fill with real loading progress (once per session). `src/js/parallax.js`: scroll and pointer parallax.
- Fonts are self-hosted: **Estedad** (Persian), **Manrope** (Latin text) and **Instrument Serif** (display and wordmark).

## Language

Persian is the default. Every page has an always-visible **English** / **فارسی** switch in the header and footer. Visitors whose browser isn't Persian get a small English prompt; an explicit choice is remembered.

## Replace before launch

These are **placeholders**, not real data:

- The name **STRATA**, the "Issue 01" line and the wordmark, set in Instrument Serif. Replace it with a real logo when there is one (`partials/header.html`, `partials/footer.html`).
- Address (Abresan St., Tabriz), phone `041 3300 0000` and hours: in `partials/strings.js`, the home "visit" band and both `contact.html` pages. The map on the contact page is a drawing, not a real map.
- Drinks and their layer amounts: `partials/menu-data.js`. No prices are shown anywhere, by design.
- The booking form is **not connected to a backend**. It shows a summary and asks the guest to call (`src/js/contact.js`).
- The manifesto copy (`about.html`) is written for the concept.

## Dev aids

- `?p=0.84` on the home page pins the story at a given scroll progress (useful for screenshots).
- `?q=low` forces the light renderer (lower resolution, softer shadows, half-resolution glass), which phones and low-core machines get automatically.
