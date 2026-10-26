// Build-time HTML generators for content shared by both languages.
import { categories, items, level } from './menu-data.js';

const nf = { fa: new Intl.NumberFormat('fa-IR'), en: new Intl.NumberFormat('en-US') };
const T = {
  fa: { toman: 'تومان', caffeine: 'کافئین', mg: 'میلی‌گرم', none: 'بدون کافئین', all: 'همه', sig: 'امضا' },
  en: { toman: 'Toman', caffeine: 'Caffeine', mg: 'mg', none: 'Caffeine-free', all: 'All', sig: 'Signature' },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function meter(lang, mg) {
  const t = T[lang];
  const lv = level(mg);
  const label = mg <= 5 ? t.none : `${t.caffeine} ≈ ${nf[lang].format(mg)} ${t.mg}`;
  return `<span class="meter-label"><span class="meter" data-level="${lv}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>${label}</span>`;
}

function price(lang, p) {
  return `<span class="price num">${nf[lang].format(p)} <small>${T[lang].toman}</small></span>`;
}

export function signatures(lang) {
  return items
    .filter((i) => i.sig)
    .map((item, n) => {
      const [name, desc] = item[lang];
      return `<article class="card" data-reveal style="--d:${n * 0.1}s">
  <span class="card__index num">${nf[lang].format(n + 1).padStart(2, nf[lang].format(0))}</span>
  <h3>${esc(name)}</h3>
  <p>${esc(desc)}</p>
  <div class="card__foot">${meter(lang, item.mg)}${price(lang, item.price)}</div>
</article>`;
    })
    .join('\n');
}

export function menuFilters(lang) {
  const t = T[lang];
  return [`<button class="chip" type="button" aria-pressed="true" data-filter="all">${t.all}</button>`]
    .concat(categories.map((c) => `<button class="chip" type="button" aria-pressed="false" data-filter="${c.id}">${c[lang]}</button>`))
    .join('');
}

export function menu(lang) {
  const t = T[lang];
  return categories
    .map((c) => {
      const rows = items
        .filter((i) => i.cat === c.id)
        .map((item) => {
          const [name, desc] = item[lang];
          return `<li class="menu-item" data-mg="${item.mg}">
  <div class="menu-item__head">
    <h3>${esc(name)}${item.sig ? ` <span class="badge">${t.sig}</span>` : ''}</h3>
    <span class="menu-item__dots" aria-hidden="true"></span>
    ${price(lang, item.price)}
  </div>
  <p>${esc(desc)}</p>
  ${meter(lang, item.mg)}
</li>`;
        })
        .join('\n');
      return `<section class="menu-group" data-cat="${c.id}" aria-labelledby="cat-${c.id}">
  <h2 class="menu-group__title" id="cat-${c.id}">${c[lang]}</h2>
  <ul class="menu-group__list">${rows}</ul>
</section>`;
    })
    .join('\n');
}
