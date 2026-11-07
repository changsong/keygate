import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL, SITE_VERSION } from './src/config.mjs';
import { url } from './src/lib/layout.mjs';
import { renderLayout } from './src/lib/layout.mjs';
import {
  renderHome,
  renderFeatures,
  renderHowItWorks,
  renderPricing,
  renderCompare,
  renderFaq,
  renderContact,
  renderChangelog,
  renderLegal,
  render404,
} from './src/lib/pages.mjs';
import { DOCS_RENDERERS } from './src/lib/docs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const siteDir = path.join(__dirname, 'site');
const assetsSrc = path.join(__dirname, 'src', 'assets');
const assetsOut = path.join(siteDir, 'assets');

const MARKETING_ROUTES = {
  '/': renderHome,
  '/features/': renderFeatures,
  '/how-it-works/': renderHowItWorks,
  '/pricing/': renderPricing,
  '/compare/': renderCompare,
  '/faq/': renderFaq,
  '/contact/': renderContact,
  '/changelog/': renderChangelog,
  '/privacy/': (lang) => renderLegal(lang, 'privacy'),
  '/terms/': (lang) => renderLegal(lang, 'terms'),
};

const PRIORITY = {
  '/': 1.0,
  '/pricing/': 0.9,
  '/features/': 0.9,
  '/how-it-works/': 0.8,
  '/docs/': 0.8,
  '/docs/quickstart/': 0.8,
};

function writePage(route, html, lang) {
  const clean = route.replace(/^\/|\/$/g, '');
  const prefix = lang === 'en' ? 'en/' : '';
  const rel = clean ? `${prefix}${clean}/index.html` : `${prefix}index.html`;
  const file = path.join(siteDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf8');
}

function copyAssets() {
  fs.mkdirSync(assetsOut, { recursive: true });
  const files = ['logo.svg', 'favicon.svg', 'og.png', 'dashboard.png'];
  for (const name of files) {
    const src = path.join(assetsSrc, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(assetsOut, name));
  }
  fs.copyFileSync(path.join(__dirname, 'src', 'site.css'), path.join(assetsOut, 'site.css'));
  fs.copyFileSync(path.join(__dirname, 'src', 'site.js'), path.join(assetsOut, 'site.js'));
  fs.copyFileSync(path.join(repoRoot, 'docs', 'openapi.yaml'), path.join(siteDir, 'openapi.yaml'));
}

function copyPrototype() {
  const src = path.join(__dirname, 'src', 'prototype', 'console-licenses.html');
  if (!fs.existsSync(src)) return;
  const out = path.join(siteDir, 'console', 'licenses');
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(src, path.join(out, 'index.html'));
}

function renderRoute(route, lang) {
  const render = MARKETING_ROUTES[route];
  const page = render(lang);
  return renderLayout({
    lang,
    path: route,
    title: page.title,
    description: page.description,
    body: page.body,
    jsonLd: page.jsonLd || null,
    noindex: page.noindex || false,
  });
}

function renderDocsRoute(route, lang) {
  const page = DOCS_RENDERERS[route](lang);
  return renderLayout({
    lang,
    path: route,
    title: page.title,
    description: page.description,
    body: page.body,
  });
}

function sitemap(routes) {
  const items = routes
    .map(({ route, priority = 0.6 }) => {
      const zh = `${SITE_URL}${url('zh', route)}`;
      const en = `${SITE_URL}${url('en', route)}`;
      return `  <url>
    <loc>${zh}</loc>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${zh}" />
    <xhtml:link rel="alternate" hreflang="en" href="${en}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${zh}" />
    <priority>${priority.toFixed(1)}</priority>
  </url>
  <url>
    <loc>${en}</loc>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${zh}" />
    <xhtml:link rel="alternate" hreflang="en" href="${en}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${zh}" />
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${items}
</urlset>
`;
}

function main() {
  const started = Date.now();
  fs.rmSync(siteDir, { recursive: true, force: true });
  fs.mkdirSync(siteDir, { recursive: true });
  copyAssets();
  copyPrototype();

  const routes = [...Object.keys(MARKETING_ROUTES), ...Object.keys(DOCS_RENDERERS)];

  for (const lang of ['zh', 'en']) {
    for (const route of Object.keys(MARKETING_ROUTES)) {
      writePage(route, renderRoute(route, lang), lang);
    }
    for (const route of Object.keys(DOCS_RENDERERS)) {
      writePage(route, renderDocsRoute(route, lang), lang);
    }

    const notFound = render404(lang);
    const html404 = renderLayout({
      lang,
      path: '/404/',
      title: notFound.title,
      description: notFound.description,
      body: notFound.body,
      noindex: true,
    });
    const prefix = lang === 'en' ? 'en/' : '';
    fs.writeFileSync(path.join(siteDir, `${prefix}404.html`), html404, 'utf8');
    writePage('/404/', html404, lang);
  }

  fs.writeFileSync(path.join(siteDir, 'sitemap.xml'), sitemap(routes), 'utf8');
  fs.writeFileSync(
    path.join(siteDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(siteDir, 'llms.txt'),
    `# UnionUser\n\n> Licensing infrastructure for desktop software. Built on the Keygate engine.\n\n`
      + `- Website: ${SITE_URL}\n- Docs: ${SITE_URL}/docs/\n- API reference: ${SITE_URL}/docs/api/\n- OpenAPI: ${SITE_URL}/openapi.yaml\n- Pricing: ${SITE_URL}/pricing/\n- Contact: ${SITE_URL}/contact/\n`,
    'utf8',
  );

  // fallback 404 for hosts that only serve /404.html
  const zh404 = path.join(siteDir, '404.html');
  if (!fs.existsSync(zh404)) {
    fs.copyFileSync(path.join(siteDir, '404/index.html'), zh404);
  }

  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(path.relative(siteDir, full));
    }
  };
  walk(siteDir);

  console.log(
    `UnionUser site built: ${files.length} files, ${routes.length * 2} HTML pages, v${SITE_VERSION}, ${Date.now() - started}ms`,
  );
  console.log(`Output: ${siteDir}`);
}

main();
