import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(
  'C:/Users/Intel/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright',
);

const base = process.env.BASE_URL || 'http://localhost:4173';
const routes = [
  '/',
  '/features/',
  '/how-it-works/',
  '/pricing/',
  '/compare/',
  '/faq/',
  '/contact/',
  '/changelog/',
  '/privacy/',
  '/terms/',
  '/docs/',
  '/docs/quickstart/',
  '/docs/concepts/',
  '/docs/errors/',
  '/docs/api/',
  '/docs/self-hosted/',
  '/docs/guides/javascript/',
  '/docs/guides/java/',
  '/docs/guides/python/',
  '/docs/guides/rust/',
  '/docs/guides/php/',
];

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

let failures = 0;
const check = (ok, message) => {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${message}`);
  }
};

for (const lang of ['', '/en']) {
  for (const route of routes) {
    const target = `${base}${lang}${route}`;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(target, { waitUntil: 'networkidle' });
    const title = await page.title();
    check(title.length > 4, `title missing: ${target}`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(overflow <= 1, `desktop overflow ${overflow}px: ${target}`);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(mobileOverflow <= 1, `mobile overflow ${mobileOverflow}px: ${target}`);
  }
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/pricing/`, { waitUntil: 'networkidle' });
const monthly = await page.locator('[data-price-monthly]').nth(1).textContent();
await page.click('[data-period="yearly"]');
const yearly = await page.locator('[data-price-monthly]').nth(1).textContent();
check(monthly.trim() === '$29' && yearly.trim() === '$24', `billing toggle ${monthly} -> ${yearly}`);
const billed = await page.locator('[data-billed]').nth(1).textContent();
check(billed.includes('290'), 'yearly billing note');

await page.goto(`${base}/docs/api/`, { waitUntil: 'networkidle' });
const visibleBefore = await page.locator('[data-api]:visible').count();
await page.fill('[data-api-filter]', 'activate');
const visibleAfter = await page.locator('[data-api]:visible').count();
check(visibleAfter > 0 && visibleAfter < visibleBefore, `api filter ${visibleBefore} -> ${visibleAfter}`);

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.click('[data-mobile-toggle]');
const menuVisible = await page.locator('[data-mobile-menu] a').first().isVisible();
check(menuVisible, 'mobile menu opens');

await page.goto(`${base}/contact/?plan=business`, { waitUntil: 'networkidle' });
const selected = await page.locator('select[name="plan"]').inputValue();
check(selected === 'business', `contact plan preselect: ${selected}`);

// Static console prototype (English-only, noindexed page; not in the lang loop)
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/console/licenses/`, { waitUntil: 'networkidle' });
const consoleTitle = await page.title();
check(consoleTitle.includes('Licenses'), `console prototype title: ${consoleTitle}`);
const consoleOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
check(consoleOverflow <= 1, `console prototype desktop overflow ${consoleOverflow}px`);
await page.click('#dateRangeBtn');
check(await page.locator('#datePopover').isVisible(), 'console date popover opens');
await page.locator('#datePopover button:has-text("Apply")').click();
check(!(await page.locator('#datePopover').isVisible()), 'console date popover closes');

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
const consoleMobileOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
check(consoleMobileOverflow <= 1, `console prototype mobile overflow ${consoleMobileOverflow}px`);

check(errors.length === 0, `console errors: ${errors.join(' | ')}`);

await browser.close();
if (failures) {
  console.log(`${failures} failure(s)`);
  process.exit(1);
}
console.log(`QA passed: ${routes.length * 2} pages, desktop + mobile, interactions`);
