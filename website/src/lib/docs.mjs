import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t, url, esc } from './layout.mjs';
import { icon, button, codeBlock, checklist, sectionHead, ctaBand } from './components.mjs';
import { PUBKEY_HEX, SALES_EMAIL, CONSOLE_URL } from '../config.mjs';

const h = (lang, zh, en) => t(lang, zh, en);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENAPI_FILE = path.resolve(__dirname, '../../../docs/openapi.yaml');

const DOCS_NAV = [
  {
    title: { zh: '开始使用', en: 'Getting started' },
    items: [
      { path: '/docs/quickstart/', zh: '快速开始', en: 'Quickstart' },
      { path: '/docs/concepts/', zh: '核心概念', en: 'Core concepts' },
      { path: '/docs/errors/', zh: '错误码', en: 'Error codes' },
    ],
  },
  {
    title: { zh: '接入指南', en: 'Integration guides' },
    items: [
      { path: '/docs/guides/javascript/', zh: 'JavaScript / Node', en: 'JavaScript / Node' },
      { path: '/docs/guides/java/', zh: 'Java', en: 'Java' },
      { path: '/docs/guides/python/', zh: 'Python', en: 'Python' },
      { path: '/docs/guides/rust/', zh: 'Rust / Tauri', en: 'Rust / Tauri' },
      { path: '/docs/guides/php/', zh: 'PHP', en: 'PHP' },
    ],
  },
  {
    title: { zh: '参考', en: 'Reference' },
    items: [
      { path: '/docs/api/', zh: 'API 参考', en: 'API reference' },
      { path: '/docs/self-hosted/', zh: '自托管', en: 'Self-hosting' },
    ],
  },
];

const ORDER = DOCS_NAV.flatMap((group) => group.items.map((item) => item.path));

const TAG_NAMES = {
  Site: { zh: '站点', en: 'Site' },
  Auth: { zh: '认证', en: 'Auth' },
  Signup: { zh: '自助注册', en: 'Signup' },
  Licensing: { zh: '授权', en: 'Licensing' },
  Portal: { zh: '客户门户', en: 'Portal' },
  Admin: { zh: '管理后台', en: 'Admin' },
  Releases: { zh: '发布源', en: 'Releases' },
  Stripe: { zh: '支付', en: 'Stripe' },
  Webhooks: { zh: 'Webhook', en: 'Webhooks' },
  Usage: { zh: '用量', en: 'Usage' },
  Floating: { zh: '浮动授权', en: 'Floating' },
  Members: { zh: '成员', en: 'Members' },
  Invites: { zh: '邀请', en: 'Invites' },
  Health: { zh: '健康检查', en: 'Health' },
  Billing: { zh: '账单', en: 'Billing' },
  Analytics: { zh: '分析', en: 'Analytics' },
  Audit: { zh: '审计', en: 'Audit' },
  Team: { zh: '团队', en: 'Team' },
  Notifications: { zh: '通知', en: 'Notifications' },
  Metrics: { zh: '指标', en: 'Metrics' },
  License: { zh: '授权', en: 'License' },
  Checkout: { zh: '结账', en: 'Checkout' },
  Session: { zh: '会话', en: 'Session' },
  Seats: { zh: '席位', en: 'Seats' },
  Entitlements: { zh: '权益', en: 'Entitlements' },
  Platform: { zh: '平台', en: 'Platform' },
  'Admin Licenses': { zh: '后台 · 授权', en: 'Admin · Licenses' },
  'Admin Releases': { zh: '后台 · 发布', en: 'Admin · Releases' },
  'Admin Webhooks': { zh: '后台 · Webhook', en: 'Admin · Webhooks' },
  Other: { zh: '其他', en: 'Other' },
};

let cachedOps = null;

export function loadOpenApi() {
  if (cachedOps) return cachedOps;
  const text = fs.readFileSync(OPENAPI_FILE, 'utf8');
  const lines = text.split('\n');
  const ops = [];
  let inPaths = false;
  let current = null;

  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (inPaths && /^[A-Za-z]/.test(line)) {
      inPaths = false;
      current = null;
      continue;
    }
    if (!inPaths) continue;

    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      current = { path: pathMatch[1], ops: [] };
      ops.push(current);
      continue;
    }

    const methodMatch = line.match(/^    (get|post|put|patch|delete):\s*$/);
    if (methodMatch && current) {
      current.ops.push({ method: methodMatch[1].toUpperCase(), summary: '', tag: 'Other' });
      continue;
    }

    const summaryMatch = line.match(/^      summary:\s*(.+?)\s*$/);
    if (summaryMatch && current && current.ops.length) {
      current.ops[current.ops.length - 1].summary = summaryMatch[1];
      continue;
    }

    const tagMatch = line.match(/^      tags:\s*\[(.+)\]\s*$/);
    if (tagMatch && current && current.ops.length) {
      current.ops[current.ops.length - 1].tag = tagMatch[1].split(',')[0].trim();
    }
  }

  cachedOps = ops;
  return ops;
}

function docsSidebar(lang, active) {
  const renderGroup = (group) => `<h4>${h(lang, group.title.zh, group.title.en)}</h4>${group.items
    .map(
      (item) =>
        `<a href="${url(lang, item.path)}" class="${active === item.path ? 'active' : ''}">${h(
          lang,
          item.zh,
          item.en,
        )}</a>`,
    )
    .join('')}`;
  return `<aside class="docs-side" aria-label="${h(lang, '文档导航', 'Docs navigation')}">
    ${DOCS_NAV.map(renderGroup).join('')}
    <h4>${h(lang, '站内', 'Site')}</h4>
    <a href="${url(lang, '/pricing/')}">${h(lang, '定价', 'Pricing')}</a>
    <a href="${url(lang, '/contact/')}">${h(lang, '联系销售', 'Contact sales')}</a>
  </aside>`;
}

function docsNavFooter(lang, active) {
  const index = ORDER.indexOf(active);
  const prev = index > 0 ? ORDER[index - 1] : null;
  const next = index >= 0 && index < ORDER.length - 1 ? ORDER[index + 1] : null;
  const label = (target, dir) => {
    const group = DOCS_NAV.flatMap((g) => g.items).find((item) => item.path === target);
    return `<a class="${dir}" href="${url(lang, target)}"><span>${h(
      lang,
      dir === 'prev' ? '上一页' : '下一页',
      dir === 'prev' ? 'Previous' : 'Next',
    )}</span>${h(lang, group.zh, group.en)}</a>`;
  };
  return `<div class="doc-nav">${prev ? label(prev, 'prev') : '<span></span>'}${
    next ? label(next, 'next') : ''
  }</div>`;
}

function docsPage({ lang, path: route, title, description, body, active, heroBody }) {
  return `<section class="docs-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="${url(lang, '/')}">${h(lang, '首页', 'Home')}</a><span>/</span><a href="${url(
        lang,
        '/docs/',
      )}">${h(lang, '文档', 'Docs')}</a><span>/</span><span>${esc(title)}</span></div>
      <h1>${title}</h1>
      <p>${description}</p>
      ${heroBody || ''}
    </div>
  </section>
  <div class="container">
    <div class="docs-layout">
      ${docsSidebar(lang, active || route)}
      <div class="docs-main">
        <article class="prose">${body}</article>
        ${docsNavFooter(lang, active || route)}
      </div>
    </div>
  </div>`;
}

/* Docs index */

export function renderDocsIndex(lang) {
  const title = h(lang, '文档中心 · UnionUser', 'Documentation · UnionUser');
  const description = h(
    lang,
    'UnionUser 接入文档：5 分钟快速开始、核心概念、五语言接入示例、API 参考与自托管部署。',
    'UnionUser documentation: 5-minute quickstart, core concepts, five language guides, API reference and self-hosting.',
  );
  const cards = [
    { icon: 'bolt', path: '/docs/quickstart/', zh: ['5 分钟快速开始', '从建产品到第一台设备激活。'], en: ['5-minute quickstart', 'From creating a product to the first activated device.'] },
    { icon: 'layers', path: '/docs/concepts/', zh: ['核心概念', '产品、套餐、授权、设备、席位与权益。'], en: ['Core concepts', 'Products, plans, licenses, devices, seats and entitlements.'] },
    { icon: 'code', path: '/docs/guides/javascript/', zh: ['接入示例', 'Java、JavaScript、Python、Rust、PHP。'], en: ['Integration guides', 'Java, JavaScript, Python, Rust and PHP.'] },
    { icon: 'terminal', path: '/docs/api/', zh: ['API 参考', '由 OpenAPI 生成，覆盖全部公开端点。'], en: ['API reference', 'Generated from OpenAPI and covering every public endpoint.'] },
    { icon: 'server', path: '/docs/self-hosted/', zh: ['自托管', 'Docker Compose、环境变量、备份与升级。'], en: ['Self-hosting', 'Docker Compose, environment variables, backups and upgrades.'] },
    { icon: 'shield', path: '/docs/errors/', zh: ['错误码', '把错误映射成用户能理解的动作。'], en: ['Error codes', 'Map errors to actions users understand.'] },
  ];
  const body = `
    <div class="guide-grid">
      ${cards
        .map(
          (card) => `<a class="guide-card" href="${url(lang, card.path)}">
            <span class="icon-box" style="margin-bottom:12px">${icon(card.icon)}</span>
            <strong>${h(lang, card.zh[0], card.en[0])}</strong>
            <span>${h(lang, card.zh[1], card.en[1])}</span>
          </a>`,
        )
        .join('')}
    </div>
    <h2>${h(lang, '安装包只带授权码', 'Your installer carries a license key, not a secret')}</h2>
    <p>${h(
      lang,
      '所有公开授权端点都直接用用户的 <code>license_key</code> 作为凭证，不需要在客户端内置 API Key。客户端只需要内置用于验证签名的公钥。',
      'Every public licensing endpoint uses the customer’s <code>license_key</code> as the credential. There is no API secret to embed. The client only pins the public key used to verify signatures.',
    )}</p>
    ${codeBlock({
      filename: 'curl',
      lang: 'bash',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `curl -X POST ${CONSOLE_URL}/api/v1/license/activate \\
  -H 'Content-Type: application/json' \\
  -d '{"license_key":"WB-XXXX-XXXX-XXXX","identifier":"wm-8f3a...","identifier_type":"device"}'`,
    })}
    <h2>${h(lang, '建议的阅读顺序', 'Suggested path')}</h2>
    <ol>
      <li>${h(lang, '快速开始：跑通激活与离线验签。', 'Quickstart: get activation and offline verification working.')}</li>
      <li>${h(lang, '核心概念：理解 token、exp、vun、权益与席位。', 'Core concepts: token, exp, vun, entitlements and seats.')}</li>
      <li>${h(lang, '对应语言指南：完整闭环与错误处理。', 'Your language guide: the full loop and error handling.')}</li>
      <li>${h(lang, 'API 参考与自托管：上线前确认边界。', 'API reference and self-hosting: confirm the boundaries before launch.')}</li>
    </ol>
    <div class="callout"><strong>${h(lang, '当前阶段', 'Current stage')}</strong> ${h(
      lang,
      `自助注册工作区尚未开放，需要开通试用或购买请联系 <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a>。文档与 API 已按最终形态编写。`,
      `Self-serve workspace registration is not open yet. Contact <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a> for a trial or purchase. The docs describe the final shape.`,
    )}</div>`;
  return {
    title,
    description,
    body: docsPage({
      lang,
      path: '/docs/',
      title: h(lang, '文档', 'Documentation'),
      description,
      body,
      active: '/docs/',
    }),
  };
}

/* Quickstart */

export function renderQuickstart(lang) {
  const title = h(lang, '快速开始 · UnionUser 文档', 'Quickstart · UnionUser Docs');
  const description = h(
    lang,
    '从创建工作区到第一台设备激活成功，大约需要 5 分钟。',
    'From creating a workspace to the first successful activation, in about five minutes.',
  );
  const body = `
    <p>${h(
      lang,
      '这份指南假设你已经拿到一个工作区。每个步骤都给出后台操作与对应的 API。',
      'This guide assumes you already have a workspace. Each step gives the dashboard action and the underlying API.',
    )}</p>
    <h2>1. ${h(lang, '创建工作区', 'Create a workspace')}</h2>
    <p>${h(
      lang,
      `当前由人工开通。发送邮件到 <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a>，说明产品名称与预计授权量；开通后会收到登录链接。`,
      `Workspaces are provisioned manually for now. Email <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a> with your product name and expected volume; you will receive a sign-in link.`,
    )}</p>
    <h2>2. ${h(lang, '创建产品', 'Create a product')}</h2>
    <p>${h(
      lang,
      '后台 → 产品 → 新建。桌面软件通常选择 <code>desktop</code> 类型，并开启设备激活。授权码前缀一经确定不建议修改。',
      'Dashboard → Products → New. Desktop apps usually use the <code>desktop</code> type with device activation enabled. Keep the license prefix stable once set.',
    )}</p>
    <h2>3. ${h(lang, '创建套餐', 'Create a plan')}</h2>
    <p>${h(
      lang,
      '设置授权模型（订阅、买断、试用）、设备上限、宽限期与权益。桌面应用的常见配置：',
      'Choose the license model (subscription, perpetual or trial), device limit, grace period and entitlements. A common desktop setup:',
    )}</p>
    ${codeBlock({
      filename: 'plan.json',
      lang: 'json',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `{
  "name": "Pro Yearly",
  "license_model": "subscription",
  "max_activations": 3,
  "grace_days": 7,
  "token_ttl_days": 7,
  "entitlements": {
    "publish": true,
    "exports": 500
  }
}`,
    })}
    <h2>4. ${h(lang, '签发一份授权', 'Issue a license')}</h2>
    <p>${h(
      lang,
      '后台 → 授权 → 新建，选择产品与套餐并填写客户邮箱。此时把授权码交给用户（或接 Stripe 自动发放）。',
      'Dashboard → Licenses → New, pick the product and plan, and enter the customer email. Send the key to the user, or let Stripe issue it automatically.',
    )}</p>
    <div class="callout warn"><strong>${h(lang, '注意', 'Note')}</strong> ${h(
      lang,
      '授权邮箱与客户登录邮箱不一致时，登录门户看不到这份授权；用户仍可在客户端手动输入授权码。',
      'If the license email differs from the customer’s sign-in email, the portal will not show the license. The user can still enter the key manually in the app.',
    )}</div>
    <h2>5. ${h(lang, '在客户端激活', 'Activate in the client')}</h2>
    ${codeBlock({
      filename: 'activate.js',
      lang: 'javascript',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `const BASE = '${CONSOLE_URL}';

async function activate(licenseKey, deviceId) {
  const res = await fetch(BASE + '/api/v1/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      identifier: deviceId,
      identifier_type: 'device',
    }),
  });
  if (!res.ok) throw new Error('activation failed: ' + res.status);
  const body = await res.json();
  return body.data.token; // store it locally
}`,
    })}
    <h2>6. ${h(lang, '离线验签', 'Verify offline')}</h2>
    <p>${h(
      lang,
      '客户端只需内置公钥。token 的格式是 <code>base64url(payload).base64url(sig)</code>，签名对象是 payload 的 base64 字符串。',
      'Pin the public key in the client. The token is <code>base64url(payload).base64url(sig)</code>, and the signature covers the payload’s base64 string.',
    )}</p>
    ${codeBlock({
      filename: 'verify.mjs',
      lang: 'javascript',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `import { verify, createPublicKey } from 'node:crypto';

const RAW = Buffer.from('${PUBKEY_HEX}', 'hex');
const SPKI = Buffer.concat([
  Buffer.from('302a300506032b6570032100', 'hex'),
  RAW,
]);
const publicKey = createPublicKey({ key: SPKI, format: 'der', type: 'spki' });

export function verifyToken(token) {
  const [payload, sig] = token.split('.');
  const ok = verify(
    null,
    Buffer.from(payload, 'ascii'),
    publicKey,
    Buffer.from(sig, 'base64url'),
  );
  if (!ok) throw new Error('INVALID_SIGNATURE');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (claims.exp * 1000 < Date.now()) throw new Error('TOKEN_EXPIRED');
  return claims;
}`,
    })}
    <h2>${h(lang, '常见坑', 'Common pitfalls')}</h2>
    <ul>
      <li>${h(lang, '<strong>设备指纹不稳定</strong>：不要用 MAC 地址或主机名，改用 MachineGuid / IOPlatformUUID / machine-id 并哈希。', '<strong>Unstable device id</strong>: avoid MAC addresses and hostnames. Use MachineGuid, IOPlatformUUID or machine-id, then hash it.')}</li>
      <li>${h(lang, '<strong>把 exp 当成授权到期</strong>：exp 是下次联网续验时间，vun 才是授权到期。', '<strong>Confusing exp with expiry</strong>: exp is the next check-in; vun is the license end.')}</li>
      <li>${h(lang, '<strong>系统时钟被改</strong>：离线验签会受影响，可结合本地记录的单调时间做辅助判断。', '<strong>Clock tampering</strong>: offline checks are affected; pair with a locally recorded monotonic time.')}</li>
      <li>${h(lang, '<strong>重装消耗设备位</strong>：机器标识可能变化，需在门户释放旧设备。', '<strong>Reinstalls consume slots</strong>: the machine id can change; release the old device in the portal.')}</li>
    </ul>`;
  return {
    title,
    description,
    body: docsPage({
      lang,
      path: '/docs/quickstart/',
      title: h(lang, '快速开始', 'Quickstart'),
      description,
      body,
      active: '/docs/quickstart/',
    }),
  };
}

/* Concepts */

export function renderConcepts(lang) {
  const title = h(lang, '核心概念 · UnionUser 文档', 'Core concepts · UnionUser Docs');
  const description = h(
    lang,
    '产品、套餐、授权、激活、设备、token、权益与席位之间的关系。',
    'How products, plans, licenses, activations, devices, tokens, entitlements and seats fit together.',
  );
  const rows = [
    ['Product', h(lang, '一个可授权的软件产品，拥有授权码前缀与发布源。', 'A licensable software product with a key prefix and release feeds.')],
    ['Plan', h(lang, '授权的规则模板：模型、设备上限、宽限期、续验间隔与权益。', 'A rule template: model, device limit, grace period, check-in interval and entitlements.')],
    ['License', h(lang, '发给一个客户的实例，绑定套餐、有效期与状态。', 'An instance issued to a customer, bound to a plan, term and status.')],
    ['Activation', h(lang, '某台设备使用某份授权的记录，占用一个设备名额。', 'A record of a device using a license, consuming one slot.')],
    ['Device identifier', h(lang, '客户端计算并哈希后的机器标识，用于绑定激活。', 'A hashed machine identifier used to bind activations.')],
    ['Token', h(lang, '服务端用 Ed25519 签名的离线凭证，内含 claims。', 'An Ed25519-signed offline credential with claims.')],
    ['exp', h(lang, 'token 的下次联网续验时间，不是授权到期。', 'When the token must check in again — not the license expiry.')],
    ['vun', h(lang, '授权本身的到期时间（买断可为空）。', 'The license end date (may be empty for perpetual).')],
    ['ftr', h(lang, '权益集合：布尔、数值与配额。客户端据此解锁功能。', 'Entitlements: boolean, numeric and quota. The client unlocks features from these.')],
    ['Seat', h(lang, '团队成员占用的名额；超限时最后加入者暂停。', 'A member slot; when over the limit, last-joined members pause.')],
    ['Webhook', h(lang, '支付、激活、吊销等事件的通知，带 HMAC 签名。', 'Notifications for payment, activation, revocation and more, signed with HMAC.')],
  ];
  const body = `
    <p>${h(
      lang,
      '先把这几个对象分清，后面看 API 会快很多。',
      'Get these objects straight and the API becomes much easier to read.',
    )}</p>
    <div class="table-wrap"><table><thead><tr><th>${h(lang, '对象', 'Object')}</th><th>${h(
      lang,
      '含义',
      'Meaning',
    )}</th></tr></thead><tbody>${rows
      .map(([name, desc]) => `<tr><td><code>${name}</code></td><td>${desc}</td></tr>`)
      .join('')}</tbody></table></div>
    <h2>${h(lang, '授权状态', 'License states')}</h2>
    <p><code>trialing</code> · <code>active</code> · <code>expired</code> · <code>suspended</code> · <code>revoked</code></p>
    <p>${h(
      lang,
      '状态变化会反映在下一次 verify 或新签发的 token 中。离线期间无法感知吊销，最长延迟到一个 token 的 exp。',
      'State changes appear on the next verify or newly issued token. Revocations cannot be seen while offline; the delay is bounded by the token’s exp.',
    )}</p>
    <h2>${h(lang, '为什么 exp 和 vun 分开', 'Why exp and vun are separate')}</h2>
    <p>${h(
      lang,
      'exp 控制「多久必须联网一次」，vun 控制「授权买到什么时候」。把两者分开，可以在不缩短授权期限的前提下控制离线窗口，也可以在续费后立即签发更长的 vun 而不影响客户端节奏。',
      'exp controls how often the app must check in; vun controls how long the license is sold for. Separating them bounds the offline window without shortening the term, and lets a renewal extend vun without changing the client’s rhythm.',
    )}</p>
    <h2>${h(lang, '权益的三种形态', 'Three kinds of entitlements')}</h2>
    <ul>
      <li><strong>boolean</strong>：${h(lang, '功能开关，例如 <code>publish: true</code>。', 'feature flags, e.g. <code>publish: true</code>.')}</li>
      <li><strong>numeric</strong>：${h(lang, '容量上限，例如导出次数或项目数。', 'capacity limits, e.g. exports or projects.')}</li>
      <li><strong>quota</strong>：${h(lang, '随时间滚动的原子配额，由服务端扣减。', 'rolling atomic quotas consumed on the server.')}</li>
    </ul>
    <div class="callout"><strong>${h(lang, '客户端的判断顺序', 'Client check order')}</strong> ${h(
      lang,
      '验签 → 检查 did 与设备指纹 → 检查 exp → 读取 ftr 解锁功能。不要只判断「有没有 token」。',
      'Verify signature → match did with the device id → check exp → read ftr. Do not stop at “a token exists”.',
    )}</div>`;
  return {
    title,
    description,
    body: docsPage({
      lang,
      path: '/docs/concepts/',
      title: h(lang, '核心概念', 'Core concepts'),
      description,
      body,
      active: '/docs/concepts/',
    }),
  };
}

/* Errors */

export function renderErrors(lang) {
  const title = h(lang, '错误码 · UnionUser 文档', 'Error codes · UnionUser Docs');
  const description = h(
    lang,
    '激活、校验与支付相关错误码、HTTP 状态与建议处理方式。',
    'Activation, verification and payment error codes, HTTP statuses and recommended handling.',
  );
  const rows = [
    ['LICENSE_NOT_FOUND', '404', h(lang, '授权码不存在或已被删除', 'The key does not exist or was deleted'), h(lang, '提示检查授权码，不要自动重试', 'Ask the user to check the key; do not auto-retry')],
    ['LICENSE_EXPIRED', '403', h(lang, '授权已过期', 'The license expired'), h(lang, '展示续费；保留只读能力', 'Offer renewal; keep read-only features')],
    ['LICENSE_SUSPENDED', '403', h(lang, '授权被暂停', 'The license is suspended'), h(lang, '提示联系管理员', 'Ask the user to contact the owner')],
    ['LICENSE_REVOKED', '403', h(lang, '授权被吊销', 'The license was revoked'), h(lang, '停止解锁付费功能', 'Lock paid features')],
    ['ACTIVATION_LIMIT', '409', h(lang, '设备名额已满', 'No device slot left'), h(lang, '引导门户解绑旧设备', 'Send the user to release a device')],
    ['DEVICE_HELD', '409', h(lang, '设备被锁定或正在迁移', 'The device is held or migrating'), h(lang, '稍后重试或联系支持', 'Retry later or contact support')],
    ['SEAT_PAUSED', '403', h(lang, '席位超限，该成员暂停', 'The member is paused over the seat limit'), h(lang, '扩容或移除成员', 'Add a seat or remove a member')],
    ['FLOATING_LICENSE', '409', h(lang, '浮动授权需要先获取会话', 'A floating license needs a session first'), h(lang, '调用 floating checkout', 'Call floating checkout')],
    ['RATE_LIMITED', '429', h(lang, '请求过于频繁', 'Too many requests'), h(lang, '指数退避；不要并发轰炸', 'Exponential backoff; do not retry in parallel')],
    ['INVALID_IDEMPOTENCY_KEY', '400', h(lang, '幂等键格式无效或复用了不同请求', 'Invalid idempotency key or reused with a different body'), h(lang, '每次重试复用同一个键', 'Reuse the same key per retry')],
    ['UNAUTHORIZED', '401', h(lang, '门户/管理接口未登录', 'No session for portal/admin routes'), h(lang, '重新登录或刷新 token', 'Sign in again or refresh the session')],
    ['LICENSE_KEY_REQUIRED', '401', h(lang, '受保护的发布源缺少授权', 'A gated release feed needs a license'), h(lang, '附带 license_key 或 token', 'Send the license key or token')],
  ];
  const body = `
    <p>${h(
      lang,
      '所有错误都返回 JSON：<code>{ "success": false, "error": { "code": "...", "message": "..." } }</code>。请按 code 做分支，不要依赖 message 文案。',
      'Every error returns JSON: <code>{ "success": false, "error": { "code": "...", "message": "..." } }</code>. Branch on the code, never on the message text.',
    )}</p>
    <div class="table-wrap"><table><thead><tr><th>Code</th><th>HTTP</th><th>${h(lang, '含义', 'Meaning')}</th><th>${h(lang, '建议处理', 'Handling')}</th></tr></thead><tbody>${rows
      .map(
        ([code, status, meaning, action]) =>
          `<tr><td><code>${code}</code></td><td>${status}</td><td>${meaning}</td><td>${action}</td></tr>`,
      )
      .join('')}</tbody></table></div>
    <h2>${h(lang, '重试策略', 'Retry strategy')}</h2>
    ${checklist([
      h(lang, '5xx、超时与 429 可重试；4xx 业务错误不要盲目重试。', 'Retry 5xx, timeouts and 429. Do not blindly retry 4xx business errors.'),
      h(lang, '激活重试带上同一个 Idempotency-Key，避免重复占位。', 'Use the same Idempotency-Key when retrying activation.'),
      h(lang, '指数退避加抖动，首次 1 秒，上限 30 秒。', 'Exponential backoff with jitter, starting at 1s and capped at 30s.'),
      h(lang, '离线时先信任本地 token，恢复网络后再续验。', 'While offline, trust the local token and check in when the network returns.'),
    ])}`;
  return {
    title,
    description,
    body: docsPage({
      lang,
      path: '/docs/errors/',
      title: h(lang, '错误码', 'Error codes'),
      description,
      body,
      active: '/docs/errors/',
    }),
  };
}

/* API reference */

export function renderApi(lang) {
  const title = h(lang, 'API 参考 · UnionUser 文档', 'API reference · UnionUser Docs');
  const description = h(
    lang,
    '由仓库 docs/openapi.yaml 生成的接口清单，按模块分组，支持页内过滤。',
    'Endpoint inventory generated from docs/openapi.yaml, grouped by module and filterable in-page.',
  );
  const ops = loadOpenApi();
  const groups = new Map();
  for (const item of ops) {
    for (const op of item.ops) {
      const tag = op.tag || 'Other';
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push({ ...op, path: item.path });
    }
  }
  const preferred = [
    'License',
    'Signup',
    'Auth',
    'Session',
    'Checkout',
    'Portal',
    'Seats',
    'Entitlements',
    'Floating',
    'Usage',
    'Releases',
    'Webhooks',
    'Stripe',
    'Site',
    'Platform',
    'Admin Licenses',
    'Admin Releases',
    'Admin Webhooks',
  ];
  const sorted = [...groups.entries()].sort((a, b) => {
    const ia = preferred.indexOf(a[0]);
    const ib = preferred.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const endpointCount = ops.reduce((sum, item) => sum + item.ops.length, 0);
  const groupHtml = sorted
    .map(([tag, list]) => {
      const name = TAG_NAMES[tag] ? h(lang, TAG_NAMES[tag].zh, TAG_NAMES[tag].en) : tag;
      return `<h2 id="tag-${esc(tag.toLowerCase())}">${esc(name)} <span style="font-size:0.8rem;color:var(--muted-2);font-weight:500">${list.length}</span></h2>
        <div class="api-list">
        ${list
          .map(
            (op) => `<div class="endpoint" data-api="${esc(`${op.method} ${op.path} ${op.summary}`.toLowerCase())}">
              <div class="endpoint-head"><span class="method ${op.method.toLowerCase()}">${op.method}</span><span class="endpoint-path">${esc(op.path)}</span></div>
              ${op.summary ? `<p>${esc(op.summary)}</p>` : ''}
            </div>`,
          )
          .join('')}
        </div>`;
    })
    .join('');
  const body = `
    <p>${h(
      lang,
      `共 <strong>${ops.length}</strong> 个路径、<strong>${endpointCount}</strong> 个操作，直接由 <code>docs/openapi.yaml</code> 生成。完整参数、请求体与响应结构请下载规范文件。`,
      `<strong>${ops.length}</strong> paths and <strong>${endpointCount}</strong> operations, generated from <code>docs/openapi.yaml</code>. Download the spec for full parameters, bodies and responses.`,
    )}</p>
    <div class="hero-actions" style="margin:18px 0 8px">
      ${button('/openapi.yaml', h(lang, '下载 OpenAPI 规范', 'Download OpenAPI'), 'ghost', 'btn-sm')}
      ${button(`${CONSOLE_URL}/api/v1/license/pubkey`, h(lang, '查看公钥', 'View public key'), 'ghost', 'btn-sm', true)}
    </div>
    <div class="field" style="max-width:420px;margin:18px 0 8px">
      <label for="api-filter">${h(lang, '过滤端点', 'Filter endpoints')}</label>
      <input id="api-filter" type="search" placeholder="${h(lang, '例如 activate、portal、webhook', 'e.g. activate, portal, webhook')}" data-api-filter />
    </div>
    <div class="callout"><strong>${h(lang, '鉴权方式', 'Authentication')}</strong> ${h(
      lang,
      '公开授权端点使用用户自己的 <code>license_key</code>；门户使用登录会话；管理接口使用后台会话或 <code>kg_live_…</code> API Key。',
      'Public license endpoints take the customer’s own <code>license_key</code>; portal routes use a session; admin routes use a dashboard session or a <code>kg_live_…</code> API key.',
    )}</div>
    ${groupHtml}`;
  return {
    title,
    description,
    body: docsPage({
      lang,
      path: '/docs/api/',
      title: h(lang, 'API 参考', 'API reference'),
      description,
      body,
      active: '/docs/api/',
    }),
  };
}

/* Self-hosted */

export function renderSelfHosted(lang) {
  const title = h(lang, '自托管 · UnionUser 文档', 'Self-hosting · UnionUser Docs');
  const description = h(
    lang,
    '使用 Docker Compose 部署 UnionUser（Keygate 引擎）与 PostgreSQL：环境变量、升级、备份与许可说明。',
    'Deploy UnionUser (Keygate engine) and PostgreSQL with Docker Compose: environment, upgrades, backups and licensing.',
  );
  const body = `
    <p>${h(
      lang,
      '自托管需要购买商业授权。源码不公开；你会得到容器镜像与部署支持。',
      'Self-hosting requires a commercial license. The source is not public; you receive container images and deployment support.',
    )}</p>
    <h2>${h(lang, '环境要求', 'Requirements')}</h2>
    ${checklist([
      h(lang, 'Linux 服务器，2 vCPU / 2 GB 内存起步', 'Linux host, starting at 2 vCPU / 2 GB RAM'),
      h(lang, 'Docker Engine 24+ 与 Docker Compose 2.24+', 'Docker Engine 24+ with Docker Compose 2.24+'),
      h(lang, 'PostgreSQL 16+（可用 Compose 内置实例）', 'PostgreSQL 16+ (the bundled Compose service is fine)'),
      h(lang, '一个域名与 HTTPS 证书', 'A domain and an HTTPS certificate'),
      h(lang, '可选：S3 兼容对象存储，用于更新产物', 'Optional: S3-compatible storage for release artifacts'),
    ])}
    <h2>${h(lang, '最小 Compose', 'Minimal Compose')}</h2>
    ${codeBlock({
      filename: 'docker-compose.yml',
      lang: 'yaml',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `services:
  keygate:
    image: <your-licensed-image>
    ports:
      - "9000:9000"
    env_file: .env
    environment:
      PORT: "9000"
      ENVIRONMENT: production
      BASE_URL: https://licenses.example.com
      DATABASE_URL: postgres://keygate:keygate@postgres:5432/keygate?sslmode=disable
      JWT_SECRET: \${JWT_SECRET:?set me}
      LICENSE_SIGNING_KEY: \${LICENSE_SIGNING_KEY:?set me}
      ADMIN_EMAILS: admin@example.com
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: keygate
      POSTGRES_PASSWORD: keygate
      POSTGRES_DB: keygate
    volumes:
      - pgdata:/var/lib/postgresql
    restart: unless-stopped

volumes:
  pgdata:`,
    })}
    <h2>${h(lang, '关键环境变量', 'Key environment variables')}</h2>
    <div class="table-wrap"><table><thead><tr><th>${h(lang, '变量', 'Variable')}</th><th>${h(
      lang,
      '作用',
      'Purpose',
    )}</th></tr></thead><tbody>
      ${[
        ['BASE_URL', h(lang, '对外访问地址，用于邮件链接与发布源 URL', 'Public origin used in emails and feed URLs')],
        ['DATABASE_URL', h(lang, 'PostgreSQL 连接串', 'PostgreSQL connection string')],
        ['JWT_SECRET', h(lang, '会话签名密钥，长度足够且保密', 'Session signing secret, long and private')],
        ['LICENSE_SIGNING_KEY', h(lang, '许可证 Ed25519 私钥；更换会导致旧 token 失效', 'Ed25519 private key for licenses; rotating invalidates old tokens')],
        ['ADMIN_EMAILS', h(lang, '管理员邮箱，逗号分隔', 'Admin emails, comma-separated')],
        ['SMTP_*', h(lang, '验证码与通知邮件', 'OTP and notification email')],
        ['STRIPE_*', h(lang, '支付与 webhook（可选）', 'Payments and webhooks (optional)')],
        ['REDIS_URL', h(lang, '可选，用于限流与缓存', 'Optional rate limiting and cache')],
      ]
        .map(([name, desc]) => `<tr><td><code>${name}</code></td><td>${desc}</td></tr>`)
        .join('')}
    </tbody></table></div>
    <h2>${h(lang, '升级与备份', 'Upgrades and backups')}</h2>
    <ul>
      <li>${h(lang, '升级前备份 PostgreSQL 与 <code>LICENSE_SIGNING_KEY</code>；私钥丢失无法恢复已签发 token。', 'Back up PostgreSQL and <code>LICENSE_SIGNING_KEY</code> before upgrades; losing the key breaks issued tokens.')}</li>
      <li>${h(lang, '镜像按版本固定 tag，不要使用浮动 latest。', 'Pin image tags by version; avoid a floating latest.')}</li>
      <li>${h(lang, '先在小规模副本验证迁移，再切换生产。', 'Test migrations on a copy before switching production.')}</li>
      <li>${h(lang, '定期导出授权与审计数据，保留到合规要求的期限。', 'Export license and audit data on a schedule and retain it as compliance requires.')}</li>
    </ul>
    <h2>${h(lang, '许可与署名', 'License and attribution')}</h2>
    <div class="callout warn"><strong>${h(lang, 'AGPL v3 署名', 'AGPL v3 attribution')}</strong> ${h(
      lang,
      '产品界面必须保留 “Powered by Keygate”。自托管不等于获得白标或转售权；如需白标，请同时取得上游商业授权。',
      'The UI must keep “Powered by Keygate”. Self-hosting does not grant white-label or resale rights; those require a separate upstream commercial license.',
    )}</div>
    <p>${h(
      lang,
      `需要自托管报价或安全评审材料，请联系 <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a>。`,
      `For a self-hosted quote or a security review packet, contact <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a>.`,
    )}</p>`;
  return {
    title,
    description,
    body: docsPage({
      lang,
      path: '/docs/self-hosted/',
      title: h(lang, '自托管', 'Self-hosting'),
      description,
      body,
      active: '/docs/self-hosted/',
    }),
  };
}

/* Language guides */

const COMMON_INTRO = {
  zh: '本指南覆盖完整闭环：激活 → 本地保存 → 启动校验 → 停用。示例假设你已经拿到工作区与一份授权码。',
  en: 'This guide covers the full loop: activate → store → verify on startup → deactivate. It assumes you already have a workspace and a license key.',
};

function guidePage(lang, {
  slug,
  titleZh,
  titleEn,
  descZh,
  descEn,
  intro,
  steps,
}) {
  const title = h(lang, `${titleZh} 接入指南 · UnionUser 文档`, `${titleEn} · UnionUser Docs`);
  const description = h(lang, descZh, descEn);
  const body = `<p>${intro || h(lang, COMMON_INTRO.zh, COMMON_INTRO.en)}</p>${steps}`;
  return {
    title,
    description,
    body: docsPage({
      lang,
      path: `/docs/guides/${slug}/`,
      title: h(lang, `${titleZh} 接入指南`, `${titleEn} integration guide`),
      description,
      body,
      active: `/docs/guides/${slug}/`,
    }),
  };
}

export function renderGuideJavaScript(lang) {
  const steps = `
    <h2>${h(lang, '1. 激活', '1. Activate')}</h2>
    ${codeBlock({
      filename: 'license.js',
      lang: 'javascript',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `const BASE = '${CONSOLE_URL}';

export async function activate(licenseKey, deviceId) {
  const res = await fetch(BASE + '/api/v1/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      identifier: deviceId,
      identifier_type: 'device',
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error.code);
  return json.data.token;
}`,
    })}
    <h2>${h(lang, '2. 离线验签', '2. Verify offline')}</h2>
    ${codeBlock({
      filename: 'verify.js',
      lang: 'javascript',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `import { verify, createPublicKey } from 'node:crypto';

const publicKey = createPublicKey({
  key: Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    Buffer.from('${PUBKEY_HEX}', 'hex'),
  ]),
  format: 'der',
  type: 'spki',
});

export function verifyToken(token, deviceId) {
  const [payloadB64, sigB64] = token.split('.');
  const ok = verify(
    null,
    Buffer.from(payloadB64, 'ascii'),
    publicKey,
    Buffer.from(sigB64, 'base64url'),
  );
  if (!ok) throw new Error('INVALID_SIGNATURE');

  const claims = JSON.parse(
    Buffer.from(payloadB64, 'base64url').toString('utf8'),
  );
  if (claims.did !== deviceId) throw new Error('DEVICE_MISMATCH');
  if (claims.exp * 1000 < Date.now()) throw new Error('TOKEN_EXPIRED');
  return claims;
}`,
    })}
    <h2>${h(lang, '3. 停用', '3. Deactivate')}</h2>
    ${codeBlock({
      filename: 'deactivate.js',
      lang: 'javascript',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `export async function deactivate(licenseKey, deviceId) {
  const res = await fetch(BASE + '/api/v1/license/deactivate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      identifier: deviceId,
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error.code);
}`,
    })}
    <h2>${h(lang, 'Electron 提示', 'Electron notes')}</h2>
    <ul>
      <li>${h(lang, '网络请求放在主进程，渲染进程通过 IPC 调用，避免 token 暴露给页面。', 'Make requests in the main process and call it over IPC so the token never reaches the renderer.')}</li>
      <li>${h(lang, 'token 存在 userData 目录，不要写进安装目录。', 'Store the token under the userData directory, not the install directory.')}</li>
      <li>${h(lang, '启动时先验签再决定是否联网，弱网环境体验更稳。', 'Verify on startup before deciding to go online; it behaves better on weak networks.')}</li>
    </ul>`;
  return guidePage(lang, {
    slug: 'javascript',
    titleZh: 'JavaScript / Node',
    titleEn: 'JavaScript / Node',
    descZh: '在 Node、Electron 中使用 fetch 与 node:crypto 完成激活与 Ed25519 离线验签。',
    descEn: 'Activate and verify Ed25519 offline in Node and Electron with fetch and node:crypto.',
    steps,
  });
}

export function renderGuideJava(lang) {
  const steps = `
    <p>${h(lang, '需要 JDK 15+（Ed25519 支持）。示例只依赖标准库。', 'Requires JDK 15+ for Ed25519. The example uses only the standard library.')}</p>
    <h2>${h(lang, '1. 激活', '1. Activate')}</h2>
    ${codeBlock({
      filename: 'LicenseClient.java',
      lang: 'java',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;

static final String BASE = "${CONSOLE_URL}";

static String activate(String licenseKey, String deviceId) throws Exception {
    String json = "{\\"license_key\\":\\"" + licenseKey
        + "\\",\\"identifier\\":\\"" + deviceId
        + "\\",\\"identifier_type\\":\\"device\\"}";

    HttpRequest req = HttpRequest.newBuilder(URI.create(BASE + "/api/v1/license/activate"))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
        .build();

    HttpResponse<String> res = HttpClient.newHttpClient()
        .send(req, HttpResponse.BodyHandlers.ofString());
    if (res.statusCode() != 200) throw new IllegalStateException("activate " + res.statusCode());
    // Parse token from the JSON response (use your JSON library here).
    return res.body();
}`,
    })}
    <h2>${h(lang, '2. 离线验签', '2. Verify offline')}</h2>
    ${codeBlock({
      filename: 'Verify.java',
      lang: 'java',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.HexFormat;

static final byte[] SPKI_PREFIX = HexFormat.of()
    .parseHex("302a300506032b6570032100");
static final byte[] RAW_PUBLIC = HexFormat.of()
    .parseHex("${PUBKEY_HEX}");

static boolean verifyToken(String token, String deviceId) throws Exception {
    String[] parts = token.split("\\\\.");
    String payloadB64 = parts[0];
    byte[] signature = b64url(parts[1]);

    byte[] spki = new byte[SPKI_PREFIX.length + RAW_PUBLIC.length];
    System.arraycopy(SPKI_PREFIX, 0, spki, 0, SPKI_PREFIX.length);
    System.arraycopy(RAW_PUBLIC, 0, spki, SPKI_PREFIX.length, RAW_PUBLIC.length);

    PublicKey key = KeyFactory.getInstance("Ed25519")
        .generatePublic(new X509EncodedKeySpec(spki));

    Signature sig = Signature.getInstance("Ed25519");
    sig.initVerify(key);
    sig.update(payloadB64.getBytes(StandardCharsets.US_ASCII));
    if (!sig.verify(signature)) return false;

    // Decode payload and compare did / exp with your JSON parser.
    return true;
}

static byte[] b64url(String value) {
    String padded = value;
    while (padded.length() % 4 != 0) padded += "=";
    return Base64.getUrlDecoder().decode(padded);
}`,
    })}
    <h2>${h(lang, '3. 停用', '3. Deactivate')}</h2>
    ${codeBlock({
      filename: 'Deactivate.java',
      lang: 'java',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `HttpRequest req = HttpRequest.newBuilder(URI.create(BASE + "/api/v1/license/deactivate"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();
HttpResponse<String> res = HttpClient.newHttpClient()
    .send(req, HttpResponse.BodyHandlers.ofString());`,
    })}
    <h2>${h(lang, '桌面集成提示', 'Desktop notes')}</h2>
    <ul>
      <li>${h(lang, '用 Jackson 或 Gson 解析响应和 payload，避免手写字符串拼接。', 'Use Jackson or Gson for responses and payloads instead of manual string building.')}</li>
      <li>${h(lang, 'Windows 可用 <code>reg query</code> 读取 MachineGuid；Java 侧也可用 JNA（需额外依赖）。', 'On Windows, read MachineGuid with <code>reg query</code>, or JNA if you add the dependency.')}</li>
      <li>${h(lang, '把 token 存在用户目录（如 <code>%APPDATA%</code>），不要写注册表明文的私密内容。', 'Store the token under the user profile (e.g. <code>%APPDATA%</code>).')}</li>
    </ul>`;
  return guidePage(lang, {
    slug: 'java',
    titleZh: 'Java',
    titleEn: 'Java',
    descZh: '使用 JDK 标准库 HttpClient 与 Ed25519 完成激活、验签与停用。',
    descEn: 'Activate, verify and deactivate with the JDK HttpClient and Ed25519.',
    steps,
  });
}

export function renderGuidePython(lang) {
  const steps = `
    <p>${h(
      lang,
      'HTTP 使用标准库 urllib；验签使用 cryptography 包（pip install cryptography）。',
      'HTTP uses the standard urllib; verification uses the cryptography package (pip install cryptography).',
    )}</p>
    <h2>${h(lang, '1. 激活', '1. Activate')}</h2>
    ${codeBlock({
      filename: 'license.py',
      lang: 'python',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `import json
import urllib.request

BASE = "${CONSOLE_URL}"

def activate(license_key, device_id):
    payload = json.dumps({
        "license_key": license_key,
        "identifier": device_id,
        "identifier_type": "device",
    }).encode()
    req = urllib.request.Request(
        BASE + "/api/v1/license/activate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        body = json.loads(res.read())
    if not body.get("success"):
        raise RuntimeError(body["error"]["code"])
    return body["data"]["token"]`,
    })}
    <h2>${h(lang, '2. 离线验签', '2. Verify offline')}</h2>
    ${codeBlock({
      filename: 'verify.py',
      lang: 'python',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `import base64
import json
import time
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

RAW_PUBLIC = bytes.fromhex("${PUBKEY_HEX}")
public_key = Ed25519PublicKey.from_public_bytes(RAW_PUBLIC)

def b64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))

def verify_token(token, device_id):
    payload_b64, sig_b64 = token.split(".")
    public_key.verify(b64url(sig_b64), payload_b64.encode("ascii"))

    claims = json.loads(b64url(payload_b64))
    if claims["did"] != device_id:
        raise ValueError("DEVICE_MISMATCH")
    if claims["exp"] < time.time():
        raise ValueError("TOKEN_EXPIRED")
    return claims`,
    })}
    <h2>${h(lang, '3. 停用', '3. Deactivate')}</h2>
    ${codeBlock({
      filename: 'deactivate.py',
      lang: 'python',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `def deactivate(license_key, device_id):
    payload = json.dumps({
        "license_key": license_key,
        "identifier": device_id,
    }).encode()
    req = urllib.request.Request(
        BASE + "/api/v1/license/deactivate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read())`,
    })}
    <h2>${h(lang, '打包提示', 'Packaging notes')}</h2>
    <ul>
      <li>${h(lang, 'PyInstaller 打包时把 cryptography 作为隐藏依赖测试一遍。', 'Test cryptography as a hidden import when packaging with PyInstaller.')}</li>
      <li>${h(lang, 'QSettings / platformdirs 保存 token，不要写进只读安装目录。', 'Store the token with QSettings or platformdirs, not in a read-only install directory.')}</li>
      <li>${h(lang, '异常先区分网络错误与业务错误，再决定是否重试。', 'Separate network failures from business errors before retrying.')}</li>
    </ul>`;
  return guidePage(lang, {
    slug: 'python',
    titleZh: 'Python',
    titleEn: 'Python',
    descZh: '使用 urllib 与 cryptography 完成激活、Ed25519 验签与停用。',
    descEn: 'Activate, verify Ed25519 and deactivate with urllib and cryptography.',
    steps,
  });
}

export function renderGuideRust(lang) {
  const steps = `
    <p>${h(
      lang,
      '依赖：reqwest（blocking 或 async）、serde_json、ed25519-dalek、base64、hex-literal。',
      'Dependencies: reqwest (blocking or async), serde_json, ed25519-dalek, base64 and hex-literal.',
    )}</p>
    <h2>${h(lang, '1. 激活', '1. Activate')}</h2>
    ${codeBlock({
      filename: 'src/license.rs',
      lang: 'rust',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `use serde_json::json;

const BASE: &str = "${CONSOLE_URL}";

pub fn activate(license_key: &str, device_id: &str) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::new();
    let res = client
        .post(format!("{}/api/v1/license/activate", BASE))
        .json(&json!({
            "license_key": license_key,
            "identifier": device_id,
            "identifier_type": "device"
        }))
        .send()?;

    let body: serde_json::Value = res.json()?;
    if body["success"] != true {
        return Err(body["error"]["code"].as_str().unwrap_or("UNKNOWN").into());
    }
    Ok(body["data"]["token"].as_str().unwrap_or_default().to_string())
}`,
    })}
    <h2>${h(lang, '2. 离线验签', '2. Verify offline')}</h2>
    ${codeBlock({
      filename: 'src/verify.rs',
      lang: 'rust',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use ed25519_dalek::{Signature, VerifyingKey};
use serde_json::Value;

const RAW_PUBLIC: [u8; 32] = hex_literal::hex!("${PUBKEY_HEX}");

pub fn verify_token(token: &str, device_id: &str) -> Result<Value, Box<dyn std::error::Error>> {
    let (payload_b64, sig_b64) = token.split_once('.').ok_or("BAD_TOKEN")?;
    let sig_bytes = URL_SAFE_NO_PAD.decode(sig_b64)?;
    let signature = Signature::from_slice(&sig_bytes)?;
    let key = VerifyingKey::from_bytes(&RAW_PUBLIC)?;
    key.verify_strict(payload_b64.as_bytes(), &signature)?;

    let claims: Value = serde_json::from_slice(&URL_SAFE_NO_PAD.decode(payload_b64)?)?;
    if claims["did"] != device_id {
        return Err("DEVICE_MISMATCH".into());
    }
    Ok(claims)
}`,
    })}
    <h2>${h(lang, '3. 停用', '3. Deactivate')}</h2>
    ${codeBlock({
      filename: 'src/license.rs',
      lang: 'rust',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `pub fn deactivate(license_key: &str, device_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    reqwest::blocking::Client::new()
        .post(format!("{}/api/v1/license/deactivate", BASE))
        .json(&json!({ "license_key": license_key, "identifier": device_id }))
        .send()?;
    Ok(())
}`,
    })}
    <h2>${h(lang, 'Tauri 提示', 'Tauri notes')}</h2>
    <ul>
      <li>${h(lang, '把授权逻辑放在 Rust 侧（命令），前端只拿功能开关结果。', 'Keep licensing in Rust commands; expose only capability flags to the frontend.')}</li>
      <li>${h(lang, 'token 存到 app_data_dir，不要放进前端 localStorage。', 'Store the token in app_data_dir, not the frontend localStorage.')}</li>
      <li>${h(lang, 'ed25519-dalek 的 verify_strict 可拒绝弱公钥，建议使用。', 'Prefer ed25519-dalek’s verify_strict to reject weak keys.')}</li>
    </ul>`;
  return guidePage(lang, {
    slug: 'rust',
    titleZh: 'Rust / Tauri',
    titleEn: 'Rust / Tauri',
    descZh: '使用 reqwest 与 ed25519-dalek 在 Rust 或 Tauri 应用中完成授权闭环。',
    descEn: 'Complete the licensing loop in Rust or Tauri with reqwest and ed25519-dalek.',
    steps,
  });
}

export function renderGuidePhp(lang) {
  const steps = `
    <p>${h(
      lang,
      '需要 PHP 8+ 与 ext-sodium、ext-curl。验签使用 sodium 的原生 Ed25519 接口。',
      'Requires PHP 8+ with ext-sodium and ext-curl. Verification uses sodium’s native Ed25519 API.',
    )}</p>
    <h2>${h(lang, '1. 激活', '1. Activate')}</h2>
    ${codeBlock({
      filename: 'license.php',
      lang: 'php',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `<?php
const BASE = '${CONSOLE_URL}';

function activate(string $licenseKey, string $deviceId): string {
    $ch = curl_init(BASE . '/api/v1/license/activate');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'license_key' => $licenseKey,
            'identifier' => $deviceId,
            'identifier_type' => 'device',
        ]),
        CURLOPT_TIMEOUT => 15,
    ]);
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    $body = json_decode($raw, true);
    if ($status !== 200 || empty($body['success'])) {
        throw new RuntimeException($body['error']['code'] ?? 'ACTIVATE_FAILED');
    }
    return $body['data']['token'];
}`,
    })}
    <h2>${h(lang, '2. 离线验签', '2. Verify offline')}</h2>
    ${codeBlock({
      filename: 'verify.php',
      lang: 'php',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `<?php
const RAW_PUBLIC = '${PUBKEY_HEX}';

function verifyToken(string $token, string $deviceId): array {
    [$payloadB64, $sigB64] = explode('.', $token, 2);
    $signature = base64UrlDecode($sigB64);
    $publicKey = hex2bin(RAW_PUBLIC);

    if (!sodium_crypto_sign_verify_detached($signature, $payloadB64, $publicKey)) {
        throw new RuntimeException('INVALID_SIGNATURE');
    }

    $claims = json_decode(base64UrlDecode($payloadB64), true);
    if (($claims['did'] ?? null) !== $deviceId) {
        throw new RuntimeException('DEVICE_MISMATCH');
    }
    if (($claims['exp'] ?? 0) < time()) {
        throw new RuntimeException('TOKEN_EXPIRED');
    }
    return $claims;
}

function base64UrlDecode(string $value): string {
    $value = strtr($value, '-_', '+/');
    $pad = strlen($value) % 4;
    if ($pad > 0) $value .= str_repeat('=', 4 - $pad);
    return base64_decode($value, true);
}`,
    })}
    <h2>${h(lang, '3. 停用', '3. Deactivate')}</h2>
    ${codeBlock({
      filename: 'deactivate.php',
      lang: 'php',
      copyLabel: h(lang, '复制', 'Copy'),
      code: `<?php
$ch = curl_init(BASE . '/api/v1/license/deactivate');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode([
        'license_key' => $licenseKey,
        'identifier' => $deviceId,
    ]),
]);
$result = json_decode(curl_exec($ch), true);
curl_close($ch);`,
    })}
    <h2>${h(lang, '部署提示', 'Deployment notes')}</h2>
    <ul>
      <li>${h(lang, '确认 PHP 启用了 sodium；某些发行版需要单独安装。', 'Make sure sodium is enabled; some distributions need it installed separately.')}</li>
      <li>${h(lang, '授权码与 token 不要写进 Web 根目录下的可下载文件。', 'Never store keys or tokens in downloadable files under the web root.')}</li>
      <li>${h(lang, '如果是桌面应用，通常用本地 PHP 运行时或先做一层本地服务。', 'For desktop apps, prefer a local runtime or a thin local service.')}</li>
    </ul>`;
  return guidePage(lang, {
    slug: 'php',
    titleZh: 'PHP',
    titleEn: 'PHP',
    descZh: '使用 curl 与 ext-sodium 完成激活、Ed25519 验签与停用。',
    descEn: 'Activate, verify Ed25519 and deactivate with curl and ext-sodium.',
    steps,
  });
}

export const DOCS_RENDERERS = {
  '/docs/': renderDocsIndex,
  '/docs/quickstart/': renderQuickstart,
  '/docs/concepts/': renderConcepts,
  '/docs/errors/': renderErrors,
  '/docs/api/': renderApi,
  '/docs/self-hosted/': renderSelfHosted,
  '/docs/guides/javascript/': renderGuideJavaScript,
  '/docs/guides/java/': renderGuideJava,
  '/docs/guides/python/': renderGuidePython,
  '/docs/guides/rust/': renderGuideRust,
  '/docs/guides/php/': renderGuidePhp,
};
