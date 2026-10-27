// Build-time HTML generators for content shared by both languages.
// `data` is partials/menu-data.js, passed in fresh by the Vite plugin on every render.

const nf = { fa: new Intl.NumberFormat('fa-IR'), en: new Intl.NumberFormat('en-US') };
const T = {
  fa: { ml: 'میلی‌لیتر', layers: 'لایه‌ها', sig: 'امضا', show: 'ساختن در لیوان', all: 'همه' },
  en: { ml: 'ml', layers: 'Layers', sig: 'Signature', show: 'Build it in the glass', all: 'All' },
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const two = (lang, n) => nf[lang].format(n).padStart(2, nf[lang].format(0));

/**
 * A drink drawn as a cross-section of the house glass, in millimetres:
 * the same proportions and layer heights as the 3D glass.
 */
export function crossSection(layers, { glass, kinds }, { label = '' } = {}) {
  const mm = (m) => m * 1000;
  const H = mm(glass.height);
  const outer = (y) => mm(glass.rBottom) + ((mm(glass.rTop) - mm(glass.rBottom)) * y) / H;
  const inner = (y) => outer(y) - mm(glass.wall);
  const perMl = (mm(glass.fillTop) - mm(glass.base)) / glass.ml;
  const Y = (y) => (H - y).toFixed(2); // svg y grows downwards
  const f = (n) => n.toFixed(2);

  let y = mm(glass.base);
  const parts = layers.map(([kind, ml]) => {
    const y0 = y;
    const y1 = y + ml * perMl;
    y = y1;
    const tone = kinds[kind].tone;
    if (kind === 'ice') {
      // a few cubes instead of a solid band
      const s = 15;
      const cubes = [
        [-17, y0 + 2],
        [1, y0 + 1],
        [-8, y0 + 15],
        [10, y0 + 16],
      ].filter(([, cy]) => cy + s <= y1 + 4);
      return cubes
        .map(([cx, cy], i) => `<rect x="${f(cx)}" y="${f(H - cy - s)}" width="${s}" height="${s}" rx="3" fill="${tone}" stroke="#1d1611" stroke-opacity=".35" stroke-width=".6" transform="rotate(${(i * 23) % 40 - 18} ${f(cx + s / 2)} ${f(H - cy - s / 2)})"/>`)
        .join('');
    }
    return `<path d="M${f(-inner(y0))} ${Y(y0)}H${f(inner(y0))}L${f(inner(y1))} ${Y(y1)}H${f(-inner(y1))}Z" fill="${tone}"/>`;
  });
  // hairlines where one layer meets the next
  let yy = mm(glass.base);
  const seams = layers
    .slice(0, -1)
    .map(([, ml]) => {
      yy += ml * perMl;
      return `<line class="xsec__lead" x1="${f(-inner(yy))}" x2="${f(inner(yy))}" y1="${Y(yy)}" y2="${Y(yy)}"/>`;
    })
    .join('');
  const g = `M${f(-outer(H))} 0L${f(-outer(0))} ${f(H)}H${f(outer(0))}L${f(outer(H))} 0`;
  const base = `M${f(-inner(mm(glass.base)))} ${Y(mm(glass.base))}H${f(inner(mm(glass.base)))}`;
  return `<svg class="xsec" viewBox="-44 -4 88 ${f(H + 8)}" role="img" aria-label="${esc(label)}">${parts.join('')}${seams}<path class="xsec__glass" d="${g}"/><path class="xsec__lead" d="${base}"/></svg>`;
}

const total = (layers) => layers.reduce((s, [, ml]) => s + ml, 0);

/** The legend under a drawing: each layer with its share, top first (as you'd read it in the glass). */
function legend(lang, layers, kinds) {
  return [...layers]
    .reverse()
    .map(([kind, ml]) => `<li><i style="background:${kinds[kind].tone}"></i>${kinds[kind][lang]}<span class="num">${nf[lang].format(ml)}</span></li>`)
    .join('');
}

/** Home page: a row of cross-sections, one per drink, linking to the menu. */
export function strip(lang, data) {
  const pick = ['espresso', 'macchiato', 'cortado', 'flatwhite', 'cappuccino', 'latte', 'icedlatte', 'strata'];
  return pick
    .map((id, n) => {
      const item = data.items.find((i) => i.id === id);
      const [name] = item[lang];
      return `<li data-reveal style="--d:${(n * 0.06).toFixed(2)}s">
  <a href="./menu.html#${id}">
    ${crossSection(item.layers, data, { label: name })}
    <span class="strip__name">${esc(name)}</span>
    <span class="strip__ml num">${nf[lang].format(total(item.layers))} ${T[lang].ml}</span>
  </a>
</li>`;
    })
    .join('\n');
}

export function menuFilters(lang, { categories }) {
  return [`<button class="chip" type="button" aria-pressed="true" data-filter="all">${T[lang].all}</button>`]
    .concat(categories.map((c) => `<button class="chip" type="button" aria-pressed="false" data-filter="${c.id}">${c[lang]}</button>`))
    .join('');
}

/** Menu page: every drink as an entry, with its drawing, its layers and a button that builds it in 3D. */
export function menu(lang, data) {
  const t = T[lang];
  let n = 0;
  return data.categories
    .map((c) => {
      const rows = data.items
        .filter((i) => i.cat === c.id)
        .map((item) => {
          const [name, desc] = item[lang];
          n++;
          return `<li class="drink" id="${item.id}" data-drink="${item.id}" data-layers='${JSON.stringify(item.layers)}'>
  <div class="drink__fig">${crossSection(item.layers, data, { label: name })}</div>
  <div class="drink__body">
    <p class="drink__no num">${two(lang, n)}</p>
    <h3 class="drink__name">${esc(name)}${item.sig ? ` <span class="badge">${t.sig}</span>` : ''}</h3>
    <p class="drink__desc">${esc(desc)}</p>
    <ul class="drink__layers" aria-label="${t.layers}">${legend(lang, item.layers, data.kinds)}</ul>
    <p class="drink__foot"><span class="num">${nf[lang].format(total(item.layers))} ${t.ml}</span><button class="link drink__build" type="button">${t.show}</button></p>
  </div>
</li>`;
        })
        .join('\n');
      return `<section class="menu-group" data-cat="${c.id}" aria-labelledby="cat-${c.id}">
  <h2 class="menu-group__title kicker" id="cat-${c.id}">${c[lang]}</h2>
  <ul class="menu-group__list">${rows}</ul>
</section>`;
    })
    .join('\n');
}
