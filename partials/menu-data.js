// One source for the menu in both languages. Rendered to static HTML at build time (see render.js).
// Prices are in Toman. Caffeine values are typical approximations per serving, used for the energy meter.

export const categories = [
  { id: 'espresso', fa: 'بر پایهٔ اسپرسو', en: 'Espresso bar' },
  { id: 'brew', fa: 'دمی', en: 'Slow brew' },
  { id: 'cold', fa: 'سرد', en: 'Cold' },
  { id: 'tea', fa: 'چای و دمنوش', en: 'Tea & infusions' },
  { id: 'sweets', fa: 'شیرینی', en: 'Sweets' },
];

export const items = [
  // espresso
  { cat: 'espresso', sig: true, mg: 126, price: 115000,
    fa: ['اسپرسوی جان', 'ترکیبِ خانگیِ ما؛ شیرین و شکلاتی با کرمای غلیظ و پایانی بلند.'],
    en: ['Jaan espresso', 'Our house blend: sweet, chocolatey, with a thick crema and a long finish.'] },
  { cat: 'espresso', mg: 126, price: 105000,
    fa: ['ماکیاتو', 'اسپرسوی دوبل با کمی فومِ شیر.'],
    en: ['Macchiato', 'Double espresso marked with a little milk foam.'] },
  { cat: 'espresso', mg: 126, price: 115000,
    fa: ['کورتادو', 'اسپرسو و شیرِ گرم به یک اندازه.'],
    en: ['Cortado', 'Espresso and warm milk in equal measure.'] },
  { cat: 'espresso', mg: 126, price: 125000,
    fa: ['کاپوچینو', 'فومِ مخملی روی اسپرسوی دوبل.'],
    en: ['Cappuccino', 'Velvety foam over a double shot.'] },
  { cat: 'espresso', mg: 126, price: 130000,
    fa: ['لاته', 'نرم و ملایم؛ برای عصرهای طولانی.'],
    en: ['Latte', 'Soft and mellow, for long afternoons.'] },
  { cat: 'espresso', mg: 140, price: 145000,
    fa: ['موکا', 'اسپرسو، شکلاتِ تلخ و شیر.'],
    en: ['Mocha', 'Espresso, dark chocolate and milk.'] },

  // brew
  { cat: 'brew', sig: true, mg: 150, price: 145000,
    fa: ['وی‌شصت تک‌خاستگاه', 'دم‌آوریِ دستی، روشن و میوه‌ای. هر هفته یک دانهٔ تازه؛ از باریستا بپرس امروز چیست.'],
    en: ['Single-origin V60', 'Hand-poured, bright and fruity. A new bean every week; ask the barista what’s on today.'] },
  { cat: 'brew', mg: 120, price: 135000,
    fa: ['ایروپرس', 'بدنهٔ کامل و تمیز؛ چیزی میان اسپرسو و فیلتر.'],
    en: ['AeroPress', 'Full-bodied yet clean; somewhere between espresso and filter.'] },
  { cat: 'brew', mg: 150, price: 280000,
    fa: ['کمکسِ دونفره', 'یک پارچ برای گفت‌وگوهای طولانی.'],
    en: ['Chemex for two', 'A carafe for long conversations.'] },
  { cat: 'brew', mg: 65, price: 95000,
    fa: ['قهوهٔ ترک', 'در جذوه دم می‌شود، با قرابیه سرو می‌شود.'],
    en: ['Turkish coffee', 'Brewed in a cezve, served with a ghorabieh.'] },

  // cold
  { cat: 'cold', sig: true, mg: 126, price: 135000,
    fa: ['سردِ جان', 'اسپرسوی دوبل، شیر و شربتِ دارچین و نمک. خنک، شیرین و بیدارکننده.'],
    en: ['Cold Jaan', 'Double espresso, milk and a cinnamon–sea salt syrup. Cool, sweet, wide awake.'] },
  { cat: 'cold', mg: 200, price: 140000,
    fa: ['کلدبروی ۱۶ ساعته', 'آرام دم‌کشیده در آب سرد؛ کم‌اسید و پرکافئین.'],
    en: ['16-hour cold brew', 'Slowly steeped in cold water: low acidity, high caffeine.'] },
  { cat: 'cold', mg: 126, price: 130000,
    fa: ['اسپرسو تونیک', 'اسپرسو روی تونیک و پوستِ پرتقال.'],
    en: ['Espresso tonic', 'Espresso over tonic with orange peel.'] },
  { cat: 'cold', mg: 63, price: 120000,
    fa: ['آفوگاتو', 'بستنیِ وانیل زیرِ یک شاتِ داغ.'],
    en: ['Affogato', 'Vanilla ice cream under a hot shot.'] },

  // tea
  { cat: 'tea', mg: 47, price: 55000,
    fa: ['چای تبریزی', 'چای سیاهِ تازه‌دم با نبات؛ همان که از بازار می‌شناسیم.'],
    en: ['Tabriz black tea', 'Freshly brewed black tea with rock-candy nabat, the way the bazaar serves it.'] },
  { cat: 'tea', mg: 40, price: 110000,
    fa: ['ماسالا چای', 'چای و ادویهٔ گرم با شیر.'],
    en: ['Masala chai', 'Tea and warming spices with milk.'] },
  { cat: 'tea', mg: 0, price: 75000,
    fa: ['دمنوشِ گل‌گاوزبان', 'بدون کافئین؛ برای شب‌ها.'],
    en: ['Borage infusion', 'Caffeine-free, for the evening.'] },

  // sweets
  { cat: 'sweets', mg: 0, price: 70000,
    fa: ['قرابیهٔ تبریز', 'بیسکویتِ بادام و سفیده؛ هم‌نشینِ همیشگیِ قهوهٔ ترک.'],
    en: ['Tabriz ghorabieh', 'Almond and egg-white cookie, the classic partner to Turkish coffee.'] },
  { cat: 'sweets', mg: 0, price: 80000,
    fa: ['قطاب', 'خمیرِ ترد با مغزِ گردو و هل.'],
    en: ['Ghottab', 'Crisp pastry filled with walnut and cardamom.'] },
  { cat: 'sweets', mg: 5, price: 160000,
    fa: ['چیزکیکِ باسک', 'سوخته از بیرون، نرم از درون.'],
    en: ['Basque cheesecake', 'Burnt outside, soft within.'] },
];

/** Caffeine (mg) → 0..5 bars on the energy meter. */
export const level = (mg) => (mg <= 5 ? 0 : mg < 30 ? 1 : mg < 70 ? 2 : mg < 120 ? 3 : mg < 170 ? 4 : 5);
