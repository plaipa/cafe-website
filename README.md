# STRATA

وب‌سایتِ دوزبانهٔ یک کافهٔ **مفهومی** در تبریز. ایدهٔ مرکزی: «هر فنجان چند لایه است.» صفحهٔ اول ویدیوی واقعیِ ریختنِ یک آیس‌لاته را با اسکرول جلو و عقب می‌برد و بعد آن را به یک نقشهٔ فنیِ خطی تبدیل می‌کند که لایه‌هایش (لیوان، اسپرسو، یخ، شیر، فوم) از هم جدا می‌شوند. منو هم به همین زبان است: هر نوشیدنی برشی از همان لیوان.

A bilingual (Persian default, English) site for **STRATA**, a concept café in Tabriz, art-directed like a magazine. The idea in one line: *every cup is layered.* The home page scrubs a real video of an iced latte being poured as you scroll, then dissolves it into a technical line drawing of the same glass that comes apart into its layers, annotated. The menu speaks the same language: each drink is a cross-section of the house glass.

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

| Persian (default) | English | Visual |
|---|---|---|
| `index.html` | `en/index.html` | a magazine spread: the pour (video frames scrubbed by scroll) beside the chapter copy; then the exploded line drawing |
| `menu.html` | `en/menu.html` | a large cross-section that redraws itself as whichever drink is on screen; exploded view on demand |
| `about.html` | `en/about.html` | the manifesto, beside a photograph of the finished drink as "Fig. 1" |
| `contact.html` | `en/contact.html` | — (address, hours, drawn map, booking form) |

## Structure

- `partials/menu-data.js`: **one source** for the glass dimensions, the ingredients (with their colours) and every drink's layers in millilitres. `partials/render.js` draws the cross-sections from it (at build time, and again in the browser when the menu figure changes drink) and the exploded drawing on the home page.
- `partials/strings.js`, `header.html`, `footer.html`, `head.html`, `loader.html`: shared markup and UI strings per language, filled by the small plugin in `vite.config.js`.
- `public/pour/`: the pour as WebP frames (`d/` 768×864 for desktop, `m/` 480×540 for phones; 136 frames at 8 fps) and a still. `src/js/home.js` draws the frame for the current scroll position onto a canvas, with a slow push-in per chapter; frames stream in coarse to fine so scrubbing works before all have arrived.
- `src/js/loader.js`: the intro loader, a glass whose layers fill with real loading progress (once per session). `src/js/parallax.js`: scroll and pointer parallax.
- Fonts are self-hosted: **Estedad** (Persian), **Manrope** (Latin text) and **Instrument Serif** (display and wordmark).

## Language

Persian is the default. Every page has an always-visible **English** / **فارسی** switch in the header and footer. Visitors whose browser isn't Persian get a small English prompt; an explicit choice is remembered.

## Credits

The pour video is *A barista preparing coffee with milk and ice* from [Mixkit](https://mixkit.co/free-stock-video/a-barista-preparing-coffee-with-milk-and-ice-796/), free under the Mixkit Stock Video Free License. It is cropped and cut into frames here. For the real café, replace it with your own footage: a static camera, a glass against a plain background, and around 15 seconds of pouring is enough. Regenerate the frames with:

```bash
ffmpeg -i pour.mp4 -vf "fps=8,crop=960:1080:480:0,scale=768:864" -c:v libwebp -quality 68 public/pour/d/%03d.webp
ffmpeg -i pour.mp4 -vf "fps=8,crop=960:1080:480:0,scale=480:540" -c:v libwebp -quality 64 public/pour/m/%03d.webp
```

and set `data-count` on the home page's canvas to the number of frames.

## Replace before launch

These are **placeholders**, not real data:

- The name **STRATA**, the "Issue 01" line and the wordmark, set in Instrument Serif. Replace it with a real logo when there is one (`partials/header.html`, `partials/footer.html`).
- Address (Abresan St., Tabriz), phone `041 3300 0000` and hours: in `partials/strings.js`, the home "visit" band and both `contact.html` pages. The map on the contact page is a drawing, not a real map.
- Drinks and their layer amounts: `partials/menu-data.js`. No prices are shown anywhere, by design.
- The booking form is **not connected to a backend**. It shows a summary and asks the guest to call (`src/js/contact.js`).
- The manifesto copy (`about.html`) is written for the concept.

## Dev aids

- `?p=0.84` on the home page pins the story at a given scroll progress (useful for screenshots).
