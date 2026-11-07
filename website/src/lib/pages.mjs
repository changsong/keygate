import { PLANS, SITE_URL, SALES_EMAIL, PORTAL_URL } from '../config.mjs';
import { t, url, esc, LOGIN_URL } from './layout.mjs';
import {
  icon,
  button,
  arrow,
  checklist,
  sectionHead,
  faqList,
  ctaBand,
} from './components.mjs';

const h = (lang, zh, en) => t(lang, zh, en);
const contact = (lang, plan) => url(lang, `/contact/?plan=${plan}`);
const docs = (lang, path = '/docs/') => url(lang, path);

function dashboardMock(lang) {
  return `<div class="mock">
    <div class="mock-head">
      <span>UnionUser · Dashboard</span>
      <span class="status-pill"><span class="dot"></span>${h(lang, '实时', 'Live')}</span>
    </div>
    <img src="/assets/dashboard.png" alt="${h(
      lang,
      'UnionUser 授权后台仪表盘截图',
      'UnionUser licensing dashboard screenshot',
    )}" loading="lazy" />
  </div>`;
}

function featureCards(lang) {
  const items = [
    {
      icon: 'key',
      zh: ['授权与激活', '订阅、买断、试用、浮动授权；激活、校验、停用、暂停、吊销全生命周期。', '/features/#licensing'],
      en: ['Licensing & activation', 'Subscriptions, perpetual, trials and floating licenses across the full lifecycle.', '/features/#licensing'],
    },
    {
      icon: 'shield',
      zh: ['Ed25519 离线验签', '公钥内置客户端，私钥不出服务器；联网间隔与授权到期分离。', '/features/#offline'],
      en: ['Offline Ed25519 verification', 'Pin the public key, keep the private key on the server. Check-in interval is separate from licence expiry.', '/features/#offline'],
    },
    {
      icon: 'spark',
      zh: ['试用与自助领证', '邮箱验证码注册即领试用；每地址一份、每日限额、到期自动回落。', '/features/#trials'],
      en: ['Trials & self-signup', 'Email-OTP signup issues a trial instantly, one per address, daily capped, with fallback plans.', '/features/#trials'],
    },
    {
      icon: 'card',
      zh: ['支付与订阅', 'Stripe Checkout、webhook、成功页与定时对账三层保障。', '/features/#payments'],
      en: ['Payments & subscriptions', 'Stripe Checkout with webhook, success-page and scheduled reconciliation safeguards.', '/features/#payments'],
    },
    {
      icon: 'users',
      zh: ['席位与权益', '所有者与成员独立密钥，席位暂停即释放；布尔、数值与配额权益。', '/features/#seats'],
      en: ['Seats & entitlements', 'Owner and member keys, seat pause, boolean, numeric and quota entitlements.', '/features/#seats'],
    },
    {
      icon: 'cloud',
      zh: ['自动更新分发', 'Sparkle、Velopack、Tauri 共用发布源；原子发布、yank 回滚。', '/features/#updates'],
      en: ['Update distribution', 'One release feed for Sparkle, Velopack and Tauri, with atomic publishing and yank.', '/features/#updates'],
    },
    {
      icon: 'chart',
      zh: ['用量与配额', '原子扣减，小时/日/月/年周期，阈值触发 webhook。', '/features/#usage'],
      en: ['Usage & quotas', 'Atomic quotas on hourly, daily, monthly or yearly windows with threshold webhooks.', '/features/#usage'],
    },
    {
      icon: 'server',
      zh: ['后台与客户门户', '产品、套餐、客户、API Key、审计、团队与品牌定制；客户自助换机续费。', '/features/#portal'],
      en: ['Admin & customer portal', 'Products, plans, customers, API keys, audit, team and branding; customers self-serve.', '/features/#portal'],
    },
  ];
  return `<div class="grid grid-3">${items
    .map(
      (item, index) => `<article class="card">
        <span class="icon-box${index % 3 === 1 ? ' mint' : ''}">${icon(item.icon)}</span>
        <h3>${h(lang, item.zh[0], item.en[0])}</h3>
        <p>${h(lang, item.zh[1], item.en[1])}</p>
        <a class="card-link" href="${url(lang, h(lang, item.zh[2], item.en[2]))}">${h(
          lang,
          '了解详情',
          'Learn more',
        )} ${arrow}</a>
      </article>`,
    )
    .join('')}</div>`;
}

function steps(lang) {
  const items = [
    ['注册工作区', 'Create workspace', '邮箱验证码登录，30 秒完成。'],
    ['创建产品与套餐', 'Add product & plan', '设置设备数、宽限期与权益。'],
    ['生成授权', 'Issue licenses', '后台手动发码，或接入 Stripe 自动发放。'],
    ['客户端激活', 'Activate in the app', '调用 activate，保存签名 token。'],
    ['上线并观察', 'Ship & observe', '离线验签；后台看设备、支付与更新。'],
  ];
  const en = [
    'Sign in with an email code. Takes 30 seconds.',
    'Set device limits, grace period and entitlements.',
    'Issue keys manually, or let Stripe issue them.',
    'Call activate and store the signed token.',
    'Verify offline; watch devices, payments and releases.',
  ];
  return `<div class="steps">${items
    .map(
      (item, i) => `<div class="step">
        <span class="step-num">${i + 1}</span>
        <h3>${h(lang, item[0], item[1])}</h3>
        <p>${h(lang, item[2], en[i])}</p>
      </div>`,
    )
    .join('')}</div>`;
}

function compactPlanCards(lang) {
  const desc = {
    developer: ['个人项目与原型', 'Personal projects and prototypes'],
    pro: ['独立开发者与小团队', 'Indie developers and small teams'],
    business: ['多产品与团队协作', 'Multiple products and teams'],
    enterprise: ['大客户、自托管与白标', 'Large teams, self-hosting and white-label'],
  };
  return `<div class="pricing-grid">${PLANS.map((plan) => {
    const price = plan.priceMonthly === 0
      ? '<span class="amount">$0</span>'
      : `<span class="amount">$${plan.priceMonthly}</span><span class="period">${h(
          lang,
          '/月',
          '/mo',
        )}</span>`;
    const ctaLabel =
      plan.cta === 'trial'
        ? h(lang, '开始 31 天试用', 'Start 31-day trial')
        : plan.cta === 'demo'
          ? h(lang, '预约演示', 'Book a demo')
          : h(lang, '免费开始', 'Start free');
    return `<article class="plan${plan.recommended ? ' recommended' : ''}">
      ${plan.recommended ? `<span class="plan-badge">${h(lang, '推荐', 'Popular')}</span>` : ''}
      <h3>${plan.name}</h3>
      <p class="plan-desc">${h(lang, desc[plan.id][0], desc[plan.id][1])}</p>
      <div class="plan-price">${price}</div>
      <div class="billed">${h(lang, `${plan.products} 个产品 · ${plan.licenses} 份活跃授权`, `${plan.products} product(s) · ${plan.licenses} active licenses`)}</div>
      <div class="plan-cta">${button(contact(lang, plan.id), ctaLabel, plan.recommended ? 'primary' : 'ghost')}</div>
    </article>`;
  }).join('')}</div>`;
}

function stackSection(lang) {
  const langs = ['Java', 'JavaScript', 'Python', 'Rust', 'PHP'];
  return `<div class="section section-soft">
    <div class="container">
      <div class="split">
        <div class="split-copy">
          <div class="eyebrow">${h(lang, '接入示例', 'Integration guides')}</div>
          <h2>${h(lang, '五种语言，今天就能跑通', 'Five languages, working today')}</h2>
          <p>${h(
            lang,
            '每个示例都覆盖「激活 → 本地保存 → 启动校验 → 停用」完整闭环。客户端只保存授权码与公开公钥，绝不下发 API Key。',
            'Every guide covers activate → store → verify on startup → deactivate. The client stores a license key and a public key, never an API secret.',
          )}</p>
          <div class="stack-tags" style="margin-top:22px">
            ${langs.map((name) => `<span class="tag"><strong>${name}</strong></span>`).join('')}
          </div>
          <div class="hero-actions" style="margin-bottom:0">
            ${button(docs(lang, '/docs/quickstart/'), h(lang, '5 分钟快速开始', '5-minute quickstart'), 'primary')}
            ${button(url(lang, '/docs/'), h(lang, '浏览全部文档', 'Browse all docs'), 'ghost')}
          </div>
        </div>
        <div class="mock dark">
          <div class="mock-head"><span>verify.js</span><span>Ed25519</span></div>
          <pre class="code-body"><span class="tok-key">import</span> { verify } <span class="tok-key">from</span> <span class="tok-str">'node:crypto'</span>;

<span class="tok-key">const</span> [body, sig] = token.split(<span class="tok-str">'.'</span>);
<span class="tok-key">const</span> ok = <span class="tok-fn">verify</span>(
  <span class="tok-key">null</span>,
  Buffer.from(body, <span class="tok-str">'ascii'</span>),
  publicKey,              <span class="tok-com">// pinned SPKI</span>
  Buffer.from(sig, <span class="tok-str">'base64url'</span>)
);
<span class="tok-key">if</span> (!ok) <span class="tok-key">throw new</span> Error(<span class="tok-str">'bad signature'</span>);</pre>
        </div>
      </div>
    </div>
  </div>`;
}

export function renderHome(lang) {
  const title = h(
    lang,
    'UnionUser · 为桌面软件而生的授权管理平台',
    'UnionUser · Licensing infrastructure for desktop software',
  );
  const description = h(
    lang,
    '激活、试用、订阅、买断、支付、自动更新与客户门户，一套接完。客户端只带授权码，支持 Ed25519 离线验签与自托管。',
    'Activation, trials, subscriptions, perpetual licenses, payments, updates, and a customer portal in one platform. License-key only clients, offline Ed25519 verification, self-hosting supported.',
  );

  const body = `
  <section class="home-hero">
    <div class="container">
      <div class="home-hero-head fade-up">
        <div class="home-hero-badge">
          <span class="hh-dot"></span>
          <span class="hh-ver">v2.4 LTS</span>
          <span class="hh-sep">|</span>
          <span>${h(
            lang,
            '31 天 Pro 全功能免费试用 · 零信用卡绑定',
            '31-day full Pro trial · no credit card',
          )}</span>
        </div>
        <h1>${h(
          lang,
          '为桌面软件而生的<br class="hh-br" />授权与计费基础设施',
          'Licensing and billing infrastructure<br class="hh-br" />built for desktop software',
        )}</h1>
        <p class="home-hero-lead">${h(
          lang,
          '激活、试用、离线验签、订阅管理与客户门户，一次搞定。基于 Ed25519 非对称公钥体系，私钥不下发、离线可校验、原子控并发。',
          'Activation, trials, offline verification, subscriptions and a customer portal — done in one place. Built on Ed25519 public-key cryptography: private keys never leave your infrastructure, clients verify offline, and seat allocation stays atomic.',
        )}</p>
        <div class="home-hero-actions">
          ${button(contact(lang, 'trial'), h(lang, '免费开始使用', 'Start free'), 'primary')}
          ${button(docs(lang, '/docs/quickstart/'), h(lang, '5 分钟快速接入指南', '5-minute integration guide'), 'ghost')}
        </div>
        <p class="home-hero-micro">${h(
          lang,
          'ENGINE: Keygate Core · 离线签名私钥不出内网 · 支持公有云 SaaS 与单机 Docker 私有化',
          'ENGINE: Keygate Core · signing keys never leave your network · managed SaaS or single-node Docker',
        )}</p>
      </div>

      <div class="verify-stage fade-up delay-1" id="verify-stage">
        <div class="verify-stage-bar">
          <div class="vs-left">
            <span class="vs-dot"></span><span class="vs-dot"></span><span class="vs-dot"></span>
            <span class="vs-path">client-agent // session_verify_worker</span>
          </div>
          <span class="vs-status"><span class="vs-live"></span>Ed25519 Engine Active</span>
        </div>
        <div class="verify-stage-grid">
          <div class="verify-code">
            <div>
              <div class="verify-code-head">
                <span class="vc-title">${h(lang, '桌面端极简验签调用', 'Minimal desktop verification')}</span>
                <span class="verify-tabs">
                  <span class="verify-tab active">Electron</span>
                  <span class="verify-tab">Tauri</span>
                  <span class="verify-tab">Rust</span>
                </span>
              </div>
              <pre class="verify-codeblock"><code><span class="vc">// 1. ${h(lang, '客户端嵌入只读公钥 (无凭证泄露隐患)', 'pin the read-only public key (no secrets bundled)')}</span>
<span class="vk">const</span> <span class="vt">PUBLIC_KEY</span> = <span class="vs">"0x9f4a...d91c"</span>;

<span class="vc">// 2. ${h(lang, '本地瞬时校验 Ed25519 签名与名额', 'verify the Ed25519 signature and seat locally')}</span>
<span class="vk">const</span> result = <span class="vk">await</span> union.<span class="vf">verify</span>({
  licenseKey: <span class="vs">"UU-PRO-8842-X"</span>,
  machineId: platform.<span class="vf">hardwareUUID</span>(),
  offlineGraceHours: <span class="vn">720</span>
});

<span class="vc">// 3. ${h(lang, '极速放行或激活', 'unlock or activate instantly')}</span>
<span class="vk">if</span> (result.valid) {
  desktopApp.<span class="vf">unlockProFeatures</span>();
}</code></pre>
            </div>
            <div class="verify-code-foot">
              <span>${h(lang, '验签平均耗时:', 'Average verification:')} <strong>0.42 ms</strong></span>
              <span>${h(lang, '支持 100% 局域网离线沙盒', '100% LAN offline sandbox')}</span>
            </div>
          </div>

          <div class="decision-card">
            <div class="decision-head">
              <div>
                <div class="decision-meta">
                  <span class="dm-label">Decision record</span>
                  <span class="dm-txn">txn_9f2c41ab</span>
                  <span class="dm-os">· macOS Sonoma (ARM64)</span>
                </div>
                <h2>${h(lang, '许可证完整性与设备席位决策', 'License integrity and seat decision')}</h2>
              </div>
              <span class="decision-status">${icon('check', 12)}${h(
                lang,
                '校验成功放行',
                'Verified · allow',
              )}</span>
            </div>
            <div class="decision-label">WHAT UNIONUSER VALIDATED</div>
            <div class="decision-rows">
              <div class="decision-row">
                <div>
                  <div class="dr-title">${h(lang, 'Ed25519 签名与防重放 Hash', 'Ed25519 signature and replay hash')}</div>
                  <div class="dr-sub">${h(
                    lang,
                    '本地公钥 SHA-256 签名匹配，无私钥泄露交互',
                    'SHA-256 signature matches the pinned public key; no private key exchange',
                  )}</div>
                </div>
                <span class="dr-state">● ${h(lang, '签名有效 (Valid)', 'Valid')}</span>
              </div>
              <div class="decision-row">
                <div>
                  <div class="dr-title">${h(lang, '硬件指纹绑定 (IOPlatformUUID + CPUID)', 'Hardware fingerprint (IOPlatformUUID + CPUID)')}</div>
                  <div class="dr-sub">${h(
                    lang,
                    '设备哈希值与注册记录完全吻合，防虚机克隆',
                    'Device hash matches the registration record; blocks VM cloning',
                  )}</div>
                </div>
                <span class="dr-state">● ${h(lang, '设备已匹配 (Matched)', 'Matched')}</span>
              </div>
              <div class="decision-row">
                <div>
                  <div class="dr-title">${h(lang, '席位配额 (Seat Quota Control)', 'Seat quota control')}</div>
                  <div class="dr-sub">${h(
                    lang,
                    '当前并发占用: 2 / 3 设备 · 授权许可充足',
                    'Concurrent use: 2 / 3 devices · within quota',
                  )}</div>
                </div>
                <span class="dr-state">● ${h(lang, '原子名额正常', 'Within quota')}</span>
              </div>
              <div class="decision-row">
                <div>
                  <div class="dr-title">${h(lang, '离线容忍宽限期 (Offline Grace Window)', 'Offline grace window')}</div>
                  <div class="dr-sub">${h(
                    lang,
                    '离线宽限期 30 天 · 剩余可用 28 天 · 自动后台续约',
                    '30-day offline grace · 28 days left · renews automatically',
                  )}</div>
                </div>
                <span class="dr-state wait">${h(lang, '剩余 672h', '672h left')}</span>
              </div>
            </div>
            <div class="decision-foot">
              <span>${h(lang, '客户自助操作: ', 'Customer self-service: ')}<a href="${PORTAL_URL}">${h(
                lang,
                '打开客户自助门户 (解绑/开票)',
                'open customer portal (unbind / invoice)',
              )}</a></span>
              <span class="decision-ghost">${h(lang, '审计日志导出 ↗', 'Export audit log ↗')}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="trust-pills fade-up delay-2">
        <span class="trust-pill">Ed25519 ${h(lang, '离线验签', 'offline verification')}</span>
        <span class="tp-sep">·</span>
        <span class="trust-pill">${h(lang, '原子名额并发控制', 'atomic seat allocation')}</span>
        <span class="tp-sep">·</span>
        <span class="trust-pill">Stripe ${h(lang, '订阅与全币种支付', 'subscriptions & multi-currency')}</span>
        <span class="tp-sep">·</span>
        <span class="trust-pill">Sparkle / Velopack / Tauri ${h(lang, '自动更新', 'auto-updates')}</span>
        <span class="tp-sep">·</span>
        <span class="trust-pill">Docker ${h(lang, '私有化自托管', 'self-hosting')}</span>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${sectionHead({
        eyebrow: h(lang, '为什么是 UnionUser', 'Why UnionUser'),
        title: h(lang, '把授权做成产品，而不是一段拼凑的代码', 'Licensing as a product, not a pile of glue code'),
        sub: h(
          lang,
          '大多数桌面软件最终都会自己写一套「授权码 + 服务器 + 支付 + 更新」的胶水。UnionUser 把它变成开箱可用的平台。',
          'Most desktop apps eventually hand-roll a license server, payment hooks and an update feed. UnionUser turns that pile of glue into a product.',
        ),
      })}
      <div class="grid grid-3">
        <article class="card">
          <span class="icon-box">${icon('key')}</span>
          <h3>${h(lang, '客户端只带授权码', 'Your binary ships no secret')}</h3>
          <p>${h(
            lang,
            'SDK 端点直接用用户自己的授权码，不需要把 API Key 打进安装包。拿到安装包也拿不到你的后台权限。',
            'SDK endpoints take the customer’s own license key. No API secret inside your installer, so a leaked build leaks nothing extra.',
          )}</p>
          <a class="card-link" href="${url(lang, '/features/#offline')}">${h(lang, '离线验签原理', 'How offline verification works')} ${arrow}</a>
        </article>
        <article class="card">
          <span class="icon-box mint">${icon('users')}</span>
          <h3>${h(lang, '客户自己管理自己', 'Customers serve themselves')}</h3>
          <p>${h(
            lang,
            '换机、加席位、开发票、续维护期，全在客户门户完成。你的支持邮箱不再被「帮我解绑一下」淹没。',
            'Device moves, seat changes, invoices and maintenance renewals all live in the customer portal — not in your support inbox.',
          )}</p>
          <a class="card-link" href="${url(lang, '/features/#portal')}">${h(lang, '客户门户能力', 'Customer portal')} ${arrow}</a>
        </article>
        <article class="card">
          <span class="icon-box">${icon('server')}</span>
          <h3>${h(lang, '数据在自己的手里', 'Your data stays yours')}</h3>
          <p>${h(
            lang,
            '托管 SaaS 开箱即用；需要合规或私有化时，可购买商业授权自托管。Go + PostgreSQL，无 Redis 也能跑。',
            'Use the managed SaaS, or buy a commercial self-hosted license. Go + PostgreSQL, and it runs without Redis.',
          )}</p>
          <a class="card-link" href="${docs(lang, '/docs/self-hosted/')}">${h(lang, '自托管说明', 'Self-hosting')} ${arrow}</a>
        </article>
      </div>
    </div>
  </section>

  <section class="section section-soft">
    <div class="container">
      <div class="split">
        <div class="split-copy">
          <div class="eyebrow">${h(lang, '一个后台', 'One dashboard')}</div>
          <h2>${h(lang, '授权、设备、支付与更新，在同一张表里', 'Licenses, devices, payments and releases in one place')}</h2>
          <p>${h(
            lang,
            '从第一份试用授权到第 10,000 台激活设备，后台都能回答：谁在用、什么时候到期、哪台设备、付了多少钱、该收到哪个版本。',
            'From the first trial key to the 10,000th activated device, the dashboard answers: who, until when, on which device, paid how much, and which release they should get.',
          )}</p>
          ${checklist([
            h(lang, '按产品、套餐、状态过滤授权，批量发码与吊销', 'Filter licenses by product, plan and status; issue and revoke in bulk'),
            h(lang, '设备激活记录与释放，原子名额不超卖', 'Device activation records and releases with atomic slot accounting'),
            h(lang, 'Stripe 支付、退款、账单门户与到期提醒', 'Stripe payments, refunds, billing portal and expiry reminders'),
            h(lang, 'Sparkle / Velopack / Tauri 发布源与签名', 'Sparkle / Velopack / Tauri release feeds with per-release signatures'),
          ])}
          <div class="hero-actions" style="margin-bottom:0">
            ${button(url(lang, '/features/'), h(lang, '查看全部能力', 'See all capabilities'), 'primary')}
            ${button(contact(lang, 'demo'), h(lang, '预约演示', 'Book a demo'), 'ghost')}
          </div>
        </div>
        ${dashboardMock(lang)}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${sectionHead({
        eyebrow: h(lang, '能力清单', 'Capabilities'),
        title: h(lang, '桌面软件授权需要的一切', 'Everything a desktop license needs'),
        sub: h(
          lang,
          '每一项都对应真实 API 与后台界面，不虚构能力。',
          'Every capability maps to a real API and a real screen in the dashboard.',
        ),
      })}
      ${featureCards(lang)}
    </div>
  </section>

  <section class="section section-soft">
    <div class="container">
      ${sectionHead({
        eyebrow: h(lang, '五步上线', 'Five steps'),
        title: h(lang, '从注册到第一台设备激活', 'From sign-up to the first activated device'),
        sub: h(
          lang,
          '不必先读完整套文档。按顺序走完五步，就有一条可用的授权链路。',
          'You do not need the whole manual. Five steps get you a working license path.',
        ),
      })}
      ${steps(lang)}
    </div>
  </section>

  ${stackSection(lang)}

  <section class="section">
    <div class="container">
      ${sectionHead({
        eyebrow: h(lang, '定价', 'Pricing'),
        title: h(lang, '按真实使用量付费', 'Priced against real usage'),
        sub: h(
          lang,
          'Developer 永久免费；Pro 提供 31 天全功能试用，无需信用卡。',
          'Developer is free forever. Pro comes with a 31-day, full-feature trial — no credit card.',
        ),
        center: true,
      })}
      ${compactPlanCards(lang)}
      <p class="pricing-note">${h(
        lang,
        '按活跃授权计费 · 年付约 8.3 折 · 自托管商业授权单列。',
        'Billed on active licenses · annual saves two months · self-hosted licenses quoted separately.',
      )} <a href="${url(lang, '/pricing/')}">${h(lang, '查看完整定价', 'See full pricing')} →</a></p>
    </div>
  </section>

  <section class="section section-soft">
    <div class="container">
      ${sectionHead({
        eyebrow: h(lang, '常见问题', 'FAQ'),
        title: h(lang, '工程师最常问的几件事', 'What engineers ask first'),
        center: true,
      })}
      ${faqList(homeFaq(lang))}
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${ctaBand(lang, {
        title: h(lang, '今天就把授权接上', 'Wire up licensing today'),
        sub: h(
          lang,
          '免费试用 31 天。客户端离线可验，后台随时吊销。',
          'Start a 31-day trial. Verify offline in the client, revoke from the dashboard anytime.',
        ),
        primaryLabel: h(lang, '免费试用 31 天', 'Start 31-day trial'),
        primaryHref: contact(lang, 'trial'),
        secondaryLabel: h(lang, '阅读快速开始', 'Read the quickstart'),
        secondaryHref: docs(lang, '/docs/quickstart/'),
      })}
    </div>
  </section>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'UnionUser',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    url: SITE_URL,
  };

  return { title, description, body, jsonLd };
}

function homeFaq(lang) {
  return [
    {
      q: h(lang, '客户端需要把 API Key 打进安装包吗？', 'Does my app need an API key baked in?'),
      a: h(
        lang,
        '不需要。公开的授权端点直接用用户自己的 license_key 作为凭证；客户端只需要内置验证签名用的公钥。',
        'No. Public license endpoints accept the customer’s license key as the credential. Your app only pins the public key used to verify signatures.',
      ),
    },
    {
      q: h(lang, '断网时还能授权吗？', 'Does licensing work offline?'),
      a: h(
        lang,
        '可以。授权 token 是 Ed25519 签名的，客户端可在离线状态验证签名、设备绑定与有效期；到期后再联网续验。',
        'Yes. The license token is Ed25519-signed and the client verifies signature, device binding and expiry offline. It checks in again when the token expires.',
      ),
    },
    {
      q: h(lang, '一份授权能装几台设备？', 'How many devices per license?'),
      a: h(
        lang,
        '由套餐配置，默认建议 3 台。激活名额在数据库层原子扣减，重试不会重复计数；客户可在门户自助解绑。',
        'The plan defines it; 3 is the recommended default. Slots are decremented atomically in the database, so retries do not double-count, and customers can release devices in the portal.',
      ),
    },
    {
      q: h(lang, '支持哪些支付方式？', 'Which payment methods are supported?'),
      a: h(
        lang,
        '内建 Stripe：订阅、买断、试用、退款、账单门户与到期提醒。也可以手动发码，先收款再录入。',
        'Stripe is built in: subscriptions, perpetual licenses, trials, refunds, billing portal and expiry reminders. You can also issue keys manually after an offline sale.',
      ),
    },
    {
      q: h(lang, '能私有化部署吗？', 'Can we self-host?'),
      a: h(
        lang,
        '可以。购买自托管商业授权后，用 Docker Compose 部署 Go 服务与 PostgreSQL；源码不公开。',
        'Yes. A commercial self-hosted license lets you run the Go service and PostgreSQL with Docker Compose. The source is not public.',
      ),
    },
    {
      q: h(lang, '自动更新一定要用你们的发布源吗？', 'Must we use UnionUser for updates?'),
      a: h(
        lang,
        '不必。可以继续用现有 OSS/CDN。若使用 UnionUser 发布源，则可以复用许可证门控下载、yank 与每产品签名。',
        'No. Keep your existing OSS/CDN if you prefer. Using the UnionUser feed adds license-gated downloads, yank and per-product signatures.',
      ),
    },
  ];
}

/* Features */

const FEATURE_SECTIONS = [
  {
    id: 'licensing',
    icon: 'key',
    zh: ['授权与激活', '订阅、买断、买断+维护期、试用与浮动授权，一套模型覆盖。'],
    en: ['Licensing & activation', 'Subscriptions, perpetual, perpetual + maintenance, trials and floating licenses in one model.'],
    pointsZh: [
      '激活、校验、停用、暂停、恢复、吊销，全生命周期有审计',
      '每设备或每用户名额；数据库层原子并发，重试安全',
      '宽限期、离线续验间隔与授权到期时间相互独立',
      '支持 Idempotency-Key，网络抖动不会重复占用设备位',
    ],
    pointsEn: [
      'Activate, verify, deactivate, suspend, reinstate and revoke — all audited',
      'Per-device or per-user slots, atomically enforced at the database layer',
      'Grace period, check-in interval and license expiry are separate knobs',
      'Idempotency-Key support so retries never consume a second slot',
    ],
    mock: 'licenseTable',
  },
  {
    id: 'offline',
    icon: 'shield',
    zh: ['Ed25519 离线验签', '私钥不出服务器，客户端内置公钥即可本地验证。'],
    en: ['Offline Ed25519 verification', 'The private key never leaves the server; the client pins a public key and verifies locally.'],
    pointsZh: [
      'token 内含设备指纹、套餐、权益与到期时间，篡改即失效',
      'exp 是联网续验间隔，vun 是授权到期；两者分离，避免误伤',
      '断网、内网、隔离环境仍可启动与解锁功能',
      '权益以 ftr 字段下发的，客户端按字段判断能力',
    ],
    pointsEn: [
      'The token carries device binding, plan, entitlements and expiry; tampering breaks it',
      'exp is the check-in interval, vun is license expiry — two different clocks',
      'Works offline, on private networks and in air-gapped environments',
      'Entitlements ride in the ftr field and the client reads them directly',
    ],
    mock: 'verifyCode',
  },
  {
    id: 'trials',
    icon: 'spark',
    zh: ['试用与自助领证', '邮箱验证码注册，立即拿到试用授权，不需要人工介入。'],
    en: ['Trials & self-signup', 'Email-OTP signup issues a trial immediately — no manual step.'],
    pointsZh: [
      '免费套餐可开 self-signup，按 checkout_id 生成领证页',
      '每邮箱每产品一份；每日领取上限可配置',
      '已有可用付费授权的地址直接登录，不会重复发试用',
      '试用到期自动回落到免费套餐，数据与授权保留',
    ],
    pointsEn: [
      'Enable self-signup on a free plan; each plan gets a hosted claim page',
      'One trial per email per product, with a configurable daily cap',
      'An address with a usable paid license signs in without minting another trial',
      'When the trial lapses it falls back to the free plan; data and keys stay',
    ],
    mock: 'signupFlow',
  },
  {
    id: 'payments',
    icon: 'card',
    zh: ['支付与订阅', '把「收款」和「发证」接在一起，而不是两张皮。'],
    en: ['Payments & subscriptions', 'Collect money and issue the license in the same flow.'],
    pointsZh: [
      'Stripe Checkout 支持订阅、买断、试用与一次性付款',
      'webhook + 成功页 + 定时对账三层保障，漏单可追回',
      '升降级按比例计费，退款自动回滚授权状态',
      '客户自助账单门户、发票与到期提醒',
    ],
    pointsEn: [
      'Stripe Checkout for subscriptions, perpetual, trials and one-off payments',
      'Webhook + success page + scheduled reconciliation recover missed events',
      'Prorated upgrades and downgrades; refunds roll back license state',
      'Self-serve billing portal, invoices and expiry reminders',
    ],
    mock: 'billing',
  },
  {
    id: 'seats',
    icon: 'users',
    zh: ['席位与权益', '所有者与成员各有密钥，席位超限会自动暂停而不是报错。'],
    en: ['Seats & entitlements', 'Owners and members get their own keys; over-limit seats pause instead of failing loudly.'],
    pointsZh: [
      '所有者 + 成员独立密钥，成员只能管理自己的设备',
      '席位收缩时最后加入的成员暂停，释放席位立即恢复',
      '布尔、数值与配额三类权益，支持付费附加包',
      '团队邀请、移除成员与设备归属清晰可审计',
    ],
    pointsEn: [
      'Owner and member keys are independent; members manage only their own devices',
      'When seats shrink, last-joined members pause and resume as soon as a seat frees',
      'Boolean, numeric and quota entitlements, plus paid add-ons',
      'Invites, removals and device ownership are explicit and audited',
    ],
    mock: 'seats',
  },
  {
    id: 'updates',
    icon: 'cloud',
    zh: ['自动更新分发', '授权与更新共用一个发布源，过期、吊销、维护期都能生效。'],
    en: ['Update distribution', 'Licensing and releases share one feed, so expiry, revocation and maintenance periods apply.'],
    pointsZh: [
      'Sparkle、Velopack、Tauri 使用同一份发布源',
      '原子发布与 yank 回滚；每个产物单独 Ed25519 签名',
      'S3 兼容对象存储，支持许可证门控下载',
      '维护期与最低支持版本控制谁该收到哪个版本',
    ],
    pointsEn: [
      'Sparkle, Velopack and Tauri consume the same release feed',
      'Atomic publishing and yank; every artifact is signed separately',
      'S3-compatible storage with license-gated downloads',
      'Maintenance periods and minimum versions control who gets what',
    ],
    mock: 'releases',
  },
  {
    id: 'usage',
    icon: 'chart',
    zh: ['用量与配额', '原子扣减，不会被并发请求透支。'],
    en: ['Usage & quotas', 'Atomic consumption that concurrent requests cannot overdraw.'],
    pointsZh: [
      '小时、日、月、年四种滚动周期',
      '配额扣减与授权校验同源，避免两套数据打架',
      '阈值 webhook 提前预警，而不是等超额才告警',
      '客户端可实时查询剩余额度',
    ],
    pointsEn: [
      'Hourly, daily, monthly and yearly windows',
      'Quota deduction shares the licensing source of truth',
      'Threshold webhooks warn before the limit, not after',
      'Clients can query remaining quota in real time',
    ],
    mock: 'usage',
  },
  {
    id: 'portal',
    icon: 'server',
    zh: ['后台与客户门户', '运营需要的界面与客户自助需要的界面，都开箱即用。'],
    en: ['Admin & customer portal', 'Both the operator console and the customer self-service portal ship ready.'],
    pointsZh: [
      '产品、套餐、授权、客户、API Key、Webhook、分析、审计与团队角色',
      '邮件模板与品牌定制，域名可换',
      '客户门户：设备解绑、席位管理、换套餐、发票与续费',
      '完整审计日志，谁在什么时候改了什么',
    ],
    pointsEn: [
      'Products, plans, licenses, customers, API keys, webhooks, analytics, audit and roles',
      'Email templates and branding, including custom domains',
      'Portal: release devices, manage seats, switch plans, invoices and renewal',
      'Full audit log of who changed what and when',
    ],
    mock: 'portal',
  },
];

function featureMock(kind, lang) {
  if (kind === 'licenseTable') {
    return `<div class="mock"><div class="mock-head"><span>${h(lang, '授权列表', 'Licenses')}</span><span>${h(lang, '3 个套餐', '3 plans')}</span></div><div class="mock-body">
      <div class="mock-row"><span class="mono">WB-8F2K-••••-M4Q9</span><span class="status-pill"><span class="dot"></span>${h(lang, '激活', 'Active')}</span></div>
      <div class="mock-row"><span class="mono">WB-2C7N-••••-T8R1</span><span class="status-pill"><span class="dot"></span>${h(lang, '试用', 'Trialing')}</span></div>
      <div class="mock-row"><span class="mono">WB-9Q4V-••••-K2L6</span><span class="status-pill warn"><span class="dot"></span>${h(lang, '已过期', 'Expired')}</span></div>
      <div class="mock-row"><span class="mono">WB-5H1D-••••-P7X3</span><span class="status-pill rose"><span class="dot"></span>${h(lang, '已吊销', 'Revoked')}</span></div>
    </div></div>`;
  }
  if (kind === 'verifyCode') {
    return `<div class="mock dark"><div class="mock-head"><span>offline-verify.ts</span><span>Ed25519</span></div><pre class="code-body"><span class="tok-key">const</span> payload = JSON.parse(
  Buffer.from(token.split(<span class="tok-str">'.'</span>)[<span class="tok-num">0</span>], <span class="tok-str">'base64url'</span>)
);
<span class="tok-key">assert</span>(payload.did === deviceId);
<span class="tok-key">assert</span>(payload.fpr === fingerprint);
<span class="tok-key">assert</span>(payload.exp &gt; Date.now() / <span class="tok-num">1000</span>);
<span class="tok-key">assert</span>(payload.ftr.publish !== <span class="tok-key">false</span>);</pre></div>`;
  }
  if (kind === 'signupFlow') {
    return `<div class="mock"><div class="mock-head"><span>/signup/••••</span><span class="status-pill"><span class="dot"></span>${h(lang, '31 天试用', '31-day trial')}</span></div><div class="mock-body">
      <div class="mock-row"><span>${h(lang, '邮箱验证码', 'Email OTP')}</span><span class="status-pill gray"><span class="dot"></span>${h(lang, '已发送', 'Sent')}</span></div>
      <div class="mock-row"><span>${h(lang, '创建账号', 'Create account')}</span><span class="status-pill"><span class="dot"></span>OK</span></div>
      <div class="mock-row"><span>${h(lang, '签发试用授权', 'Issue trial license')}</span><span class="status-pill"><span class="dot"></span>WB-2C7N</span></div>
      <div class="mock-row"><span>${h(lang, '发送邮件', 'Send email')}</span><span class="status-pill"><span class="dot"></span>${h(lang, '完成', 'Done')}</span></div>
    </div></div>`;
  }
  if (kind === 'billing') {
    return `<div class="mock"><div class="mock-head"><span>Stripe</span><span class="status-pill"><span class="dot"></span>paid</span></div><div class="mock-body">
      <div class="mock-row"><span>Pro · ${h(lang, '年付', 'Yearly')}</span><span>$290.00</span></div>
      <div class="mock-row"><span>${h(lang, '按比例升级', 'Prorated upgrade')}</span><span>+$12.40</span></div>
      <div class="mock-row"><span>${h(lang, '退款', 'Refund')}</span><span class="status-pill gray"><span class="dot"></span>${h(lang, '已回滚', 'Rolled back')}</span></div>
      <div class="mock-row"><span>webhook + ${h(lang, '对账', 'reconcile')}</span><span class="status-pill"><span class="dot"></span>3/3</span></div>
    </div></div>`;
  }
  if (kind === 'seats') {
    return `<div class="mock"><div class="mock-head"><span>${h(lang, '团队席位', 'Team seats')}</span><span>3 / 3</span></div><div class="mock-body">
      <div class="mock-row"><span>owner@studio.dev</span><span class="status-pill"><span class="dot"></span>${h(lang, '所有者', 'Owner')}</span></div>
      <div class="mock-row"><span>dev@studio.dev</span><span class="status-pill"><span class="dot"></span>${h(lang, '成员', 'Member')}</span></div>
      <div class="mock-row"><span>qa@studio.dev</span><span class="status-pill warn"><span class="dot"></span>${h(lang, '暂停', 'Paused')}</span></div>
      <div class="mock-row"><span class="mono">${h(lang, '释放席位后自动恢复', 'Auto-resume when a seat frees')}</span><span class="status-pill gray"><span class="dot"></span>wait</span></div>
    </div></div>`;
  }
  if (kind === 'releases') {
    return `<div class="mock"><div class="mock-head"><span>appcast.xml</span><span>v2.8.1</span></div><div class="mock-body">
      <div class="mock-row"><span>UnionUser-2.8.1.dmg</span><span class="status-pill"><span class="dot"></span>signed</span></div>
      <div class="mock-row"><span>UnionUser-2.8.0.exe</span><span class="status-pill gray"><span class="dot"></span>yanked</span></div>
      <div class="mock-row"><span>${h(lang, '维护期', 'Maintenance')}</span><span>2027-11-05</span></div>
      <div class="mock-row"><span>${h(lang, '许可证门控', 'License gate')}</span><span class="status-pill"><span class="dot"></span>on</span></div>
    </div></div>`;
  }
  if (kind === 'usage') {
    return `<div class="mock"><div class="mock-head"><span>${h(lang, '本月配额', 'Quota this month')}</span><span>8,420 / 10,000</span></div><div class="mock-body">
      <div style="height:10px;background:#eef1f7;border-radius:99px;overflow:hidden;margin:6px 0 14px"><div style="width:84%;height:100%;background:linear-gradient(90deg,#4f46e5,#34d399)"></div></div>
      <div class="mock-row"><span>${h(lang, '今日', 'Today')}</span><span>312</span></div>
      <div class="mock-row"><span>${h(lang, '阈值提醒', 'Threshold alert')}</span><span>80%</span></div>
      <div class="mock-row"><span>webhook</span><span class="status-pill"><span class="dot"></span>delivered</span></div>
    </div></div>`;
  }
  return `<div class="mock"><div class="mock-head"><span>${h(lang, '客户门户', 'Customer portal')}</span><span>portal</span></div><div class="mock-body">
    <div class="mock-row"><span>${h(lang, '我的授权', 'My licenses')}</span><span>3</span></div>
    <div class="mock-row"><span>${h(lang, '已激活设备', 'Active devices')}</span><span>2 / 3</span></div>
    <div class="mock-row"><span>${h(lang, '下一期账单', 'Next invoice')}</span><span>2026-12-05</span></div>
    <div class="mock-row"><span>${h(lang, '发票下载', 'Download invoice')}</span><span>PDF</span></div>
  </div></div>`;
}

export function renderFeatures(lang) {
  const title = h(lang, '功能 · UnionUser', 'Features · UnionUser');
  const description = h(
    lang,
    '授权激活、Ed25519 离线验签、试用自助领证、Stripe 支付、席位与权益、自动更新分发、用量配额、后台与客户门户。',
    'Activation, offline Ed25519 verification, trials, Stripe payments, seats and entitlements, update distribution, usage quotas, admin and customer portal.',
  );
  const body = `
  <section class="docs-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="${url(lang, '/')}">${h(lang, '首页', 'Home')}</a><span>/</span><span>${h(lang, '功能', 'Features')}</span></div>
      <h1>${h(lang, '一个平台，覆盖桌面授权的全链路', 'One platform across the desktop licensing lifecycle')}</h1>
      <p>${h(
        lang,
        '从第一份授权到自动更新，每个模块都对应真实 API 与后台界面。下面按能力分区说明边界与关键设计。',
        'From the first key to auto-updates, every module maps to a real API and screen. Here is what each part does and where its boundaries are.',
      )}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="grid grid-3" style="margin-bottom:54px">
        ${[
          ['bolt', 'licensing', h(lang, '8 个能力分区', '8 capability areas')],
          ['key', 'offline', h(lang, '5 种授权模型', '5 license models')],
          ['cloud', 'updates', h(lang, '3 个更新框架', '3 update frameworks')],
        ]
          .map(
            ([ic, anchor, label]) => `<a class="card" href="#${anchor}" style="text-decoration:none">
              <span class="icon-box">${icon(ic)}</span>
              <h3 style="margin-bottom:0">${label}</h3>
            </a>`,
          )
          .join('')}
      </div>
      ${FEATURE_SECTIONS.map((section, index) => {
        const zh = section.zh;
        const en = section.en;
        const copy = `<div class="split-copy">
          <div class="eyebrow">${icon(section.icon, 15)} ${h(lang, `0${index + 1}`, `0${index + 1}`)}</div>
          <h2>${h(lang, zh[0], en[0])}</h2>
          <p>${h(lang, zh[1], en[1])}</p>
          ${checklist(h(lang, section.pointsZh, section.pointsEn))}
          <div class="hero-actions" style="margin-bottom:0">
            ${button(docs(lang, '/docs/concepts/'), h(lang, '概念与 API', 'Concepts & API'), 'ghost', 'btn-sm')}
          </div>
        </div>`;
        const mock = featureMock(section.mock, lang);
        return `<section id="${section.id}" style="padding:38px 0;scroll-margin-top:86px">
          <div class="split${index % 2 === 1 ? ' reverse' : ''}">
            ${copy}
            <div>${mock}</div>
          </div>
        </section>`;
      }).join('')}
    </div>
  </section>
  <section class="section section-soft">
    <div class="container">
      ${ctaBand(lang, {
        title: h(lang, '想确认某个能力是否满足？', 'Need to check one of these for your app?'),
        sub: h(
          lang,
          '把场景发给我们，48 小时内给出接入建议与可行性判断。',
          'Send us your scenario and we will reply within 48 hours with an integration path.',
        ),
        primaryLabel: h(lang, '预约技术演示', 'Book a technical demo'),
        primaryHref: contact(lang, 'demo'),
        secondaryLabel: h(lang, '查看 API 参考', 'API reference'),
        secondaryHref: docs(lang, '/docs/api/'),
      })}
    </div>
  </section>`;
  return { title, description, body };
}

/* How it works */

export function renderHowItWorks(lang) {
  const title = h(lang, '使用指南 · UnionUser', 'How it works · UnionUser');
  const description = h(
    lang,
    '三条接入路径：首次激活、启动校验、自动更新。包含架构图、设备指纹最佳实践与错误处理表。',
    'Three integration paths: first activation, startup verification, auto-updates. Architecture, device fingerprinting and error handling.',
  );
  const body = `
  <section class="docs-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="${url(lang, '/')}">${h(lang, '首页', 'Home')}</a><span>/</span><span>${h(lang, '使用指南', 'How it works')}</span></div>
      <h1>${h(lang, '从安装包到授权生效，发生了什么', 'What happens between your installer and an active license')}</h1>
      <p>${h(
        lang,
        '客户端通过 HTTPS 调用公开授权 API；签名 token 缓存在本地，之后每次启动可离线验签。只有需要感知吊销或 token 过期时才联网。',
        'The client calls the public licensing API over HTTPS, caches the signed token, and verifies offline on each start. It only goes online when the token expires or it needs to see a revocation.',
      )}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="mock" style="padding:34px 28px">
        <div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:16px;align-items:center;text-align:center;font-size:0.86rem">
          <div><span class="icon-box" style="width:48px;height:48px;margin:0 auto 10px">${icon('devices')}</span><strong>${h(lang, '桌面客户端', 'Desktop app')}</strong><div style="color:var(--muted)">license_key + ${h(lang, '设备指纹', 'device id')}</div></div>
          <div style="color:var(--muted-2);font-family:var(--font-mono)">HTTPS →</div>
          <div><span class="icon-box" style="width:48px;height:48px;margin:0 auto 10px">${icon('shield')}</span><strong>UnionUser API</strong><div style="color:var(--muted)">${h(lang, '校验、激活、签发 token', 'verify, activate, sign token')}</div></div>
          <div style="color:var(--muted-2);font-family:var(--font-mono)">→</div>
          <div><span class="icon-box" style="width:48px;height:48px;margin:0 auto 10px">${icon('server')}</span><strong>PostgreSQL</strong><div style="color:var(--muted)">${h(lang, '授权、设备、审计', 'licenses, devices, audit')}</div></div>
        </div>
      </div>
      <p class="center" style="color:var(--muted);font-size:0.84rem;margin-top:14px">${h(
        lang,
        '可选：自托管时，中间件与数据库部署在你自己的环境。',
        'Optional: in self-hosted mode, both the service and the database run in your environment.',
      )}</p>
    </div>
  </section>
  <section class="section section-soft">
    <div class="container">
      ${sectionHead({
        eyebrow: h(lang, '三条路径', 'Three paths'),
        title: h(lang, '接入只需要想清楚三个动作', 'Three actions cover the whole integration'),
      })}
      <div class="grid grid-3">
        <article class="card">
          <span class="icon-box">${icon('key')}</span>
          <h3>${h(lang, '1. 首次激活', '1. First activation')}</h3>
          <p>${h(lang, '用户输入授权码，客户端上报设备指纹，服务端原子占用名额并返回签名 token。', 'The user enters a key, the client reports a device id, and the server claims a slot atomically and returns a signed token.')}</p>
          <code style="font-size:0.78rem;color:var(--indigo)">POST /api/v1/license/activate</code>
        </article>
        <article class="card">
          <span class="icon-box mint">${icon('shield')}</span>
          <h3>${h(lang, '2. 启动校验', '2. Startup verification')}</h3>
          <p>${h(lang, '每次启动先离线验签；token 临近过期或需要感知吊销时，再调用 verify 续验。', 'Verify offline on every start. Call verify when the token nears expiry or you need to observe a revocation.')}</p>
          <code style="font-size:0.78rem;color:var(--indigo)">POST /api/v1/license/verify</code>
        </article>
        <article class="card">
          <span class="icon-box">${icon('cloud')}</span>
          <h3>${h(lang, '3. 自动更新', '3. Auto-update')}</h3>
          <p>${h(lang, '把更新框架的 feed 指向发布源；需要门控时附带 license_key，产物本身另有签名。', 'Point the updater at the release feed. Add the license key when the feed is gated; artifacts are signed independently.')}</p>
          <code style="font-size:0.78rem;color:var(--indigo)">GET /releases/{product_slug}/*</code>
        </article>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="split">
        <div class="split-copy">
          <div class="eyebrow">${h(lang, '设备指纹', 'Device fingerprint')}</div>
          <h2>${h(lang, '稳定、不可逆、不侵犯隐私', 'Stable, irreversible and privacy-safe')}</h2>
          <p>${h(
            lang,
            '设备指纹只用于区分设备，不用于识别个人。建议读取系统原生机器标识，哈希后上报，并在隐私政策中说明。',
            'A device id distinguishes machines, not people. Read the native machine identifier, hash it before upload, and disclose it in your privacy policy.',
          )}</p>
          ${checklist([
            h(lang, 'Windows：注册表 MachineGuid（HKLM\\SOFTWARE\\Microsoft\\Cryptography）', 'Windows: MachineGuid in HKLM\\SOFTWARE\\Microsoft\\Cryptography'),
            h(lang, 'macOS：ioreg 的 IOPlatformUUID', 'macOS: IOPlatformUUID from ioreg'),
            h(lang, 'Linux：/etc/machine-id', 'Linux: /etc/machine-id'),
            h(lang, '统一哈希：sha256("app:" + raw).slice(0, 32)，避免泄露原值', 'Hash before upload: sha256("app:" + raw).slice(0, 32)'),
          ])}
        </div>
        <div class="mock dark">
          <div class="mock-head"><span>fingerprint.js</span><span>${h(lang, '示例', 'example')}</span></div>
          <pre class="code-body"><span class="tok-key">import</span> { createHash } <span class="tok-key">from</span> <span class="tok-str">'node:crypto'</span>;
<span class="tok-key">import</span> { execSync } <span class="tok-key">from</span> <span class="tok-str">'node:child_process'</span>;

<span class="tok-key">const</span> raw = process.platform === <span class="tok-str">'win32'</span>
  ? execSync(<span class="tok-str">'reg query "HKLM\\\\SOFTWARE\\\\Microsoft\\\\Cryptography" /v MachineGuid'</span>).toString()
  : execSync(<span class="tok-str">'cat /etc/machine-id'</span>).toString();

<span class="tok-key">const</span> deviceId = <span class="tok-str">'wm-'</span> + createHash(<span class="tok-str">'sha256'</span>)
  .update(<span class="tok-str">'app:'</span> + raw.trim()).digest(<span class="tok-str">'hex'</span>).slice(<span class="tok-num">0</span>, <span class="tok-num">32</span>);</pre>
        </div>
      </div>
    </div>
  </section>
  <section class="section section-soft">
    <div class="container">
      ${sectionHead({
        eyebrow: h(lang, '错误处理', 'Error handling'),
        title: h(lang, '把错误码映射成用户能懂的动作', 'Map error codes to actions users understand'),
      })}
      <div class="table-wrap">
        <table class="compare">
          <thead><tr><th>Code</th><th>${h(lang, '含义', 'Meaning')}</th><th>${h(lang, '建议动作', 'Suggested action')}</th></tr></thead>
          <tbody>
            ${[
              ['ACTIVATION_LIMIT', h(lang, '设备名额已满', 'No device slot left'), h(lang, '引导客户在门户解绑旧设备', 'Send the customer to the portal to release a device')],
              ['LICENSE_EXPIRED', h(lang, '授权已到期', 'License expired'), h(lang, '展示续费入口，保留只读功能', 'Show renewal; keep read-only features available')],
              ['LICENSE_SUSPENDED', h(lang, '授权被暂停', 'License suspended'), h(lang, '提示联系管理员，不自动重试', 'Ask the customer to contact the owner')],
              ['LICENSE_REVOKED', h(lang, '授权被吊销', 'License revoked'), h(lang, '停止解锁付费功能', 'Lock paid features')],
              ['DEVICE_HELD', h(lang, '设备被占用/锁定', 'Device held'), h(lang, '提供解绑或稍后重试', 'Offer release or retry later')],
              ['SEAT_PAUSED', h(lang, '席位暂停', 'Seat paused'), h(lang, '提示扩容或移除成员', 'Suggest buying a seat or removing a member')],
              ['RATE_LIMITED', h(lang, '请求过于频繁', 'Rate limited'), h(lang, '指数退避重试', 'Retry with exponential backoff')],
            ]
              .map(
                ([code, meaning, action]) =>
                  `<tr><td><code>${code}</code></td><td>${meaning}</td><td>${action}</td></tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="callout" style="margin-top:22px"><strong>${h(lang, '什么时候需要联网？', 'When does it need the network?')}</strong> ${h(
        lang,
        'token 的 exp 到期、权益发生变更、需要感知吊销、或新增设备时。其余时间，离线验签即可。',
        'When the token’s exp passes, entitlements change, a revocation must be observed, or a new device activates. The rest of the time, offline verification is enough.',
      )}</div>
      <div class="hero-actions">
        ${button(docs(lang, '/docs/quickstart/'), h(lang, '开始接入', 'Start integrating'), 'primary')}
        ${button(docs(lang, '/docs/guides/javascript/'), h(lang, '看完整示例', 'See full examples'), 'ghost')}
      </div>
    </div>
  </section>`;
  return { title, description, body };
}

/* Pricing */

function planFeatureList(plan, lang) {
  const lists = {
    developer: [
      h(lang, '1 个产品', '1 product'),
      h(lang, '100 份活跃授权', '100 active licenses'),
      h(lang, '客户门户与设备解绑', 'Customer portal & device release'),
      h(lang, 'Ed25519 离线验签', 'Offline Ed25519 verification'),
      h(lang, '社区支持', 'Community support'),
    ],
    pro: [
      h(lang, '3 个产品 · 1,000 份活跃授权', '3 products · 1,000 active licenses'),
      h(lang, 'Stripe 支付与自助试用', 'Stripe payments & self-signup trials'),
      h(lang, 'Sparkle / Velopack / Tauri 发布源', 'Sparkle / Velopack / Tauri feeds'),
      h(lang, 'Webhook 与用量配额', 'Webhooks & usage quotas'),
      h(lang, '邮件支持', 'Email support'),
    ],
    business: [
      h(lang, '10 个产品 · 10,000 份活跃授权', '10 products · 10,000 active licenses'),
      h(lang, '席位与成员管理', 'Seats & member management'),
      h(lang, 'SSO（Casdoor）', 'SSO (Casdoor)'),
      h(lang, '审计导出与品牌定制', 'Audit export & branding'),
      h(lang, '优先支持 · 99.9% SLA', 'Priority support · 99.9% SLA'),
    ],
    enterprise: [
      h(lang, '不限产品与活跃授权（公平使用）', 'Unlimited products and licenses (fair use)'),
      h(lang, '独立工作区或自托管商业授权', 'Dedicated workspace or self-hosted license'),
      h(lang, '白标（需 Keygate 商业授权）', 'White-label (requires Keygate commercial license)'),
      h(lang, '迁移、接入与运维支持', 'Migration, onboarding and operations support'),
      h(lang, '年度合同与安全评审', 'Annual contract & security review'),
    ],
  };
  return lists[plan];
}

export function renderPricing(lang) {
  const title = h(lang, '定价 · UnionUser', 'Pricing · UnionUser');
  const description = h(
    lang,
    '按活跃授权计费。Developer 免费，Pro $29/月起并提供 31 天试用，Business $99/月起，Enterprise 与自托管 $399/月起。',
    'Billed on active licenses. Developer is free, Pro starts at $29/mo with a 31-day trial, Business at $99/mo, Enterprise and self-hosted from $399/mo.',
  );
  const planDescriptions = {
    developer: h(lang, '个人项目、原型与开源工具', 'Personal projects, prototypes and open-source tools'),
    pro: h(lang, '独立开发者与小团队上线销售', 'Indie developers and small teams shipping paid apps'),
    business: h(lang, '多产品、多成员与合规要求', 'Multiple products, teams and compliance needs'),
    enterprise: h(lang, '大客户、私有化与白标', 'Large customers, private deployment and white-label'),
  };
  const ctaLabel = (plan) =>
    plan.cta === 'trial'
      ? h(lang, '开始 31 天试用', 'Start 31-day trial')
      : plan.cta === 'demo'
        ? h(lang, '联系销售', 'Contact sales')
        : h(lang, '免费开始', 'Start free');

  const body = `
  <section class="docs-hero center" style="text-align:center">
    <div class="container">
      <div class="eyebrow" style="margin-bottom:14px">${h(lang, '定价', 'Pricing')}</div>
      <h1>${h(lang, '按真实使用量付费，不按想象力付费', 'Pay for real usage, not imagined scale')}</h1>
      <p style="margin:0 auto">${h(
        lang,
        '以活跃授权计费：过去 30 天内有激活或校验记录的授权。超出上限不中断服务，按增量计费。',
        'Billed on active licenses: keys with an activation or verification in the last 30 days. Exceeding the cap does not stop service; overage is metered.',
      )}</p>
      <div class="billing-toggle" data-billing>
        <button type="button" class="active" data-period="monthly">${h(lang, '月付', 'Monthly')}</button>
        <button type="button" data-period="yearly">${h(lang, '年付', 'Yearly')} <span class="save">-17%</span></button>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="pricing-grid">
        ${PLANS.map((plan) => {
          const monthly = plan.priceMonthly === 0 ? '$0' : `$${plan.priceMonthly}`;
          const yearly = plan.priceYearly === 0 ? '$0' : `$${Math.round(plan.priceYearly / 12)}`;
          const billedMonthly = plan.priceMonthly === 0
            ? h(lang, '永久免费', 'Free forever')
            : h(lang, `按月计费 · 可随时取消`, 'Billed monthly · cancel anytime');
          const billedYearly = plan.priceYearly === 0
            ? h(lang, '永久免费', 'Free forever')
            : h(lang, `年付 $${plan.priceYearly} · 约 8.3 折`, `$${plan.priceYearly}/yr · two months free`);
          return `<article class="plan${plan.recommended ? ' recommended' : ''}">
            ${plan.recommended ? `<span class="plan-badge">${h(lang, '推荐', 'Popular')}</span>` : ''}
            <h3>${plan.name}</h3>
            <p class="plan-desc">${planDescriptions[plan.id]}</p>
            <div class="plan-price">
              <span class="amount" data-price-monthly="${monthly}" data-price-yearly="${yearly}">${monthly}</span>
              <span class="period">${h(lang, '/月', '/mo')}</span>
            </div>
            <div class="billed" data-billed data-billed-monthly="${billedMonthly}" data-billed-yearly="${billedYearly}">${billedMonthly}</div>
            <div class="plan-cta">${button(contact(lang, plan.id), ctaLabel(plan), plan.recommended ? 'primary' : 'ghost')}</div>
            <ul>${planFeatureList(plan.id, lang)
              .map((item) => `<li>${icon('check', 16)}<span>${item}</span></li>`)
              .join('')}</ul>
          </article>`;
        }).join('')}
      </div>
      <p class="pricing-note">${h(
        lang,
        '价格为美元，由 Stripe 收款。超额按 $10 / 每 1,000 活跃授权 / 月计。年付 14 天内可无理由退款。',
        'Prices in USD, collected by Stripe. Overage is $10 per additional 1,000 active licenses per month. Annual plans are refundable within 14 days.',
      )}</p>
    </div>
  </section>
  <section class="section section-soft">
    <div class="container">
      ${sectionHead({
        eyebrow: h(lang, '细节', 'Details'),
        title: h(lang, '各档能力对比', 'What each plan includes'),
        center: true,
      })}
      <div class="table-wrap">
        <table class="compare">
          <thead><tr><th>${h(lang, '能力', 'Capability')}</th><th>Developer</th><th>Pro</th><th>Business</th><th>Enterprise</th></tr></thead>
          <tbody>
            ${[
              [h(lang, '产品数', 'Products'), '1', '3', '10', h(lang, '不限', 'Unlimited')],
              [h(lang, '活跃授权', 'Active licenses'), '100', '1,000', '10,000', h(lang, '不限', 'Unlimited')],
              [h(lang, '离线验签', 'Offline verification'), '✓', '✓', '✓', '✓'],
              [h(lang, '客户门户', 'Customer portal'), '✓', '✓', '✓', '✓'],
              [h(lang, 'Stripe 支付', 'Stripe payments'), '—', '✓', '✓', '✓'],
              [h(lang, '自助试用/领证', 'Self-signup trials'), '—', '✓', '✓', '✓'],
              [h(lang, '自动更新发布源', 'Update feeds'), '—', '✓', '✓', '✓'],
              [h(lang, 'Webhook / 配额', 'Webhooks / quotas'), '—', '✓', '✓', '✓'],
              [h(lang, '席位与成员', 'Seats & members'), '—', '—', '✓', '✓'],
              [h(lang, 'SSO', 'SSO'), '—', '—', '✓', '✓'],
              [h(lang, '审计导出', 'Audit export'), '—', '—', '✓', '✓'],
              [h(lang, '自托管', 'Self-hosted'), '—', '—', '—', '✓'],
            ]
              .map(
                (row) =>
                  `<tr>${row
                    .map((cell, i) =>
                      i === 0
                        ? `<td>${cell}</td>`
                        : `<td class="${cell === '✓' ? 'yes' : cell === '—' ? 'no' : ''}">${cell}</td>`,
                    )
                    .join('')}</tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <p class="pricing-note">${h(
        lang,
        '自托管商业授权按年报价，含升级与支持；白标需同时取得 Keygate 商业授权。',
        'Self-hosted licenses are quoted annually with upgrades and support. White-label also requires a Keygate commercial license.',
      )}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'FAQ',
        title: h(lang, '关于定价与计费', 'Pricing and billing'),
        center: true,
      })}
      ${faqList(pricingFaq(lang))}
    </div>
  </section>
  <section class="section section-soft">
    <div class="container">
      ${ctaBand(lang, {
        title: h(lang, '先跑 31 天，再决定', 'Run it for 31 days, then decide'),
        sub: h(
          lang,
          'Pro 全功能试用，无需信用卡。到期自动回落免费档，授权与数据保留。',
          'The full Pro feature set, no credit card. When the trial ends it falls back to Developer and keeps your data.',
        ),
        primaryLabel: h(lang, '开始试用', 'Start the trial'),
        primaryHref: contact(lang, 'trial'),
        secondaryLabel: h(lang, '联系销售', 'Talk to sales'),
        secondaryHref: contact(lang, 'enterprise'),
      })}
    </div>
  </section>`;
  return { title, description, body };
}

function pricingFaq(lang) {
  return [
    {
      q: h(lang, '「活跃授权」怎么算？', 'How is an active license counted?'),
      a: h(
        lang,
        '过去 30 天内有激活、校验或续期记录的授权。长期未使用的授权不计费，也不会删除。',
        'A license with an activation, verification or renewal in the last 30 days. Dormant licenses are not billed and are not deleted.',
      ),
    },
    {
      q: h(lang, '试用需要信用卡吗？', 'Does the trial need a credit card?'),
      a: h(lang, '不需要。31 天内可使用 Pro 的全部能力。', 'No. The 31-day trial includes the full Pro feature set.'),
    },
    {
      q: h(lang, '超出套餐上限会怎样？', 'What happens when we exceed the plan?'),
      a: h(
        lang,
        '服务不中断。超出部分按 $10 / 每 1,000 活跃授权 / 月计，并在后台提前提醒。',
        'Service continues. Overage is metered at $10 per 1,000 active licenses per month, with in-app warnings first.',
      ),
    },
    {
      q: h(lang, '可以开发票吗？', 'Can we get invoices?'),
      a: h(
        lang,
        '可以。Stripe 账单门户提供发票与收据；企业年付合同可提供对公付款与合同发票。',
        'Yes. The Stripe billing portal provides invoices and receipts; annual enterprise contracts can use bank transfer and contract invoicing.',
      ),
    },
    {
      q: h(lang, '能从自研系统迁移吗？', 'Can we migrate from an in-house system?'),
      a: h(
        lang,
        '可以。支持批量导入授权与客户，保留原授权码或重新签发；Business 及以上提供迁移协助。',
        'Yes. Licenses and customers can be imported in bulk, keeping existing keys or reissuing them. Business and above include migration help.',
      ),
    },
    {
      q: h(lang, '自托管怎么收费？', 'How is self-hosting priced?'),
      a: h(
        lang,
        '按年报价，含升级与支持。不含 Stripe 托管收款；授权签名与门户在客户自己的实例中运行。',
        'Quoted annually with upgrades and support. Stripe-managed collections are not included; signing and the portal run in your own instance.',
      ),
    },
  ];
}

/* Compare */

export function renderCompare(lang) {
  const title = h(lang, '方案对比 · UnionUser', 'Compare · UnionUser');
  const description = h(
    lang,
    'UnionUser 与 Keygen、Cryptlex、LicenseSpring 及自研授权系统的对比：桌面优先、离线验签、支付、更新分发、自托管与中文支持。',
    'UnionUser vs Keygen, Cryptlex, LicenseSpring and in-house licensing: desktop-first clients, offline verification, payments, update feeds, self-hosting and Chinese support.',
  );
  const rows = [
    [h(lang, '客户端凭证', 'Client credential'), h(lang, '授权码（无 API Key）', 'License key only'), h(lang, '授权码 / 公钥', 'Key / public key'), h(lang, '授权码', 'License key'), h(lang, '授权码', 'License key'), h(lang, '自建', 'Custom')],
    [h(lang, '离线 Ed25519 验签', 'Offline Ed25519'), '✓', '✓', '✓', '✓', h(lang, '需自建', 'Build it')],
    [h(lang, '订阅 / 买断 / 试用', 'Subscription / perpetual / trial'), '✓', '✓', '✓', '✓', h(lang, '需自建', 'Build it')],
    [h(lang, 'Stripe 内建', 'Stripe built in'), '✓', h(lang, '部分', 'Partial'), h(lang, '部分', 'Partial'), '✓', h(lang, '需自建', 'Build it')],
    [h(lang, '自助试用/领证', 'Self-signup trials'), '✓', h(lang, '部分', 'Partial'), h(lang, '部分', 'Partial'), h(lang, '部分', 'Partial'), h(lang, '需自建', 'Build it')],
    [h(lang, '自动更新发布源', 'Update feeds'), h(lang, 'Sparkle / Velopack / Tauri', 'Sparkle / Velopack / Tauri'), h(lang, '有限', 'Limited'), h(lang, '有限', 'Limited'), h(lang, '有限', 'Limited'), h(lang, '需自建', 'Build it')],
    [h(lang, '客户自助门户', 'Customer portal'), '✓', '✓', '✓', '✓', h(lang, '需自建', 'Build it')],
    [h(lang, '用量配额', 'Usage quotas'), '✓', h(lang, '部分', 'Partial'), '✓', '✓', h(lang, '需自建', 'Build it')],
    [h(lang, '自托管', 'Self-hosted'), h(lang, '商业授权', 'Commercial license'), h(lang, '企业版', 'Enterprise'), h(lang, '部分', 'Partial'), h(lang, '企业版', 'Enterprise'), '✓'],
    [h(lang, '中文界面与支持', 'Chinese UI & support'), '✓', h(lang, '有限', 'Limited'), h(lang, '有限', 'Limited'), h(lang, '有限', 'Limited'), h(lang, '取决于团队', 'Team-dependent')],
    [h(lang, '起步成本', 'Entry cost'), h(lang, '免费档可用', 'Free tier'), h(lang, '按授权计费', 'Usage-based'), h(lang, '按授权计费', 'Usage-based'), h(lang, '按授权计费', 'Usage-based'), h(lang, '人力成本', 'Engineering time')],
  ];
  const yes = (v) => (v === '✓' ? `<span class="yes">✓</span>` : v === '—' ? `<span class="no">—</span>` : v);
  const body = `
  <section class="docs-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="${url(lang, '/')}">${h(lang, '首页', 'Home')}</a><span>/</span><span>${h(lang, '对比', 'Compare')}</span></div>
      <h1>${h(lang, '为什么为桌面软件做一个专门的授权平台', 'Why a licensing platform built for desktop software')}</h1>
      <p>${h(
        lang,
        '老牌授权平台多从服务端或企业软件出发，桌面客户端与支付、更新往往要另外拼。UnionUser 把这几件事放在同一个模型里。',
        'Legacy licensing platforms grew from server or enterprise software; desktop clients, payments and updates often need separate glue. UnionUser puts them in one model.',
      )}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="table-wrap">
        <table class="compare">
          <thead><tr>
            <th>${h(lang, '维度', 'Dimension')}</th><th>UnionUser</th><th>Keygen</th><th>Cryptlex</th><th>LicenseSpring</th><th>${h(lang, '自研', 'In-house')}</th>
          </tr></thead>
          <tbody>${rows
            .map(
              (row) =>
                `<tr>${row
                  .map((cell, i) => (i === 0 ? `<td>${cell}</td>` : `<td>${yes(cell)}</td>`))
                  .join('')}</tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>
      <p class="pricing-note">${h(
        lang,
        '对比基于各产品公开资料（2026-11），仅作方向性参考；具体能力、价格与合规条款以各家官网为准。',
        'Based on public information as of Nov 2026. For directional comparison only — confirm features, pricing and terms with each vendor.',
      )}</p>
    </div>
  </section>
  <section class="section section-soft">
    <div class="container">
      ${sectionHead({
        eyebrow: h(lang, '选择建议', 'Choosing'),
        title: h(lang, '什么情况下选 UnionUser', 'When UnionUser is the right fit'),
        center: true,
      })}
      <div class="grid grid-3">
        <article class="card"><span class="icon-box">${icon('devices')}</span><h3>${h(lang, '桌面应用为主', 'Desktop-first product')}</h3><p>${h(lang, '安装包、离线环境、自动更新与设备名额是核心诉求。', 'Installers, offline environments, auto-updates and device slots are the core problems.')}</p></article>
        <article class="card"><span class="icon-box mint">${icon('card')}</span><h3>${h(lang, '想直接卖软件', 'You want to sell the app')}</h3><p>${h(lang, '需要订阅、买断、试用、退款与发票，而不是自己接支付。', 'You need subscriptions, perpetual sales, trials, refunds and invoices without building payments.')}</p></article>
        <article class="card"><span class="icon-box">${icon('globe')}</span><h3>${h(lang, '中文团队 / 出海', 'Chinese team going global')}</h3><p>${h(lang, '中英文界面、Stripe 收款与本地化支持可以同时满足。', 'Bilingual UI, Stripe collections and local-language support in one vendor.')}</p></article>
      </div>
      <div class="hero-actions" style="justify-content:center;margin-top:34px">
        ${button(contact(lang, 'demo'), h(lang, '聊聊你的场景', 'Discuss your scenario'), 'primary')}
        ${button(url(lang, '/pricing/'), h(lang, '查看定价', 'See pricing'), 'ghost')}
      </div>
    </div>
  </section>`;
  return { title, description, body };
}

/* FAQ */

export function renderFaq(lang) {
  const title = h(lang, '常见问题 · UnionUser', 'FAQ · UnionUser');
  const description = h(
    lang,
    '关于 UnionUser 授权管理平台的高频问题：离线校验、设备名额、Stripe 支付、自托管、迁移与数据安全。',
    'Frequently asked questions about UnionUser: offline verification, device limits, Stripe, self-hosting, migration and data security.',
  );
  const groups = [
    {
      title: h(lang, '产品与接入', 'Product & integration'),
      items: homeFaq(lang).concat([
        {
          q: h(lang, '支持哪些桌面技术栈？', 'Which desktop stacks are supported?'),
          a: h(
            lang,
            '任何能发 HTTPS 请求并做 Ed25519 验签的语言都可以。首批官方示例覆盖 Java、JavaScript、Python、Rust 与 PHP。',
            'Any language that can make HTTPS requests and verify Ed25519 signatures. The first official examples cover Java, JavaScript, Python, Rust and PHP.',
          ),
        },
        {
          q: h(lang, '需要改我的数据库结构吗？', 'Do I need to change my database?'),
          a: h(
            lang,
            '不需要。授权状态由 UnionUser 托管；客户端本地只需保存授权码与签名 token，可按你的设置存储。',
            'No. License state lives in UnionUser; the client only stores the key and signed token wherever your app already stores settings.',
          ),
        },
      ]),
    },
    {
      title: h(lang, '计费与合同', 'Billing & contracts'),
      items: pricingFaq(lang),
    },
    {
      title: h(lang, '安全与合规', 'Security & compliance'),
      items: [
        {
          q: h(lang, '授权 token 被复制怎么办？', 'What if a license token is copied?'),
          a: h(
            lang,
            'token 绑定设备指纹，换机后原 token 校验失败；设备名额与在线校验共同限制滥用。离线模式不是强 DRM，定位是商业门槛与运营工具。',
            'The token is bound to a device id, so it fails on another machine. Device slots plus online checks limit abuse. Offline mode is a commercial gate and operations tool, not strong DRM.',
          ),
        },
        {
          q: h(lang, '数据存在哪里？', 'Where is data stored?'),
          a: h(
            lang,
            '托管版存储在 UnionUser 的 PostgreSQL 与对象存储中；自托管版完全在客户自己的环境。支持导出。',
            'Managed plans store data in UnionUser’s PostgreSQL and object storage; self-hosted runs entirely in your environment. Export is supported.',
          ),
        },
        {
          q: h(lang, '可以白标吗？', 'Can we white-label it?'),
          a: h(
            lang,
            'Enterprise 档支持品牌定制；完全白标或闭源转售需要同时取得 Keygate 上游商业授权。',
            'Enterprise supports branding. Full white-label or closed-source resale also requires a commercial license from Keygate upstream.',
          ),
        },
        {
          q: h(lang, '有审计日志吗？', 'Is there an audit log?'),
          a: h(
            lang,
            '有。授权、设备、支付、后台操作都有审计记录；Business 及以上支持导出。',
            'Yes. License, device, payment and admin actions are audited; Business and above can export.',
          ),
        },
      ],
    },
  ];
  const body = `
  <section class="docs-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="${url(lang, '/')}">${h(lang, '首页', 'Home')}</a><span>/</span><span>FAQ</span></div>
      <h1>${h(lang, '常见问题', 'Frequently asked questions')}</h1>
      <p>${h(lang, '没有找到答案？发邮件到 ', 'Did not find an answer? Email ')}<a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a>。</p>
    </div>
  </section>
  <section class="section">
    <div class="container" style="max-width:900px">
      ${groups
        .map(
          (group) => `<h2 style="font-size:1.3rem;margin:38px 0 8px">${group.title}</h2>${faqList(
            group.items,
          )}`,
        )
        .join('')}
      <div class="hero-actions" style="margin-top:40px">
        ${button(contact(lang, 'demo'), h(lang, '预约演示', 'Book a demo'), 'primary')}
        ${button(docs(lang, '/docs/quickstart/'), h(lang, '查看文档', 'Read the docs'), 'ghost')}
      </div>
    </div>
  </section>`;
  return { title, description, body };
}

/* Contact */

export function renderContact(lang) {
  const title = h(lang, '联系我们 · UnionUser', 'Contact · UnionUser');
  const description = h(
    lang,
    '预约演示、咨询定价、申请 31 天试用或讨论自托管方案。',
    'Book a demo, ask about pricing, request a 31-day trial or discuss self-hosting.',
  );
  const plans = [
    ['trial', h(lang, '31 天免费试用（Pro）', '31-day free trial (Pro)')],
    ['developer', 'Developer'],
    ['pro', 'Pro'],
    ['business', 'Business'],
    ['enterprise', h(lang, 'Enterprise / 自托管', 'Enterprise / Self-hosted')],
    ['other', h(lang, '其他', 'Other')],
  ];
  const body = `
  <section class="docs-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="${url(lang, '/')}">${h(lang, '首页', 'Home')}</a><span>/</span><span>${h(lang, '联系我们', 'Contact')}</span></div>
      <h1>${h(lang, '聊聊你的桌面软件授权', 'Talk to us about your desktop licensing')}</h1>
      <p>${h(
        lang,
        '告诉我们技术栈、授权模型与上线时间，我们会给出接入路径与报价。通常 1 个工作日内回复。',
        'Tell us your stack, licensing model and timeline. We will reply with an integration path and pricing, usually within one business day.',
      )}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="contact-grid">
        <div class="contact-aside">
          <h2 style="font-size:1.6rem">${h(lang, '你可以直接写信', 'Or simply email us')}</h2>
          <p><a href="mailto:${SALES_EMAIL}" style="font-size:1.05rem"><strong>${SALES_EMAIL}</strong></a></p>
          <p>${h(
            lang,
            '邮件中请附上：产品类型、预计授权数量、是否需要离线校验、是否需要自托管。',
            'Include: product type, expected license volume, whether you need offline checks, and whether you need self-hosting.',
          )}</p>
          <ul class="contact-points">
            <li><span class="icon-box">${icon('clock')}</span><div><strong>${h(lang, '1 个工作日内回复', 'Reply within one business day')}</strong><br><span style="color:var(--muted);font-size:0.88rem">${h(lang, '工作日 10:00–19:00 (UTC+8)', 'Weekdays 10:00–19:00 UTC+8')}</span></div></li>
            <li><span class="icon-box mint">${icon('code')}</span><div><strong>${h(lang, '技术对接', 'Technical onboarding')}</strong><br><span style="color:var(--muted);font-size:0.88rem">${h(lang, '可安排工程师参加接入会议', 'Engineers can join the integration call')}</span></div></li>
            <li><span class="icon-box">${icon('server')}</span><div><strong>${h(lang, '自托管评估', 'Self-hosting review')}</strong><br><span style="color:var(--muted);font-size:0.88rem">${h(lang, '合规、数据驻留与部署方式', 'Compliance, data residency and deployment')}</span></div></li>
          </ul>
        </div>
        <form class="form-card" data-contact-form data-mailto="${SALES_EMAIL}">
          <div class="field">
            <label for="name">${h(lang, '称呼', 'Name')}</label>
            <input id="name" name="name" autocomplete="name" required />
          </div>
          <div class="field">
            <label for="email">${h(lang, '工作邮箱', 'Work email')}</label>
            <input id="email" name="email" type="email" autocomplete="email" required placeholder="you@company.com" />
          </div>
          <div class="field">
            <label for="company">${h(lang, '公司 / 项目', 'Company / project')}</label>
            <input id="company" name="company" autocomplete="organization" />
          </div>
          <div class="field">
            <label for="plan">${h(lang, '感兴趣的方案', 'Plan of interest')}</label>
            <select id="plan" name="plan">
              ${plans.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="message">${h(lang, '想解决的问题', 'What are you solving?')}</label>
            <textarea id="message" name="message" placeholder="${h(
              lang,
              '例如：Electron 应用，需要 3 台设备限制 + Stripe 年付 + 离线启动。',
              'e.g. Electron app, 3-device limit, Stripe annual billing, offline startup.',
            )}"></textarea>
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%">${h(lang, '发送（通过邮件客户端）', 'Send via email client')}</button>
          <p class="form-note" data-form-note data-sent-text="${h(
            lang,
            '已打开邮件客户端，发送后我们会尽快回复。',
            'Your email client should open. Send it and we will reply shortly.',
          )}">${h(
            lang,
            '表单会打开你的默认邮件客户端，不会上传到第三方服务。',
            'The form opens your default email client; nothing is uploaded to a third party.',
          )}</p>
        </form>
      </div>
    </div>
  </section>`;
  return { title, description, body };
}

/* Changelog */

export function renderChangelog(lang) {
  const title = h(lang, '更新日志 · UnionUser', 'Changelog · UnionUser');
  const description = h(
    lang,
    'UnionUser 平台的版本更新记录。',
    'Release notes for the UnionUser platform.',
  );
  const items = [
    {
      version: '2026.11',
      date: '2026-11-05',
      title: h(lang, '官网与文档上线', 'Website and docs launch'),
      points: [
        h(lang, '中英文官网、定价与接入文档发布', 'Bilingual site, pricing and integration docs'),
        h(lang, '首批 Java / JavaScript / Python / Rust / PHP 示例', 'First examples for Java, JavaScript, Python, Rust and PHP'),
        h(lang, '自助试用 31 天开放申请', '31-day self-serve trial applications open'),
      ],
    },
    {
      version: '2026.10',
      date: '2026-10-18',
      title: h(lang, '授权与更新链路', 'Licensing and release pipeline'),
      points: [
        h(lang, 'Ed25519 离线 token 与设备绑定稳定', 'Stable Ed25519 offline tokens with device binding'),
        h(lang, 'Sparkle / Velopack / Tauri 发布源', 'Sparkle / Velopack / Tauri release feeds'),
        h(lang, 'Stripe 支付、退款与账单门户', 'Stripe payments, refunds and billing portal'),
      ],
    },
    {
      version: '2026.09',
      date: '2026-09-12',
      title: h(lang, '多租户与门户', 'Multi-tenancy and portal'),
      points: [
        h(lang, '工作区隔离与角色权限', 'Workspace isolation and roles'),
        h(lang, '客户门户：设备、席位、账单', 'Customer portal: devices, seats, billing'),
        h(lang, '审计日志与导出', 'Audit log and export'),
      ],
    },
  ];
  const body = `
  <section class="docs-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="${url(lang, '/')}">${h(lang, '首页', 'Home')}</a><span>/</span><span>${h(lang, '更新日志', 'Changelog')}</span></div>
      <h1>${h(lang, '更新日志', 'Changelog')}</h1>
      <p>${h(lang, '平台版本与官网同步更新。', 'Platform and website releases, kept in sync.')}</p>
    </div>
  </section>
  <section class="section">
    <div class="container" style="max-width:820px">
      ${items
        .map(
          (item) => `<article style="padding:0 0 34px;margin-bottom:34px;border-bottom:1px solid var(--line)">
            <div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap"><span class="tag"><strong>v${item.version}</strong></span><span style="color:var(--muted-2);font-size:0.84rem">${item.date}</span></div>
            <h2 style="font-size:1.35rem;margin:12px 0 10px">${item.title}</h2>
            <ul style="color:var(--muted);padding-left:20px;margin:0">${item.points
              .map((p) => `<li style="margin:6px 0">${p}</li>`)
              .join('')}</ul>
          </article>`,
        )
        .join('')}
    </div>
  </section>`;
  return { title, description, body };
}

/* Legal */

export function renderLegal(lang, kind) {
  const isPrivacy = kind === 'privacy';
  const title = h(
    lang,
    isPrivacy ? '隐私政策 · UnionUser' : '服务条款 · UnionUser',
    isPrivacy ? 'Privacy Policy · UnionUser' : 'Terms of Service · UnionUser',
  );
  const description = h(
    lang,
    isPrivacy ? 'UnionUser 隐私政策。' : 'UnionUser 服务条款。',
    isPrivacy ? 'UnionUser privacy policy.' : 'UnionUser terms of service.',
  );
  const privacyZh = `
    <p>本政策说明 UnionUser（以下简称「我们」）在提供授权管理平台时如何处理数据。本页为上线初版，正式条款以签署的合同与平台内展示为准。</p>
    <h2>我们收集的数据</h2>
    <ul><li>账号数据：邮箱地址、登录验证码、工作区与角色。</li><li>授权数据：授权码、套餐、到期时间、设备指纹（哈希值）、激活与校验记录。</li><li>支付数据：由 Stripe 处理，我们不保存完整卡号。</li><li>运营数据：审计日志、IP 与请求时间，用于安全与计费。</li></ul>
    <h2>数据用途</h2>
    <p>用于提供授权校验、设备管理、支付与续费、安全审计与客户支持。我们不会出售你的数据。</p>
    <h2>数据存储与保留</h2>
    <p>托管版数据存储于我们使用的云服务器与对象存储；自托管版完全位于客户环境。账号与授权数据在服务期内保留，删除请求按适用法律处理。</p>
    <h2>联系</h2>
    <p>隐私相关请求请联系 <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a>。</p>`;
  const privacyEn = `
    <p>This policy explains how UnionUser handles data while providing the licensing platform. This is an initial version; signed contracts and in-product terms take precedence.</p>
    <h2>Data we collect</h2>
    <ul><li>Account data: email address, login codes, workspace and roles.</li><li>License data: license keys, plan, expiry, hashed device identifiers, activation and verification records.</li><li>Payment data: processed by Stripe; we do not store full card numbers.</li><li>Operational data: audit logs, IP and request timestamps for security and billing.</li></ul>
    <h2>How we use it</h2>
    <p>To provide license verification, device management, payments and renewals, security auditing and support. We do not sell your data.</p>
    <h2>Storage and retention</h2>
    <p>Managed plans store data on our cloud servers and object storage; self-hosted data stays in your environment. Account and license data is retained for the service term; deletion requests are handled under applicable law.</p>
    <h2>Contact</h2>
    <p>Privacy requests: <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a>.</p>`;
  const termsZh = `
    <p>本页为 UnionUser 服务条款初版。使用平台即表示你同意以下条款；企业客户以双方签署的合同为准。</p>
    <h2>服务内容</h2>
    <p>我们提供授权管理、支付对接、发布分发与客户门户等能力。具体功能以所选套餐与后台实际提供为准。</p>
    <h2>账号与安全</h2>
    <p>你需妥善保管账号与 API Key，并对工作区内发生的操作负责。发现异常应立即通知我们。</p>
    <h2>计费与退款</h2>
    <p>按所选套餐与活跃授权计费。年付计划 14 天内可无理由退款；月付取消后当期不退。超额按页面公布的价格计费。</p>
    <h2>可接受使用</h2>
    <p>不得使用本服务从事违法活动、分发恶意软件或规避第三方授权。违反时我们可暂停服务。</p>
    <h2>责任限制</h2>
    <p>服务按现状提供。除法律强制要求外，我们不对间接损失承担责任。自托管版本的安全与运维由客户负责。</p>
    <h2>开源署名</h2>
    <p>平台基于 Keygate 引擎构建，界面保留 “Powered by Keygate” 署名。</p>`;
  const termsEn = `
    <p>This is an initial version of the UnionUser terms. Using the platform means agreeing to these terms; enterprise customers are governed by their signed contracts.</p>
    <h2>Service</h2>
    <p>We provide license management, payment integration, release distribution and a customer portal. Available features follow your plan and the product.</p>
    <h2>Accounts and security</h2>
    <p>You are responsible for safeguarding accounts and API keys and for activity in your workspace. Notify us of suspected abuse.</p>
    <h2>Billing and refunds</h2>
    <p>Billed by plan and active licenses. Annual plans are refundable within 14 days; monthly plans are not refunded for the current period after cancellation. Overage follows published prices.</p>
    <h2>Acceptable use</h2>
    <p>Do not use the service for unlawful activity, malware distribution or circumventing third-party licensing. We may suspend service for violations.</p>
    <h2>Liability</h2>
    <p>The service is provided as-is. Except where required by law, we are not liable for indirect damages. Self-hosted security and operations are the customer’s responsibility.</p>
    <h2>Open-source attribution</h2>
    <p>The platform is built on the Keygate engine and keeps the “Powered by Keygate” attribution.</p>`;
  const body = `
  <section class="docs-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="${url(lang, '/')}">${h(lang, '首页', 'Home')}</a><span>/</span><span>${h(
        lang,
        isPrivacy ? '隐私政策' : '服务条款',
        isPrivacy ? 'Privacy' : 'Terms',
      )}</span></div>
      <h1>${h(lang, isPrivacy ? '隐私政策' : '服务条款', isPrivacy ? 'Privacy Policy' : 'Terms of Service')}</h1>
      <p>${h(lang, '更新日期：2026-11-05', 'Last updated: 2026-11-05')}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="prose">${h(lang, isPrivacy ? privacyZh : termsZh, isPrivacy ? privacyEn : termsEn)}</div>
    </div>
  </section>`;
  return { title, description, body };
}

/* 404 */

export function render404(lang) {
  const title = h(lang, '页面未找到 · UnionUser', 'Page not found · UnionUser');
  const body = `
  <section class="section" style="padding:110px 0;text-align:center">
    <div class="container">
      <div class="eyebrow">404</div>
      <h1>${h(lang, '这个页面不存在', 'This page does not exist')}</h1>
      <p style="color:var(--muted)">${h(lang, '链接可能已更新，或地址拼写有误。', 'The link may have changed, or the address is misspelled.')}</p>
      <div class="hero-actions" style="justify-content:center">
        ${button(url(lang, '/'), h(lang, '回到首页', 'Back home'), 'primary')}
        ${button(url(lang, '/docs/'), h(lang, '查看文档', 'Browse docs'), 'ghost')}
      </div>
    </div>
  </section>`;
  return { title, description: title, body, noindex: true };
}
