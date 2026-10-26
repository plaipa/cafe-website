import { lang } from './main.js';
import '../css/pages.css';

const L = {
  fa: {
    title: 'درخواستت آماده است',
    body: 'این فرم هنوز به سامانهٔ رزرو وصل نیست. برای قطعی شدن، لطفاً تماس بگیر یا این خلاصه را برایمان بفرست:',
    labels: { name: 'نام', phone: 'تلفن', guests: 'نفرات', date: 'تاریخ', time: 'ساعت', note: 'توضیحات' },
    call: 'تماس با کافه',
    copy: 'کپی خلاصه',
    copied: 'کپی شد',
    edit: 'ویرایش',
  },
  en: {
    title: 'Your request is ready',
    body: 'This form isn’t connected to a booking system yet. To confirm, please call us or send us this summary:',
    labels: { name: 'Name', phone: 'Phone', guests: 'Guests', date: 'Date', time: 'Time', note: 'Notes' },
    call: 'Call the café',
    copy: 'Copy summary',
    copied: 'Copied',
    edit: 'Edit',
  },
}[lang];

const form = document.getElementById('reserve-form');
const done = document.getElementById('reserve-done');
const timeSelect = document.getElementById('time-select');
const pad = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', { minimumIntegerDigits: 2, useGrouping: false });

// opening hours: 8:00 to 23:00, every half hour
for (let h = 8; h <= 23; h += 0.5) {
  const label = `${pad.format(Math.floor(h))}:${pad.format(h % 1 ? 30 : 0)}`;
  timeSelect.add(new Option(label, label, h === 18, h === 18));
}
const dateInput = form.elements.date;
const today = new Date();
dateInput.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  if (data.date) {
    data.date = new Date(`${data.date}T12:00`).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'long' });
  }
  const rows = Object.entries(L.labels)
    .filter(([k]) => data[k])
    .map(([k, label]) => [label, String(data[k])]);
  const summary = rows.map(([k, v]) => `${k}: ${v}`).join('\n');

  done.innerHTML = `
    <h3 class="h3">${L.title}</h3>
    <p class="muted">${L.body}</p>
    <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="form__actions">
      <a class="btn btn--solid" href="tel:+984133000000">${L.call}</a>
      <button class="btn" type="button" data-copy>${L.copy}</button>
      <button class="link" type="button" data-edit style="border:0;background-color:transparent">${L.edit}</button>
    </div>`;
  form.hidden = true;
  done.hidden = false;
  done.focus();

  done.querySelector('[data-copy]').addEventListener('click', async (ev) => {
    try {
      await navigator.clipboard.writeText(summary);
      ev.currentTarget.textContent = L.copied;
    } catch {
      /* clipboard blocked: the summary is still on screen */
    }
  });
  done.querySelector('[data-edit]').addEventListener('click', () => {
    done.hidden = true;
    form.hidden = false;
  });
});
