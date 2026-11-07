# UnionUser 官网产品需求文档（PRD）

| 项目 | 内容 |
|---|---|
| 文档版本 | v0.2（决策已确认，进入实现） |
| 日期 | 2026-11-05 |
| 站点位置 | `keygate/website/` |
| 产品形态 | 面向桌面软件开发者的授权管理平台（SaaS 为主，自托管为辅） |
| 目标读者 | 产品/设计/前端/后端/运营 |

---

## 1. 背景与目标

### 1.1 背景

`keygate/` 已经是一个可运行的授权管理平台（线上实例：`https://keygate.unionuser.com`，站点名 **Union User**），具备完整的授权生命周期、设备激活、离线验签、支付、自动更新分发、用户门户与后台管理能力。目前它主要服务于自有产品（如 WeMedia Creator），没有对外销售的产品官网。

我们计划把 **UNION-USER** 作为一个独立的授权管理服务，卖给其他软件开发者，重点是**桌面软件开发者**（Electron、Tauri、Qt、.NET/WPF、Unity、Go 等）。这类开发者通常：

- 需要「一台设备一份授权」或「一份授权 N 台设备」的激活控制；
- 需要离线可用、启动时快速校验授权；
- 需要试用、订阅、买断、续费与试用转付费；
- 需要客户自助管理设备与账单，减少售后；
- 不想自己写激活服务、支付 webhook、许可证签名与更新分发。

### 1.2 网站目标

1. **讲清楚是什么**：3 秒内让桌面开发者知道 UNION-USER 能解决授权、支付、更新、客户自助四件事。
2. **讲清楚怎么用**：提供从注册到第一次激活的完整路径，以及 Electron / Tauri / Qt / .NET / Go 的接入示例。
3. **建立信任**：自托管能力、Ed25519 离线验签、原子并发控制、审计日志、成熟的后台与门户。
4. **完成转化**：注册工作区 / 预约演示 / 进入文档 / 联系销售。
5. **承接搜索与社区流量**：文档、对比页、接入指南、FAQ 具备长期 SEO 价值。

### 1.3 非目标（本期不做）

- 不做公开的在线 Demo 工作区（P2 再评估）。
- 不做社区论坛、插件市场。
- 不承诺「无法破解」或 DRM 级保护；产品定位是商业授权与运营门槛，不是反破解。
- 不在官网上直接完成支付（先引导注册/联系，支付走平台内或线下）。

---

## 2. 产品定位与目标用户

### 2.1 一句话定位

> **UNION-USER：为桌面软件而生的授权管理平台。**
> 一份授权覆盖激活、试用、订阅、买断、支付、自动更新与客户自助门户。

英文：
> **UNION-USER — licensing infrastructure for desktop software.** Activation, trials, subscriptions, perpetual licenses, payments, updates and a customer portal in one platform.

### 2.2 备选标语

- 「别再把时间花在写激活服务上。」
- 「从第一个授权码，到第一个付费客户。」
- 「License management, minus the infrastructure.」
- 「你的软件，你的授权，你的客户数据。」

### 2.3 目标用户与画像

| 画像 | 典型特征 | 核心诉求 | 网站要回答的问题 |
|---|---|---|---|
| 独立桌面开发者 | 1–3 人，Electron/Tauri/Qt/.NET，产品已上线或即将收费 | 快速接入、价格可控、不想维护服务 | 「多久能接完？」「多少钱？」「支持离线吗？」 |
| 小型软件团队 | 5–30 人，有付费用户，需要试用/订阅/买断 | 设备名额、试用转付费、退款、发票、客户自助 | 「能处理退款/续费/多设备吗？」「客户能自己换机吗？」 |
| 国内商业软件厂商 | 需要私有化/合规、数据不出境、中文后台 | 自托管、审计、角色权限、中文支持 | 「能部署到我们自己的服务器吗？」 |
| 出海/全球产品 | 面向海外用户，Stripe 收款 | 多语言、Stripe、时区、支付失败挽回 | 「支持 Stripe 吗？」「多语言呢？」 |

### 2.4 用户痛点 → UNION-USER 对策

| 痛点 | 自行研发的成本 | UNION-USER 对策 |
|---|---|---|
| 设备激活与名额控制 | 并发下重复计数、重试幂等、换机流程 | 原子激活名额、`Idempotency-Key`、门户自助释放设备 |
| 离线可用 | 需要设计签名 token、过期续验、防篡改 | Ed25519 签名 token，客户端缓存离线验签，到期联网续验 |
| 试用与转付费 | 试用期、到期降级、试用回落到免费版 | 试用套餐、`trial_days`、试用结束回落到指定免费套餐 |
| 订阅与买断 | Stripe webhook、成功页校验、定时对账、催款 | 三层支付可靠性、dunning、退款、订阅升降级、账单门户 |
| 自动更新 | Sparkle / Velopack / Tauri 三套协议 | 统一发布源，三种更新器共用一套 Release |
| 客户售后 | 换机、重装、发票、取消订阅 | 用户门户自助管理授权、设备、席位、账单 |
| 用量计费 | 原子配额、周期重置、阈值告警 | 用量计量与配额，小时/日/月/年周期，webhook 告警 |
| 数据与合规 | 托管服务的客户数据在别人服务器 | 支持自托管（Go + PostgreSQL + S3 兼容存储） |

### 2.5 差异化

1. **桌面优先**：公开 SDK 端点直接用 `license_key`，不需要把 API Key 打进客户端二进制。
2. **离线验签**：Ed25519 非对称签名，客户端内置公钥即可本地验证；`exp` 是联网续验间隔，`vun` 是授权到期时间，二者分离。
3. **支付内建**：Stripe 订阅/买断/试用/自助领证/退款/账单门户，而不是只做「密钥生成器」。
4. **更新分发内建**：Sparkle / Velopack / Tauri 共用发布源，支持许可证门控下载与维护期。
5. **客户自助**：门户可释放设备、增删席位、换套餐、开发票、续维护期。
6. **可自托管**：Go + PostgreSQL，无 Redis 也能跑，数据留在自己手里。
7. **中文支持**：中英文界面与邮件模板，适合国内与出海团队。

### 2.6 品牌与命名

- 对外品牌：**UnionUser**（正式写法，单品牌；中文语境可读作「UnionUser」，不再使用 UNION-USER / Union User 两种变体）。
- 域名：`unionuser.com`（营销站，默认中文；英文站 `/en/`）。控制台本轮沿用 `keygate.unionuser.com`，后续可迁至 `app.unionuser.com`。
- 底层引擎为 Keygate（AGPL v3）。**必须在产品界面保留 “Powered by Keygate” 署名**；若要对客户完全白标或作为闭源服务转售，需向 Tabloy 取得商业授权。营销站文案表述为「基于 Keygate 引擎」，避免暗示完全自研。

---

## 3. 商业模式与转化路径（已确认）

### 3.1 模式

| 模式 | 说明 | 优先级 |
|---|---|---|
| **托管 SaaS 多租户（已确认）** | 客户注册即得独立工作区（`<slug>.unionuser.com`），按工作区 + 活跃授权数 + 功能档位收费。上线自助注册前需开启多租户（`TENANT_ENABLED=true`，当前线上未开启）；过渡期由人工开通工作区。 | P0 |
| 自托管商业授权（已确认支持） | 客户自行部署 Keygate 引擎，购买商业授权/支持；源码不公开。 | P1 |
| 专属托管实例 | 大客户独立部署，按年收费 + 运维。 | P2 |

**开源策略（已确认）**：UnionUser 不开源，不公开仓库；自托管以商业授权方式提供。产品界面保留 “Powered by Keygate” 署名。

### 3.1.1 定价建议（已确认档位，价格为建议值）

> 计费口径：**活跃授权** = 过去 30 天内有过校验/激活记录的授权。按工作区计费，不按交易抽成（Stripe 手续费另计）。

| 档位 | 月付 | 年付（约 8.3 折，免 2 个月） | 产品数 | 活跃授权 | 包含能力 |
|---|---|---|---|---|---|
| **Developer（免费）** | $0 | $0 | 1 | 100 | 邮箱验证码账号、客户门户、离线验签、设备激活、社区支持 |
| **Pro（推荐）** | $29 | $290 | 3 | 1,000 | Stripe 支付、自助试用/领证、发布源（Sparkle/Velopack/Tauri）、Webhook、邮件支持 |
| **Business** | $99 | $990 | 10 | 10,000 | 席位/成员、SSO（Casdoor）、用量配额、审计导出、优先支持、99.9% SLA |
| **Enterprise / 自托管** | $399 起 | $3,990 起 | 不限（公平使用） | 不限 | 独立工作区或自托管商业授权、白标（需 Keygate 商业授权）、迁移与接入支持 |

- **免费试用**：Pro 全部能力，**31 天**，无需信用卡；到期自动回落 Developer 档，授权与数据保留。
- **超额**：超出活跃授权上限后按 `$10 / 每 1,000 活跃授权 / 月` 计，不强制中断服务。
- **退款**：年付 14 天内无理由退款；月付随时取消，当期不退。
- **自托管**：不含 Stripe 托管收款，授权签名与门户仍由客户实例自行运行。

### 3.2 转化路径

```
搜索引擎 / GitHub / 社区
        │
        ▼
首页（30 秒理解）──► 功能页 ──► 接入指南 ──► 文档
        │                              │
        ▼                              ▼
   定价页 ──► 注册工作区 / 预约演示 ──► 创建产品与套餐
                                           │
                                           ▼
                                   首个设备激活成功（Aha moment）
                                           │
                                           ▼
                                    升级付费 / 年度合同
```

> 多租户自助注册开通前，主 CTA 使用「预约演示 / 联系我们」并人工开通工作区；多租户上线后，主 CTA 替换为「免费开始」并直连注册。两种状态下文档与定价始终可见。

### 3.3 已确认决策（2026-11-05）

| # | 事项 | 决策 |
|---|---|---|
| 1 | 域名 | `unionuser.com`（营销站）；控制台沿用 `keygate.unionuser.com` |
| 2 | 商业模式 | 托管 SaaS 多租户为主；自托管商业授权为辅 |
| 3 | 定价 | 采用 §3.1.1 四档：Developer / Pro / Business / Enterprise |
| 4 | 语言 | 中英文同时上线；中文默认，英文 `/en/` |
| 5 | 品牌 | **UnionUser** 单品牌 |
| 6 | 试用 | 31 天，Pro 全能力，无需信用卡 |
| 7 | 首批 SDK | Java、JavaScript、Python、Rust、PHP |
| 8 | 演示/销售 | 需要，提供预约演示与联系表单 |
| 9 | 开源 | 不开源；支持自托管商业授权 |
| 10 | 部署 | 与 Keygate 同服务器，静态站由 Nginx 托管 |
| 11 | 截图 | 从线上 `https://keygate.unionuser.com/` 采集；后台截图脱敏后使用 |

---

## 4. 信息架构与页面清单

### 4.1 主导航

| 导航项 | 路由 | 说明 |
|---|---|---|
| 功能 | `/features/` | 能力总览，锚点跳转各能力 |
| 使用指南 | `/how-it-works/` | 5 步接入 + 集成模式 |
| 文档 | `/docs/` | 快速开始、接入示例、API 参考、Webhook |
| 定价 | `/pricing/` | 套餐对比与 FAQ |
| 对比 | `/compare/` | vs Keygen / Cryptlex / LicenseSpring / 自研 |
| 博客 | `/blog/` | 接入教程、版本说明、工程文章 |
| 登录 / 控制台 | 外链 | `https://keygate.unionuser.com/login` |

页头右侧固定两个按钮：**「查看文档」**（次要）与 **「免费开始 / 预约演示」**（主要）。

### 4.2 页面优先级

| 优先级 | 页面 | 路由 | 目的 |
|---|---|---|---|
| P0 | 首页 | `/` | 定位、价值、社会证明、CTA |
| P0 | 功能总览 | `/features/` | 完整能力 + 子功能页 |
| P0 | 使用指南 | `/how-it-works/` | 让开发者相信「今天就能接完」 |
| P0 | 快速开始（文档） | `/docs/quickstart/` | 注册 → 建产品 → 建套餐 → 接入 |
| P0 | API 参考 | `/docs/api/` | 由 `docs/openapi.yaml` 生成 |
| P0 | 定价 | `/pricing/` | 套餐、FAQ、CTA |
| P1 | 桌面方案页 | `/solutions/desktop/` | 按技术栈分流：Electron / Tauri / Qt / .NET |
| P1 | 对比页 | `/compare/` | 拦截竞品搜索词 |
| P1 | FAQ | `/faq/` | 售前与接入问题 |
| P1 | 更新日志 | `/changelog/` | 版本可信度 |
| P1 | 联系我们 | `/contact/` | 表单、预约演示、销售邮箱 |
| P2 | 博客文章 | `/blog/*` | SEO 与教程 |
| P2 | 安全与合规 | `/security/` | 数据、加密、自托管说明 |
| P2 | 状态页 | `status.unionuser.com` | 可用性透明 |

### 4.3 页面模块设计

#### 4.3.1 首页 `/`

1. **Hero**
   - 标题：「为桌面软件而生的授权管理平台」
   - 副标题：「激活、试用、订阅、买断、支付、自动更新与客户门户，一套接完。」
   - 主 CTA：「免费开始」；次 CTA：「5 分钟接入指南」
   - 右侧视觉：代码窗口 + 授权状态卡（激活成功 / 剩余 2 台设备 / 有效期）。
2. **信任条**：Ed25519 离线验签 · 原子激活名额 · Stripe 支付 · Sparkle/Velopack/Tauri · 自托管可选。
3. **三句话价值**（图标卡片）：
   - 客户端只带 `license_key`，不带 API Key；
   - 客户自己换机、加席位、开发票；
   - 数据在你自己手里（可自托管）。
4. **5 步接入**：注册 → 建产品 → 建套餐 → 调用激活 → 上线（每步一张小截图）。
5. **能力分区**（每块链接到功能页锚点）：
   - 授权与激活
   - 试用与自助领证
   - 支付与续费
   - 席位与权益
   - 自动更新分发
   - 用量与配额
   - 客户门户与后台
   - 安全与自托管
6. **面向技术栈**：Electron / Tauri / Qt / .NET / Go 标签，点击进入对应接入指南。
7. **对比表**：UNION-USER vs Keygen vs Cryptlex vs LicenseSpring vs 自研。
8. **价格预览**：3 张套餐卡 + 「查看完整定价」。
9. **FAQ 摘要**：6 条高频问题。
10. **底部 CTA**：「今天就把授权接上」+ 文档 / 预约演示。

#### 4.3.2 功能总览 `/features/`

沿用现有能力的真实边界，按 8 个分区展开，每区包含：一句话价值、3–5 个要点、截图/示意图、相关 API 名称、文档链接。

| 分区 | 必须出现的真实能力 |
|---|---|
| 授权与激活 | 订阅 / 买断 / 买断+维护期 / 试用 / 浮动授权；激活、校验、停用、暂停、恢复、吊销；每设备或每用户名额；原子并发；宽限期；`Idempotency-Key` |
| 离线验签 | Ed25519 签名 token；客户端内置公钥；`exp` 联网续验间隔与 `vun` 授权到期分离；`ftr` 权益；设备指纹绑定 |
| 试用与自助领证 | 免费套餐开启 self-signup；邮箱验证码领证；每地址每产品一份；每日上限；营销同意；试用结束回落到免费套餐 |
| 支付与订阅 | Stripe Checkout；webhook + 成功页 + 定时对账三层保障；dunning；升降级与按比例计费；退款；账单门户；维护期续费 |
| 席位与权益 | 套餐席位或按席位售卖；所有者 + 成员独立密钥；成员暂停与席位释放；布尔/数值/配额权益；付费附加包 |
| 自动更新 | Sparkle / Velopack / Tauri 同一发布源；原子发布；yank 回滚；每产品 Ed25519 签名；S3 兼容存储；许可证门控下载；维护期控制；最低支持版本 |
| 用量与配额 | 原子配额；小时/日/月/年周期；阈值 webhook |
| 管理与门户 | 产品/套餐/授权/客户/API Key/Webhook/分析/审计/团队/邮件模板/品牌定制；客户门户自助 |

#### 4.3.3 使用指南 `/how-it-works/`

- 架构图：客户端 →（HTTPS）→ UNION-USER API；可选自托管；数据库/对象存储。
- 三条接入路径（Tab 切换）：
  1. **首次激活**：用户输入授权码 → `POST /api/v1/license/activate` → 保存 token。
  2. **启动校验**：先离线验签缓存的 token；过期或需要感知吊销时 `POST /api/v1/license/verify`。
  3. **自动更新**：配置 feed URL（Sparkle/Velopack/Tauri），按需附带 `license_key`。
- 设备指纹最佳实践：Windows MachineGuid、macOS IOPlatformUUID、Linux machine-id；哈希后再上传；隐私说明。
- 错误处理表：`ACTIVATION_LIMIT`、`LICENSE_EXPIRED`、`LICENSE_SUSPENDED`、`LICENSE_REVOKED`、`LICENSE_NOT_FOUND`、`DEVICE_HELD`、`FLOATING_LICENSE`、`SEAT_PAUSED`、`RATE_LIMITED`、`INVALID_IDEMPOTENCY_KEY`。
- 「什么时候需要联网」说明：`exp` 到期、权益变更、吊销感知、增加设备。

#### 4.3.4 文档中心 `/docs/`

结构：

```
/docs/
  quickstart/              5 分钟接入
  concepts/                产品、套餐、授权、激活、席位、权益
  guides/
    javascript/            JavaScript / Node / Electron 示例
    java/                  Java 示例
    python/                Python 示例
    rust/                  Rust / Tauri 示例
    php/                   PHP 示例
    device-fingerprint/    设备指纹
    offline-verification/  Ed25519 验签
    error-handling/        错误码与重试
    webhooks/              事件与 HMAC 校验
    self-hosted/           Docker 部署与升级
  api/                     由 openapi.yaml 生成的接口参考
  changelog/               平台更新日志
```

每个接入指南必须包含：前置条件、完整最小可运行代码、错误处理、常见坑（时钟、重装、虚拟机、多用户）。

#### 4.3.5 定价 `/pricing/`

- 四档结构见 §3.1.1：**Developer（$0） / Pro（$29/月） / Business（$99/月） / Enterprise & 自托管（$399/月起）**。
- 计费口径：工作区 + 活跃授权数；年付约 8.3 折；Pro 提供 31 天免费试用。
- 必须说明：设备数按套餐配置；Stripe 手续费另计；自托管不按交易抽成。
- 定价 FAQ：试用、超额、退款、发票、迁移、数据导出。

#### 4.3.6 对比页 `/compare/`

表格维度：开源/自托管、价格、离线验签、设备名额、席位、试用/自助领证、Stripe、自动更新、用量配额、客户门户、审计、中文、部署方式。避免贬损性文案，引用可验证事实并标注日期。

#### 4.3.7 接入示例内容规范

- 每个示例展示「激活 → 本地保存 → 启动校验 → 停用」完整闭环。
- 首批示例语言为 **Java、JavaScript、Python、Rust、PHP**（已确认），验签使用各语言主流方案：
  - JavaScript/Electron：`node:crypto`（Ed25519 SPKI 包装）+ 原生 `fetch`
  - Java：`java.net.http.HttpClient` + `java.security`（JDK 15+ Ed25519）
  - Python：标准库 `urllib` + `cryptography` 包
  - Rust/Tauri：`reqwest` + `ed25519-dalek`
  - PHP：`curl` + `sodium_crypto_sign_verify_detached`（ext-sodium）
- 明确说明：**客户端只保存公开公钥与授权 code**，绝不下发 API Key。
- 示例代码统一从 `BASE_URL=https://keygate.unionuser.com`（或客户自有域名）读取，支持环境变量覆盖。

---

## 5. 内容策略

### 5.1 文案基调

- 面向工程师：直接、具体、可验证；少用营销形容词。
- 每个能力都给出「对应 API / 文档链接」，让读者能立刻验证。
- 中文为主，英文为辅；同一信息两种语言保持一致。

### 5.2 首页 Hero 文案草案

**中文**

> # 为桌面软件而生的授权管理平台
> 激活、试用、订阅、买断、支付、自动更新与客户门户，一次接完。
> 客户端只带授权码；离线也能验签；客户自己管理设备与账单。
>
> [免费开始] [5 分钟接入指南]

**英文**

> # Licensing infrastructure for desktop software
> Activation, trials, subscriptions, perpetual licenses, payments, updates, and a customer portal — in one platform.
> Your binary ships a license key, never an API secret. Offline verification included.
>
> [Start free] [5-minute integration]

### 5.3 信任要素

- 授权 token 采用 Ed25519 非对称签名（公钥可公开，私钥不出服务器）。
- 激活名额在数据库层原子扣减，重试不会重复计数。
- 支付采用 webhook + 成功页 + 定时对账三层校验。
- 支持自托管；可完全掌握客户数据。
- 完整审计日志与角色权限。

### 5.4 SEO 关键词方向

- 中文：桌面软件授权管理、软件激活码系统、License 管理平台、离线授权校验、Electron 授权、Tauri 授权、软件防拷贝（谨慎表述）、Stripe 授权销售。
- 英文：desktop app licensing, software license management, offline license verification, Electron licensing, Tauri licensing, Keygen alternative, Cryptlex alternative.

---

## 6. 视觉与交互设计

### 6.1 设计原则

1. **工程可信感**：真实界面截图、代码片段、API 名称优先于抽象插画。
2. **信息密度可控**：首页每屏只讲一件事；文档页允许高密度。
3. **一致的双语排版**：中英文分别设定字号与行高，避免直译导致的断行。
4. **暗色友好**：代码块与截图以暗色为主，页面默认浅色，支持 `prefers-color-scheme`。

### 6.2 视觉方向

| 元素 | 建议 |
|---|---|
| 主色 | 深墨蓝 `#0B1220`（背景/文字）+ 电光靛 `#4F46E5`（主 CTA）+ 薄荷绿 `#34D399`（成功/激活状态） |
| 中性色 | 冷灰阶，保证代码与表格可读性 |
| 字体 | 中文：系统字体栈（PingFang SC / Microsoft YaHei）；英文：Inter；代码：JetBrains Mono |
| 图形 | 线条式图标；架构图与流程图用等宽标签；截图使用真实后台（脱敏） |
| 动效 | 克制：首屏淡入、Tab 切换、复制按钮反馈；不做大面积滚动动画 |

### 6.3 关键组件

- 顶部导航（吸顶、移动端抽屉）
- Hero（左文右码窗）
- 代码块（语言 Tab、行号可选、一键复制、文件名标签）
- 步骤条（5 步接入）
- 能力卡片（图标 + 标题 + 一句价值 + 文档链接）
- 对比表（可横向滚动，首列固定）
- 定价卡（推荐档高亮）
- FAQ 折叠
- 文档侧边栏 + 目录 + 上一页/下一页
- 页脚（产品、文档、公司、法律、状态、GitHub）

### 6.4 响应式与可访问性

- 断点：≥1280 桌面、768–1279 平板、<768 移动。
- 正文对比度 ≥ WCAG AA；所有交互可键盘操作；图片有 `alt`；代码块可复制。
- 性能预算：首屏 JS < 100 KB（gzip）、LCP < 2.0s（4G）、CLS < 0.1；文档页可放宽。

---

## 7. 技术实现方案

### 7.1 技术选型

`keygate/website/` 当前为空目录。建议采用与现有 `we-media-creator-workstation/website` 一致的**零框架静态生成**方案：

- Node ESM 构建脚本（`build.mjs`）+ 模板模块（`src/lib/*`）
- Tailwind CSS 构建期编译
- 文档用 Markdown + 构建期渲染与代码高亮
- 产出纯静态 `website/site/`，部署到 Nginx/OSS+CDN
- 不引入前端框架；交互仅用少量原生 JS（菜单、Tab、复制、FAQ）

理由：与仓库现有技术栈一致、构建可控、无运行时依赖、SEO 友好、部署简单。

### 7.2 目录结构（建议）

```
keygate/website/
  PRD.md
  package.json          # tailwindcss 等构建期依赖
  build.mjs             # 生成 site/
  src/
    config.mjs          # 站点域名、导航、套餐、CTA 目标
    lib/
      layout.mjs        # 页头/页脚/SEO/JSON-LD
      pages.mjs         # 首页、功能、使用指南、定价、对比、FAQ
      docs.mjs          # Markdown 文档渲染、侧边栏、目录
      markdown.mjs      # 最小 Markdown 渲染 + 高亮
      i18n.mjs          # 中英文案
    content/
      docs/**/*.md      # 接入指南与概念文档
      blog/**/*.md
    site.css
    site.js
  site/                 # 构建产物（git 忽略）
```

### 7.3 API 文档

- 以仓库 `docs/openapi.yaml` 为唯一事实来源。
- 构建期读取 OpenAPI，生成 `/docs/api/` 的接口列表与详情页（路径、方法、鉴权、参数、响应、错误码）。
- 不引入客户端 Swagger UI；保留「下载 OpenAPI」链接。
- 文档版本与平台版本绑定，页脚展示当前平台版本。

### 7.4 i18n

- 中英文**同时上线**；中文为默认语言，英文位于 `/en/` 前缀。
- 语言切换保持当前路由；所有页面（含文档与接入示例）双语齐全，不出现缺失路由。
- 文案以中文撰写、英文同步翻译；价格、套餐名、品牌 UnionUser 两站一致。

### 7.5 SEO 与分发

- 每页独立 `title` / `description` / canonical / hreflang。
- `sitemap.xml`、`robots.txt`、`llms.txt`（可选）。
- JSON-LD：`Organization`、`SoftwareApplication`、`FAQPage`、`BreadcrumbList`。
- Open Graph 图片按页面生成或复用品牌图。
- RSS（博客）。

### 7.6 表单与转化追踪

- 「预约演示 / 联系」表单：POST 到平台反馈接口或独立表单服务（待定），带 CSRF/限流与隐私同意。
- 分析：优先自托管 Umami/Plausible；事件：CTA 点击、代码复制、文档完成、注册跳转。
- 不接入重型第三方追踪脚本。

### 7.7 部署

- 构建产物 `site/` 上传至 Keygate 所在服务器的 Nginx 静态目录（如 `/opt/union/website/`），由 Nginx 直接托管 `unionuser.com`。
- 营销站为纯静态资源，与 Keygate 容器解耦：站点故障不影响控制台/API，反之亦然。
- 部署脚本从本地构建并 SFTP 上传（沿用 `.deploy/ssh_run.py` 的连通方式），保留上一版本目录用于回滚。
- 证书与 DNS：`unionuser.com` / `www.unionuser.com` 指向该服务器，HTTPS 由现有 Nginx/证书续期流程覆盖。

---

## 8. 转化与运营

### 8.1 CTA 层级

| 层级 | CTA | 目标 |
|---|---|---|
| 主要 | 免费开始 / 预约演示 | 注册工作区或留资 |
| 次要 | 5 分钟接入指南 / 查看文档 | 进入文档漏斗 |
| 辅助 | 对比页 / 定价页 / 联系我们 | 售前评估 |

### 8.2 关键指标

- 首页 → 文档点击率
- 文档快速开始完成率（到达 API 参考/注册）
- 注册 → 创建产品转化率
- 创建产品 → 首次激活转化率（Aha moment）
- 试用/免费 → 付费转化率
- 预约演示表单提交量与有效线索率
- SEO：目标关键词排名与自然流量

### 8.3 内容计划（上线后 8 周）

1. 「Electron 应用如何做设备授权」
2. 「离线验签：为什么用 Ed25519 而不是 HMAC」
3. 「试用转付费：用 UNION-USER 跑通 Stripe 订阅」
4. 「自动更新三件套：Sparkle / Velopack / Tauri」
5. 「一份授权 3 台设备：名额、换机与并发」
6. 「自托管 License 服务部署实录」
7. 版本更新日志
8. 客户案例（有客户后）

---

## 9. 合规、风险与边界

| 风险 | 说明 | 应对 |
|---|---|---|
| AGPL 署名 | 界面必须保留 “Powered by Keygate” | 保留署名；白标/转售前取得商业授权 |
| 品牌混淆 | UNION-USER 与 Keygate 上游品牌 | 官网明确「基于 Keygate 引擎」，页脚注明上游项目 |
| 多租户未开启 | 当前线上 `TENANT_ENABLED` 未配置，无法自助开通工作区 | 上线自助注册前完成多租户部署与压测 |
| 防破解预期 | 离线 token 可被逆向绕过 | 文案避免「无法破解」，定位为商业门槛与运营工具 |
| 数据合规 | 客户数据托管 | 提供自托管选项、数据导出、隐私政策、备案信息 |
| 价格竞争 | Keygen 等竞品有成熟生态 | 突出桌面场景、离线、支付+更新+门户一体、中文与自托管 |
| 文档漂移 | 官网能力与代码不一致 | 文档以 `openapi.yaml` 与真实后台为准，发版同步更新 |

---

## 10. 里程碑与验收标准

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| M0 | PRD 评审与信息架构确认 | 本文档通过评审，待确认项有结论 |
| M1 | 设计稿 + 首页 / 功能 / 定价 / 使用指南 | 中英文文案定稿；桌面与移动端视觉稿通过 |
| M2 | 静态站框架 + 页面实现 + 快速开始 | 所有 P0 页面可访问；链接无 404；Lighthouse 性能 ≥ 90 |
| M3 | 文档中心 + API 参考生成 + 代码示例 | 5 个技术栈示例可运行；OpenAPI 页面完整 |
| M4 | SEO、分析、表单、部署上线 | sitemap/robots/JSON-LD 正确；部署脚本一键发布；监控与回滚可用 |

页面级验收：

- 首页 3 秒内说明「是什么、给谁、怎么开始」。
- 每个 CTA 落到有效目标（注册/文档/表单）。
- 所有能力描述均有对应真实 API 或后台功能，不虚构。
- 中英文页面无缺失路由，语言切换保持当前位置。
- 移动端无横向溢出；代码块可横向滚动。

---

## 11. 现有可复用资产

- 平台真实界面截图（后台、门户、Stripe 配置、发布页）——需脱敏后使用。
- `docs/openapi.yaml` 与 `docs/api-contract.md`——API 参考来源。
- `README.md` 的功能清单与竞品对比——事实校对。
- 现有 Workstation 官网的静态生成框架与 Tailwind 配置——可直接借鉴结构与视觉工程实践。
- 线上品牌素材：`web/public/logo.svg`、`screenshot.png`（确认是否可用于对外站点）。

---

## 12. 决策记录与遗留事项

10 项待确认问题已于 2026-11-05 全部确认，结论见 §3.3。遗留的执行事项：

1. **多租户开关**：自助注册工作区依赖 `TENANT_ENABLED=true`，当前线上未开启。开通前，站点 CTA 使用「预约演示 / 联系我们」，由人工开通工作区。
2. **SDK 发布形态**：首批以文档内可运行的示例代码交付（Java、JavaScript、Python、Rust、PHP）；独立包（npm / crates.io / Packagist）作为后续项，不在本期承诺。
3. **截图合规**：线上后台截图需使用演示数据并隐藏真实客户邮箱；首版可复用 `web/public/screenshot.png`（演示数据）与公开登录页截图。
4. **邮箱与销售线索**：联系表单落点暂定 `sales@unionuser.com`，后续接入工单系统；需确认邮箱可用。
5. **ICP 备案**：`unionuser.com` 面向中国大陆访问时需备案；未完成前以境外访问为主，或使用已有备案主体。
