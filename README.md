# Code Concept

وب‌سایت چندصفحه‌ای و دوزبانهٔ کافه Code Concept در تبریز. نقطهٔ قوت سایت، سفرِ سه‌بعدیِ صفحهٔ اول دربارهٔ «قدرت قهوه در وجود انسان» است: یک صحنهٔ واقع‌گرایانه با دیوار بتنی، میز استیل و نور پنجره؛ دانه‌ها روی میز می‌ریزند، لیوانِ Code Concept پر می‌شود و مولکول کافئین از لیوان تا ذهنِ یک تندیس مرمری سفر می‌کند.

A minimal, bilingual (Persian default, English) multi-page site for Code Concept, a café in Tabriz, built around a scroll-driven 3D story about the power of coffee within a person. The palette follows the brand: monochrome graphite, concrete grey, steel and white.

## اجرا · Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/ (relative paths, host anywhere)
npm run preview
```

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). In the repository settings, **Pages → Source** must be set to **GitHub Actions**.

## صفحه‌ها · Pages

| فارسی (پیش‌فرض) | English | 3D |
|---|---|---|
| `index.html` | `en/index.html` | scroll story: beans fall → the cup → a tired marble bust → a caffeine molecule assembles → morning light |
| `menu.html` | `en/menu.html` | the café's cup, slowly circling |
| `science.html` | `en/science.html` | caffeine molecules over the cup; their number follows the interactive caffeine curve |
| `about.html` | `en/about.html` | the whole still life |
| `contact.html` | `en/contact.html` | — |

## ساختار · Structure

- `partials/header.html`, `footer.html`, `head.html`: shared markup; `{{key}}` strings come from `partials/strings.js` per language.
- `partials/menu-data.js`: the menu, in both languages, in one place. It is rendered to static HTML at build time by `partials/render.js` (`<!--@render menu-->`).
- `vite.config.js`: the small plugin that fills partials, marks the current nav link and links each page to its other-language twin.
- `src/js/scene/`: the Three.js scenes. `set.js` builds the physically lit room (plaster wall, brushed-steel table, a window light with leaf shadows, studio HDRI) with the clear cup, beans and marble bust; `scenes.js` drives the home story from scroll progress and the inner-page vignettes; `molecule.js` is an instanced ball-and-stick caffeine model. The set is mirrored for Persian so the subject always sits opposite the copy.
- `src/js/loader.js`: intro loader whose cup fills with real loading progress (once per session). `src/js/parallax.js`: scroll and pointer parallax (`data-parallax`, `data-depth`).
- Fonts are self-hosted: **Estedad** for Persian, **Manrope** for Latin (also the "code / concept" text wordmark), split by `unicode-range`.

## زبان · Language

- Persian is the default. Every page has an always-visible **English** / **فارسی** switch in the header (also on mobile, outside the menu) and in the footer.
- Visitors whose browser language isn't Persian get a small English prompt offering the English site. An explicit choice is remembered.

## پیش از انتشار جایگزین کنید · Replace before launch

These are **placeholders**, not real data:

- The header and footer use a **text wordmark** ("code / concept"); replace it with the official logo file when available (`partials/header.html`, `partials/footer.html`).
- Address (only "Valiasr St."), phone `041 3300 0000`, opening hours: in `partials/strings.js`, the home "visit" section and both `contact.html` pages.
- Menu items: `partials/menu-data.js` (no prices are shown anywhere).
- The reservation form is **not connected to a backend**. It shows a summary and asks the guest to call. Connect it to a form service or API in `src/js/contact.js`.
- About page copy (code / concept / community) is written from the café's name; replace it with the real story.

## Credits

CC0 assets from [Poly Haven](https://polyhaven.com): *Marble Bust 01* (model), *Grey Plaster* (textures), *Studio Small 09* (HDRI). Everything else (cup, label, beans, molecule) is generated in code.

Caffeine figures (≈30–60 min to peak, ≈5 h half-life, 400 mg/day FDA guidance for most healthy adults) are general public-health values; the chart is a simplified model and the page says so.

## Dev aids

- `?p=0.84` on the home page pins the story at a given scroll progress (useful for screenshots).
- `?q=low` forces the light renderer (lower resolution, simpler shadows and glass), which phones and low-core machines get automatically.
