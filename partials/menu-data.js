// One source for the menu in both languages, shared by the build (render.js → static HTML and
// SVG cross-sections) and the browser (the 3D glass rebuilds itself from the same layers).
// Each drink lists its layers from the bottom of the glass up, in millilitres. No prices on purpose.

/** The house glass, in metres: drawn in the menu's cross-sections and modelled in 3D (src/js/scene/glass.js). */
export const glass = {
  height: 0.118,
  base: 0.011, // thickness of the solid bottom
  wall: 0.0022,
  rBottom: 0.031,
  rTop: 0.0395,
  fillTop: 0.11, // the drink never comes higher than this
  ml: 240, // what fits between the base and fillTop
};

/** What a drink can be made of. `tone` is the colour used in the drawings and the 3D glass. */
export const kinds = {
  syrup: { tone: '#4a210f', fa: 'شیرهٔ خرما', en: 'Date syrup' },
  chocolate: { tone: '#4b2618', fa: 'شکلات', en: 'Chocolate' },
  espresso: { tone: '#2b160c', fa: 'اسپرسو', en: 'Espresso' },
  crema: { tone: '#b07a45', fa: 'کرما', en: 'Crema' },
  water: { tone: '#dfe3e1', fa: 'آب داغ', en: 'Hot water' },
  tonic: { tone: '#e4e9e4', fa: 'تونیک', en: 'Tonic' },
  ice: { tone: '#eef1ef', fa: 'یخ', en: 'Ice' },
  milk: { tone: '#f3ede3', fa: 'شیر', en: 'Milk' },
  saffron: { tone: '#efc56c', fa: 'شیرِ زعفرانی', en: 'Saffron milk' },
  matcha: { tone: '#8ea05c', fa: 'ماچا', en: 'Matcha' },
  tea: { tone: '#9a4a1d', fa: 'چای', en: 'Tea' },
  foam: { tone: '#fbf8f2', fa: 'فوم', en: 'Microfoam' },
};

export const categories = [
  { id: 'espresso', fa: 'بر پایهٔ اسپرسو', en: 'Espresso' },
  { id: 'cold', fa: 'سرد', en: 'Cold' },
  { id: 'strata', fa: 'امضای استراتا', en: 'STRATA signatures' },
  { id: 'tea', fa: 'چای', en: 'Tea' },
];

export const items = [
  {
    id: 'espresso',
    cat: 'espresso',
    layers: [['espresso', 32], ['crema', 6]],
    fa: ['اسپرسو', 'دوبل، ۱۸ گرم قهوه، ۲۸ ثانیه. پایهٔ همه‌چیز.'],
    en: ['Espresso', 'A double: 18 g of coffee, 28 seconds. The base of everything.'],
  },
  {
    id: 'macchiato',
    cat: 'espresso',
    layers: [['espresso', 32], ['crema', 5], ['foam', 16]],
    fa: ['ماکیاتو', 'اسپرسو با یک قاشق فوم؛ «لکه‌دار»، همان‌طور که اسمش می‌گوید.'],
    en: ['Macchiato', 'Espresso marked with a spoon of foam.'],
  },
  {
    id: 'cortado',
    cat: 'espresso',
    layers: [['espresso', 40], ['milk', 40], ['foam', 10]],
    fa: ['کورتادو', 'نصف اسپرسو، نصف شیر. کوتاه و متعادل.'],
    en: ['Cortado', 'Half espresso, half milk. Short and balanced.'],
  },
  {
    id: 'flatwhite',
    cat: 'espresso',
    layers: [['espresso', 45], ['milk', 105], ['foam', 10]],
    fa: ['فلت‌وایت', 'ریسترتوی دوبل و شیرِ مخملی با لایهٔ نازکی از فوم.'],
    en: ['Flat white', 'A double ristretto under velvety milk and a thin skin of foam.'],
  },
  {
    id: 'cappuccino',
    cat: 'espresso',
    layers: [['espresso', 36], ['milk', 70], ['foam', 60]],
    fa: ['کاپوچینو', 'سه سهمِ تقریباً برابر: اسپرسو، شیر، فوم.'],
    en: ['Cappuccino', 'Three nearly equal parts: espresso, milk, foam.'],
  },
  {
    id: 'latte',
    cat: 'espresso',
    layers: [['espresso', 36], ['milk', 150], ['foam', 20]],
    fa: ['لاته', 'شیرِ بیشتر، لایهٔ نرمِ فوم و یک قلبِ ساده روی آن.'],
    en: ['Latte', 'More milk, a soft layer of foam and a simple heart on top.'],
  },
  {
    id: 'mocha',
    cat: 'espresso',
    layers: [['chocolate', 30], ['espresso', 36], ['milk', 120], ['foam', 20]],
    fa: ['موکا', 'شکلاتِ تلخ در کف، اسپرسو و شیر روی آن.'],
    en: ['Mocha', 'Dark chocolate at the bottom, espresso and milk above.'],
  },
  {
    id: 'longblack',
    cat: 'espresso',
    layers: [['water', 120], ['espresso', 40], ['crema', 6]],
    fa: ['لانگ‌بلک', 'اسپرسو روی آبِ داغ ریخته می‌شود تا کرما دست‌نخورده بماند.'],
    en: ['Long black', 'Espresso poured over hot water so the crema stays whole.'],
  },
  {
    id: 'icedlatte',
    cat: 'cold',
    layers: [['ice', 60], ['milk', 110], ['espresso', 40]],
    fa: ['آیس‌لاته', 'شیرِ سرد و یخ، اسپرسو آخر از همه روی آن می‌نشیند.'],
    en: ['Iced latte', 'Cold milk over ice, espresso settles on top last.'],
  },
  {
    id: 'tonic',
    cat: 'cold',
    layers: [['ice', 50], ['tonic', 110], ['espresso', 40]],
    fa: ['اسپرسو تونیک', 'تونیکِ گازدار و یخ، با اسپرسویی که آرام روی آن شناور است.'],
    en: ['Espresso tonic', 'Sparkling tonic and ice, espresso floating gently on top.'],
  },
  {
    id: 'strata',
    cat: 'strata',
    sig: true,
    layers: [['syrup', 15], ['milk', 110], ['espresso', 40], ['foam', 20]],
    fa: ['استراتا شمارهٔ ۱', 'شیرهٔ خرما در کف، شیر، اسپرسو و فوم؛ چهار لایه که هم نمی‌زنی.'],
    en: ['STRATA No. 1', 'Date syrup at the bottom, then milk, espresso and foam: four layers you don’t stir.'],
  },
  {
    id: 'saffron',
    cat: 'strata',
    sig: true,
    layers: [['saffron', 70], ['espresso', 40], ['foam', 12]],
    fa: ['کورتادوی زعفرانی', 'شیرِ دم‌کرده با زعفران و اسپرسویی که روی آن می‌نشیند.'],
    en: ['Saffron cortado', 'Milk steeped with saffron, espresso resting on top.'],
  },
  {
    id: 'matcha',
    cat: 'tea',
    layers: [['milk', 120], ['matcha', 45], ['foam', 15]],
    fa: ['ماچا لاته', 'ماچای همزده روی شیرِ سرد یا داغ.'],
    en: ['Matcha latte', 'Whisked matcha over cold or steamed milk.'],
  },
  {
    id: 'tea',
    cat: 'tea',
    layers: [['tea', 170]],
    fa: ['چای تازه‌دم', 'چای سیاهِ ایرانی، هر بار تازه دم می‌شود.'],
    en: ['Fresh-brewed tea', 'Persian black tea, brewed fresh every time.'],
  },
];
