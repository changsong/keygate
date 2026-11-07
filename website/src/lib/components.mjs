import { esc, t, url } from './layout.mjs';

const PATHS = {
  shield:
    '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3z"/>',
  key: '<circle cx="8.5" cy="8.5" r="4.5"/><path d="M11.7 11.7L20 20m-3-3l2-2m-5-1l2-2"/>',
  bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>',
  devices:
    '<rect x="2" y="5" width="13" height="10" rx="2"/><path d="M6 19h5m-2.5-4v4"/><rect x="17" y="9" width="5" height="10" rx="1.5"/>',
  refresh:
    '<path d="M20 11a8 8 0 10-2.3 6.4M20 5v6h-6"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2A3.2 3.2 0 0117 11m1.5 3.7c1.6.7 2.5 2.1 2.5 3.8"/>',
  code: '<path d="M9 7l-5 5 5 5m6-10l5 5-5 5"/>',
  chart: '<path d="M4 20V10m5 10V4m5 16v-7m5 7V7"/>',
  cloud:
    '<path d="M7 18h10a4 4 0 00.5-8A6 6 0 006 9.5 4.5 4.5 0 007 18z"/>',
  server:
    '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  arrow: '<path d="M5 12h14m-6-6l6 6-6 6"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers:
    '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>',
  webhook:
    '<path d="M8.5 14.5a4 4 0 013.5-6h3M15.5 9.5a4 4 0 01-3.5 6h-3"/><path d="M9 18.5a4 4 0 01-2-7.5M15 5.5a4 4 0 012 7.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  download: '<path d="M12 3v12m-5-5l5 5 5-5M4 20h16"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3m6 0h4"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>',
  building:
    '<path d="M4 21V5l8-3v19M12 21h8V9l-8-4"/><path d="M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
};

export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    PATHS[name] || PATHS.spark
  }</svg>`;
}

export function button(href, label, variant = 'primary', extra = '', external = false) {
  const ext = external ? ' target="_blank" rel="noopener"' : '';
  return `<a class="btn btn-${variant}${extra ? ` ${extra}` : ''}" href="${href}"${ext}>${label}</a>`;
}

export const arrow = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6l6 6-6 6"/></svg>`;

export function checklist(items) {
  return `<ul class="checklist">${items
    .map((item) => `<li>${icon('check', 18)}<span>${item}</span></li>`)
    .join('')}</ul>`;
}

export function sectionHead({ eyebrow, title, sub, center = false }) {
  return `<div class="section-head${center ? ' center' : ''}">
    ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
    <h2>${title}</h2>
    ${sub ? `<p class="sub">${sub}</p>` : ''}
  </div>`;
}

export function codeBlock({ code, filename, lang = 'javascript', copyLabel = 'Copy' }) {
  const trimmed = String(code).replace(/^\n+|\n+$/g, '');
  return `<div class="codeblock">
    <div class="code-head"><span>${esc(filename || lang)}</span><button class="copy-btn" type="button" data-copy="${esc(
      copyLabel,
    )}" data-copied="Copied">${esc(copyLabel)}</button></div>
    <pre><code>${esc(trimmed)}</code></pre>
  </div>`;
}

export function faqList(items) {
  return `<div class="faq">${items
    .map(
      (item) =>
        `<details><summary>${item.q}</summary><p>${item.a}</p></details>`,
    )
    .join('')}</div>`;
}

export function ctaBand(lang, {
  title,
  sub,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}) {
  return `<div class="cta-band">
    <div>
      <h2>${title}</h2>
      <p>${sub}</p>
    </div>
    <div class="cta-actions">
      ${button(primaryHref, primaryLabel, 'light')}
      ${secondaryLabel ? button(secondaryHref, secondaryLabel, 'outline-light') : ''}
    </div>
  </div>`;
}

export function codeSampleTab(lang, code) {
  return code;
}
