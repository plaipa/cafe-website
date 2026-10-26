# Code Concept

وب‌سایت دوزبانهٔ کافه Code Concept در تبریز (فارسی پیش‌فرض، انگلیسی در `/en/`). صفحهٔ اول سفری سه‌پرده‌ای و سه‌بعدی دربارهٔ «قدرت قهوه» است: **قطره**، **عصاره**، **پاداش**.

A bilingual website for Code Concept, a café in Tabriz (Persian by default, English under `/en/`). The home page is a scroll-driven, three-act 3D story about the power of coffee: the drop, the extraction, the reward.

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
| `index.html` | `en/index.html` | three acts: a glass drop of espresso beside flowing caramel → a chrome portafilter in a burst of beans → espresso pouring into a black cup |
| `menu.html` | `en/menu.html` | a cup with latte art, slowly turning |
| `science.html` | `en/science.html` | caffeine molecules over a cup; their number follows the interactive caffeine curve (≈ 1 molecule per 10 mg) |
| `about.html` | `en/about.html` | espresso pouring from the portafilter |
| `contact.html` | `en/contact.html` | — |

## ساختار · Structure

- `partials/`: shared header, footer, loader and `<head>`; `strings.js` holds UI text per language; `menu-data.js` is the menu in both languages, rendered to static HTML at build time by `render.js`.
- `vite.config.js`: the small plugin that fills partials and links each page to its other-language twin.
- `src/js/scene/`: the Three.js scenes. `props.js` models every object procedurally (cup, glass drop, caramel ribbons, portafilter, beans, espresso streams, steam), `molecule.js` builds caffeine (C₈H₁₀N₄O₂) as instanced ball-and-stick, `world.js` sets up renderer, studio lighting and camera, `scenes.js` choreographs the home acts and the inner-page vignettes.
- `src/js/loader.js`: intro loader whose cup fills with real loading progress (shown once per session). `src/js/parallax.js`: scroll and pointer parallax.
- Type: **Amiri** + **Instrument Serif** for display, **Estedad** + **Manrope** for text; all self-hosted.

## زبان · Language

- Persian is the default. Every page has an always-visible **English / فارسی** switch in the header (also on mobile) and in the footer.
- Visitors whose browser language isn't Persian get a small English prompt; an explicit choice is remembered.

## پیش از انتشار · Before launch

These are **placeholders**:

- Brand colours: taken from the design reference (espresso and caramel). Swap the tokens in `src/css/base.css` (`:root` and `.theme-dark`) for the café's own palette.
- Address (only "Valiasr St."), phone `041 3300 0000` and opening hours: in `partials/strings.js`, the home "visit" section and both contact pages.
- Menu items: `partials/menu-data.js` (no prices are shown anywhere).
- About page copy (code / concept / community) is written from the café's name; replace it with the real story.
- The reservation form is **not connected to a backend**; it shows a summary and asks the guest to call. Connect it in `src/js/contact.js`.

Caffeine and espresso figures (≈30–60 min to peak, ≈5 h half-life, 400 mg/day FDA guidance; 9 bar, 90–96 °C, 25–30 s) are general reference values; the science chart is a simplified model and says so.

## Credits

- Studio HDRI `studio_small_09` from [Poly Haven](https://polyhaven.com/a/studio_small_09), CC0.
- Fonts under the SIL Open Font License: Amiri, Instrument Serif, Estedad, Manrope.

## Dev aids

- `?p=0.5` on the home page pins the story at a given scroll progress (useful for screenshots).
- `?q=low` forces the light renderer, which phones and low-core machines get automatically.
