import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = import.meta.dirname;
const pages = ['index', 'menu', 'about', 'contact'];
const langs = { fa: '', en: 'en/' }; // Persian is the default and lives at the root

const read = (name) => readFileSync(resolve(root, 'partials', `${name}.html`), 'utf8');
// fresh import on every request so editing strings/data shows up without restarting the dev server
const load = (file) => import(`${pathToFileURL(resolve(root, 'partials', file)).href}?t=${Date.now()}`);

/**
 * Both languages share one header, footer and data set. Each page is authored
 * as static HTML per language; at build (and dev) time this plugin fills in:
 *   <!--@include header-->   shared partials, with {{key}} strings for the page's language
 *   <!--@render menu-->      HTML generated from shared data (see partials/render.js)
 *   {{alt}} / {{altLang}}    the same page in the other language
 */
function bilingual() {
  return {
    name: 'bilingual-pages',
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        const file = ctx.filename || ctx.path || 'index.html';
        const page = basename(file, '.html') || 'index';
        const lang = /[\\/]en[\\/]/.test(file) ? 'en' : 'fa';
        const { strings } = await load('strings.js');
        const renderers = await load('render.js');
        const data = await load('menu-data.js');
        const t = { ...strings[lang] };
        t.alt = lang === 'fa' ? `./en/${page}.html` : `../${page}.html`;
        t.altLang = lang === 'fa' ? 'en' : 'fa';

        const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in t ? t[k] : m));
        return fill(
          html
            .replace(/<!--@include (\w+)-->/g, (_, name) => read(name))
            .replace(/<!--@render (\w+)-->/g, (_, name) => renderers[name](lang, data))
        )
          .replace(`data-nav="${page}"`, 'aria-current="page"')
          .replace(/\sdata-nav="\w+"/g, '');
      },
    },
    handleHotUpdate({ file, server }) {
      if (file.includes('/partials/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [bilingual()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(langs).flatMap(([lang, dir]) =>
          pages.map((p) => [`${lang}-${p}`, resolve(root, `${dir}${p}.html`)])
        )
      ),
    },
  },
});
