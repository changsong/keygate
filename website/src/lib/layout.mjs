import {
  SITE_URL,
  SITE_VERSION,
  LOGIN_URL,
  PORTAL_URL,
  SALES_EMAIL,
} from '../config.mjs';

export const t = (lang, zh, en) => (lang === 'en' ? en : zh);

export const url = (lang, path = '/') => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return lang === 'en' ? `/en${normalized === '/' ? '/' : normalized}` : normalized;
};

export const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const NAV = [
  { path: '/features/', zh: '功能', en: 'Features' },
  { path: '/how-it-works/', zh: '使用指南', en: 'How it works' },
  { path: '/docs/', zh: '文档', en: 'Docs' },
  { path: '/pricing/', zh: '定价', en: 'Pricing' },
  { path: '/compare/', zh: '对比', en: 'Compare' },
  { path: '/faq/', zh: '常见问题', en: 'FAQ' },
];

const isActive = (current, target) =>
  target === '/' ? current === '/' : current.startsWith(target);

function renderNav(lang, path) {
  return NAV.map((item) => {
    const current = isActive(path, item.path);
    return `<a class="nav-link" href="${url(lang, item.path)}"${
      current ? ' aria-current="page"' : ''
    }>${t(lang, item.zh, item.en)}</a>`;
  }).join('');
}

function renderMobileNav(lang, path) {
  const items = NAV.map((item) => {
    const current = isActive(path, item.path);
    return `<a href="${url(lang, item.path)}"${current ? ' aria-current="page"' : ''}>${t(
      lang,
      item.zh,
      item.en,
    )}</a>`;
  }).join('');
  return `${items}
    <a href="${LOGIN_URL}">${t(lang, '登录 / 控制台', 'Sign in / Console')}</a>
    <a class="btn btn-primary" href="${url(lang, '/contact/?plan=trial')}">${t(
      lang,
      '免费试用 31 天',
      'Start 31-day trial',
    )}</a>`;
}

function renderHeader(lang, path) {
  const otherLang = lang === 'en' ? 'zh' : 'en';
  return `<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${url(lang, '/')}">
      <img src="/assets/logo.svg" alt="" width="28" height="28" />
      <span>UnionUser</span>
    </a>
    <nav class="nav" aria-label="${t(lang, '主导航', 'Main navigation')}">
      ${renderNav(lang, path)}
    </nav>
    <div class="header-actions">
      <div class="lang-switch" role="group" aria-label="${t(lang, '语言', 'Language')}">
        <a href="${url('zh', path)}"${lang === 'zh' ? ' aria-current="true"' : ''}>中文</a>
        <a href="${url('en', path)}"${lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
      </div>
      <a class="nav-link login-link" href="${LOGIN_URL}">${t(lang, '登录', 'Sign in')}</a>
      <a class="btn btn-primary btn-sm" href="${url(lang, '/contact/?plan=trial')}">${t(
        lang,
        '免费试用',
        'Start free',
      )}</a>
      <button class="mobile-toggle" type="button" aria-label="${t(
        lang,
        '打开菜单',
        'Open menu',
      )}" aria-expanded="false" data-mobile-toggle>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
  </div>
  <div class="mobile-menu" data-mobile-menu>
    <div class="container">${renderMobileNav(lang, path)}</div>
  </div>
</header>`;
}

function renderFooter(lang) {
  const year = new Date().getFullYear();
  const link = (href, label) => `<a href="${href}">${label}</a>`;
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="${url(lang, '/')}">
          <img src="/assets/logo.svg" alt="" width="28" height="28" />
          <span>UnionUser</span>
        </a>
        <p>${t(
          lang,
          '为桌面软件而生的授权管理平台。激活、试用、订阅、买断、支付、自动更新与客户门户，一套接完。',
          'Licensing infrastructure for desktop software. Activation, trials, subscriptions, payments, updates, and a customer portal in one platform.',
        )}</p>
      </div>
      <div class="footer-col">
        <h4>${t(lang, '产品', 'Product')}</h4>
        ${link(url(lang, '/features/'), t(lang, '功能总览', 'Features'))}
        ${link(url(lang, '/how-it-works/'), t(lang, '使用指南', 'How it works'))}
        ${link(url(lang, '/pricing/'), t(lang, '定价', 'Pricing'))}
        ${link(url(lang, '/compare/'), t(lang, '方案对比', 'Compare'))}
      </div>
      <div class="footer-col">
        <h4>${t(lang, '开发者', 'Developers')}</h4>
        ${link(url(lang, '/docs/quickstart/'), t(lang, '快速开始', 'Quickstart'))}
        ${link(url(lang, '/docs/api/'), t(lang, 'API 参考', 'API reference'))}
        ${link(url(lang, '/docs/guides/javascript/'), t(lang, '接入示例', 'Integration guides'))}
        ${link(url(lang, '/docs/self-hosted/'), t(lang, '自托管', 'Self-hosted'))}
      </div>
      <div class="footer-col">
        <h4>${t(lang, '资源', 'Resources')}</h4>
        ${link(url(lang, '/faq/'), t(lang, '常见问题', 'FAQ'))}
        ${link(url(lang, '/changelog/'), t(lang, '更新日志', 'Changelog'))}
        ${link(url(lang, '/contact/'), t(lang, '预约演示', 'Book a demo'))}
        ${link(`mailto:${SALES_EMAIL}`, SALES_EMAIL)}
      </div>
      <div class="footer-col">
        <h4>${t(lang, '账户与法律', 'Account & legal')}</h4>
        ${link(LOGIN_URL, t(lang, '登录', 'Sign in'))}
        ${link(PORTAL_URL, t(lang, '客户门户', 'Customer portal'))}
        ${link(url(lang, '/privacy/'), t(lang, '隐私政策', 'Privacy'))}
        ${link(url(lang, '/terms/'), t(lang, '服务条款', 'Terms'))}
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${year} UnionUser · ${t(
        lang,
        '基于 Keygate 引擎构建',
        'Built on the Keygate engine',
      )} · v${SITE_VERSION}</span>
      <span><a href="https://keygate.app" target="_blank" rel="noopener">Powered by Keygate</a></span>
    </div>
  </div>
</footer>`;
}

export function renderLayout({
  lang = 'zh',
  path = '/',
  title,
  description,
  body,
  bodyClass = '',
  jsonLd = null,
  noindex = false,
}) {
  const canonical = `${SITE_URL}${url(lang, path)}`;
  const zhUrl = `${SITE_URL}${url('zh', path)}`;
  const enUrl = `${SITE_URL}${url('en', path)}`;
  const siteName = 'UnionUser';
  const ogTitle = title;
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'zh-CN'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="zh-CN" href="${zhUrl}" />
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="x-default" href="${zhUrl}" />
  ${noindex ? '<meta name="robots" content="noindex" />' : ''}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE_URL}/assets/og.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${SITE_URL}/assets/og.png" />
  <meta name="theme-color" content="#0b1220" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="stylesheet" href="/assets/site.css" />
  <script src="/assets/site.js" defer></script>
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body class="${bodyClass}">
  <a class="skip-link" href="#main">${t(lang, '跳到主要内容', 'Skip to content')}</a>
  ${renderHeader(lang, path)}
  <main id="main">${body}</main>
  ${renderFooter(lang)}
</body>
</html>`;
}

export { LOGIN_URL, PORTAL_URL, SALES_EMAIL };
