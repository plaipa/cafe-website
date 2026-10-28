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
  const parts = layers.map(([kind, ml], n) => {
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
        .map(([cx, cy], i) => `<rect style="--i:${n}" x="${f(cx)}" y="${f(H - cy - s)}" width="${s}" height="${s}" rx="3" fill="${tone}" stroke="#1d1611" stroke-opacity=".35" stroke-width=".6" transform="rotate(${(i * 23) % 40 - 18} ${f(cx + s / 2)} ${f(H - cy - s / 2)})"/>`)
        .join('');
    }
    return `<path style="--i:${n}" d="M${f(-inner(y0))} ${Y(y0)}H${f(inner(y0))}L${f(inner(y1))} ${Y(y1)}H${f(-inner(y1))}Z" fill="${tone}"/>`;
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

/** Menu page: the large drawing beside the list, starting on the latte. */
export function figure(lang, data) {
  const item = data.items.find((i) => i.id === 'latte');
  return crossSection(item.layers, data, { label: item[lang][0] });
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

/* ───────────── the anatomy: a technical drawing of the glass, exploded ─────────────
   Line art in the manner of a patent drawing. The page animates it with three CSS
   variables on the <svg>: --draw (lines trace in), --e (pieces lift apart), --labels. */

const ANATOMY = {
  fa: {
    foam: ['فومِ سرد', '۱۵ میلی‌لیتر · سبک‌ترین لایه'],
    milk: ['شیرِ سرد', '۱۲۰ میلی‌لیتر · ۴ درجه'],
    ice: ['یخ', 'سه قالب · سرعتِ ریختن را می‌شکند'],
    espresso: ['اسپرسو', '۳۶ گرم · ۲۸ ثانیه'],
    glass: ['لیوان', 'شیشه · ۲۴۰ میلی‌لیتر'],
    title: 'نقشهٔ انفجاریِ آیس‌لاتهٔ استراتا',
  },
  en: {
    foam: ['Cold foam', '15 ml · the lightest layer'],
    milk: ['Cold milk', '120 ml · 4°C'],
    ice: ['Ice', 'three cubes · they slow the pour'],
    espresso: ['Espresso', '36 g · 28 s'],
    glass: ['Glass', 'clear · 240 ml'],
    title: 'Exploded drawing of the STRATA iced latte',
  },
};

export function anatomy(lang) {
  const t = ANATOMY[lang];
  const rtl = lang === 'fa';
  const cx = rtl ? 280 : 160;
  const k = 0.24; // how flat the ellipses are: the drawing is seen from slightly above
  const f = (n) => n.toFixed(1);
  // the glass: rim y=250 (r 112), foot y=530 (r 94)
  const R = (y) => 112 + ((94 - 112) * (y - 250)) / 280;
  const ri = (y) => R(y) - 7;

  /** A section of a (tapered) cylinder: outline paths and a soft fill. */
  function cyl(y0, y1, r0, r1, tone, { back = false } = {}) {
    const top = `M${f(cx - r0)} ${f(y0)}A${f(r0)} ${f(r0 * k)} 0 1 0 ${f(cx + r0)} ${f(y0)}A${f(r0)} ${f(r0 * k)} 0 1 0 ${f(cx - r0)} ${f(y0)}`;
    const sides = `M${f(cx - r0)} ${f(y0)}L${f(cx - r1)} ${f(y1)}M${f(cx + r0)} ${f(y0)}L${f(cx + r1)} ${f(y1)}`;
    const front = `M${f(cx - r1)} ${f(y1)}A${f(r1)} ${f(r1 * k)} 0 0 0 ${f(cx + r1)} ${f(y1)}`;
    const hidden = `M${f(cx - r1)} ${f(y1)}A${f(r1)} ${f(r1 * k)} 0 0 1 ${f(cx + r1)} ${f(y1)}`;
    const body = `M${f(cx - r0)} ${f(y0)}L${f(cx - r1)} ${f(y1)}A${f(r1)} ${f(r1 * k)} 0 0 0 ${f(cx + r1)} ${f(y1)}L${f(cx + r0)} ${f(y0)}A${f(r0)} ${f(r0 * k)} 0 0 0 ${f(cx - r0)} ${f(y0)}Z`;
    return [
      tone ? `<path class="an__fill" d="${body}" fill="${tone}"/>` : '',
      tone ? `<path class="an__fill an__fill--top" d="${top}" fill="${tone}"/>` : '',
      back ? `<path class="an__ln an__ln--hidden" pathLength="1" d="${hidden}"/>` : '',
      `<path class="an__ln" pathLength="1" d="${top}"/>`,
      `<path class="an__ln" pathLength="1" d="${sides}"/>`,
      `<path class="an__ln" pathLength="1" d="${front}"/>`,
    ].join('');
  }

  /** An ice cube in isometric outline. */
  function cube(x, y, s, rot) {
    const h = s * 0.5;
    const pts = (arr) => arr.map(([a, b]) => `${f(a)} ${f(b)}`).join('L');
    const top = pts([[x, y - h], [x + s, y - h * 0.4 + rot], [x, y + h * 0.2 + rot * 0.5], [x - s, y - h * 0.4 - rot]]);
    const left = pts([[x - s, y - h * 0.4 - rot], [x - s, y + s * 0.8 - rot], [x, y + s * 1.4 + rot * 0.5], [x, y + h * 0.2 + rot * 0.5]]);
    const right = pts([[x, y + h * 0.2 + rot * 0.5], [x, y + s * 1.4 + rot * 0.5], [x + s, y + s * 0.8 + rot], [x + s, y - h * 0.4 + rot]]);
    return `<path class="an__fill" d="M${top}Z" fill="#eef4f4"/><path class="an__ln" pathLength="1" d="M${top}Z"/><path class="an__ln" pathLength="1" d="M${left}"/><path class="an__ln" pathLength="1" d="M${right}"/>`;
  }

  // facets on the lower band of the glass, like a Gibraltar tumbler
  const facets = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75]
    .map((u) => `M${f(cx + u * R(440))} ${f(440 + Math.sqrt(1 - u * u) * R(440) * k)}L${f(cx + u * R(530))} ${f(530 + Math.sqrt(1 - u * u) * R(530) * k)}`)
    .join('');
  const band = `M${f(cx - R(440))} 440A${f(R(440))} ${f(R(440) * k)} 0 0 0 ${f(cx + R(440))} 440`;
  const base = `M${f(cx - ri(506))} 506A${f(ri(506))} ${f(ri(506) * k)} 0 0 0 ${f(cx + ri(506))} 506`;

  /** A label: a leader from the piece's edge out to the name and its numbers. */
  function label([name, spec], y, edge) {
    const x0 = rtl ? cx - edge : cx + edge;
    const x1 = rtl ? 118 : 322;
    const tx = rtl ? 110 : 330;
    // Persian runs right-to-left; with direction=rtl, "start" is the right edge, next to the leader
    const attrs = `text-anchor="start"${rtl ? ' direction="rtl"' : ''}`;
    return `<g class="an__label"><circle cx="${f(x0)}" cy="${f(y)}" r="2.6"/><path d="M${f(x0)} ${f(y)}H${x1}"/><text x="${tx}" y="${f(y - 3)}" ${attrs} class="an__name">${esc(name)}</text><text x="${tx}" y="${f(y + 16)}" ${attrs} class="an__spec">${esc(spec)}</text></g>`;
  }

  // natural place of each piece in the glass, and how far it lifts in the exploded view
  const pieces = [
    { id: 'glass', lift: 0, svg: cyl(250, 530, R(250), R(530), null, { back: true }) + `<path class="an__ln" pathLength="1" d="${facets}"/><path class="an__ln" pathLength="1" d="${band}"/><path class="an__ln an__ln--hidden" pathLength="1" d="${base}"/>`, label: label(t.glass, 300, R(300)) },
    { id: 'espresso', lift: -290, svg: cyl(446, 506, ri(446), ri(506), '#2b160c'), label: label(t.espresso, 476, ri(476)) },
    { id: 'ice', lift: -368, svg: cube(cx - 42, 452, 30, 4) + cube(cx + 34, 436, 28, -5) + cube(cx - 4, 396, 26, 3), label: label(t.ice, 430, 70) },
    { id: 'milk', lift: -463, svg: cyl(336, 446, ri(336), ri(446), '#f3ede3'), label: label(t.milk, 391, ri(391)) },
    { id: 'foam', lift: -497, svg: cyl(314, 336, ri(314), ri(336), '#fbf8f2'), label: label(t.foam, 325, ri(325)) },
  ];
  const groups = pieces
    .map((p, i) => `<g class="an__piece" style="--lift:${p.lift}px;--i:${i}">${p.svg}${p.label}</g>`)
    .join('');
  return `<svg class="anatomy" viewBox="0 -210 440 770" role="img" aria-label="${esc(t.title)}">${groups}</svg>`;
}
