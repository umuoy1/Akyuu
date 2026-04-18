# ADR-017｜I18N 与 Locale 传播策略：Workspace-Level Locale，贯通 Web / API / Worker / LLM

- 状态：Accepted
- 日期：2026-04-18
- 决策范围：当前产品对国际化、本地化与 locale 传播的统一实现方式
- 关联文档：
  - `docs/prd.md`
  - `docs/roadmap.md`
  - `docs/architecture/system-module-design.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

当前系统中的用户可见文本分散在多个层级：

- Web 页面与交互组件文案
- API 返回的错误消息
- Worker 生成的 digest / topic / trend 文案
- Ask 的 deterministic fallback
- LLM 的 prompt 与输出约束

如果只在 Web 层做静态翻译，会出现以下问题：

- 页面可切换语言，但 API 错误仍是另一种语言
- digest / topic / ask 的持久化内容仍是旧语言
- scheduler / worker 后台生成内容与 Web 当前语言不一致

因此需要一个贯通全系统的 locale 模型。

## 决策

### 1. 当前阶段支持语言固定为两种

当前阶段只支持：

- `en-US`
- `zh-CN`

不引入任意 locale 自由扩展，不提前做 ICU 消息平台或第三方翻译平台接入。

### 2. Locale 归属到 Workspace

locale 的主归属层级固定为 `workspace`，新增：

- `workspace.locale`

原因：

- digest / topic / ask / notification 都是 workspace 级产物
- 当前产品仍是单 workspace 主路径
- background worker 与 scheduler 需要稳定、可持久的 locale，而不是只依赖浏览器临时状态

### 3. Web 不走 locale path segment

当前阶段不引入：

- `/en-US/today`
- `/zh-CN/today`

而是保持现有 URL 结构不变，通过 workspace 设置切换 locale。

原因：

- 当前系统没有多 tenant / 多 session / 多 workspace 的复杂路由需求
- 先把 locale 传播链路打通，比先改路由结构更重要

### 4. Locale 传播链路固定为

1. `workspace.locale` 作为默认 locale
2. API 请求上下文读取 workspace locale
3. Web SSR 通过 API 读取当前 workspace settings
4. Worker / digest / topic / trend / ask 生成时使用 workspace locale
5. LLM prompt 显式约束输出语言与当前 locale 一致

### 5. Web UI 与持久化内容都必须接入 I18N

当前阶段 I18N 的覆盖范围必须同时包含：

- Web 页面静态文案
- 客户端交互状态文案
- API 错误消息
- digest 标题 / 摘要 / section 标题
- topic summary / trend highlights
- Ask deterministic fallback
- LLM 输出语言约束

### 6. Locale 切换通过 Workspace Settings API 完成

当前阶段引入 workspace settings API，用于：

- 读取当前 locale
- 更新当前 locale

Web 顶部语言切换器通过该接口更新 locale，并刷新页面。

### 7. 当前阶段不解决的问题

本 ADR 不解决：

- 用户级 locale 覆盖
- URL 级 locale 路由
- 第三方翻译管理平台
- 文案在线运营后台
- 历史已生成 digest 的批量重算翻译

历史内容保持“生成时语言”，不做追溯式重写。

## 结果与影响

### 正面影响

- locale 在系统内有唯一事实来源
- Web / API / Worker / LLM 语言一致
- 后台自动生成任务不再依赖浏览器上下文

### 代价

- 需要数据库迁移与 workspace settings 接口
- 需要把原本散落在多层的文案抽取为共享 i18n 模块

## 执行要求

- 新增用户可见文案时，必须进入共享 i18n 字典，而不是直接写死在页面或 worker 中
- 新增持久化 narrative 文本时，必须明确其 locale 来源
- LLM prompt 必须继续保持“事实来自 retrieval / DB，语言风格由 locale 约束”
