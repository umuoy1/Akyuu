# ADR-005｜GitHub 接入策略：公开源 Poll-first，私有/安装源为后续预留

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 1 到阶段 3 的 GitHub 接入方式、凭证边界与限流处理
- 关联文档：
  - `docs/architecture/system-module-design.md`
  - `docs/architecture/queue-task-catalog.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

系统模块文档已经明确：

- GitHub 接入使用 `Octokit`
- `REST + GraphQL` 混合
- `public source poll-first`
- `owned/app-installed source webhook-first`

但当前项目仍处于阶段 1 起步，没有真实采集实现。  
如果不先冻结接入策略，阶段 2 很容易在轮询、凭证、速率限制、source cursor 设计上反复返工。

## 决策

### 1. 阶段 1 到阶段 3 只覆盖公开源

本阶段只支持：

- 公开 GitHub 仓库与组织
- 公开 PR / Issue / Release / Repo Metadata
- GitHub Trending 页面快照

明确不在阶段 1-3 内支持：

- GitHub App 安装模式
- 私有仓库
- webhook 驱动的数据主链路

### 2. 接入模式冻结为 Poll-first

阶段 1-3 的 GitHub 采集主模式固定为：

- Repo / Org / PR / Issue / Release：轮询
- Trending：抓取页面快照
- Weekly Rank：走独立 snapshot adapter，不并入 GitHub API 轮询

理由：

- 与现阶段公开源能力和文档边界一致
- 先建立稳定 Raw Layer，比先接 webhook 更重要
- 便于通过 `source_cursor`、`job_run`、`raw_signal` 建立可重放链路

### 3. API 使用策略

- 优先使用 `Octokit` 作为统一客户端
- Repo 事件与基础对象拉取优先 REST
- 当 GraphQL 能显著减少请求次数或减少多次拼装时，允许使用 GraphQL
- 同一采集任务不允许无约束地混用两套接口；必须以“更少请求、更清晰契约”为准

### 4. 凭证策略

阶段 1-3 冻结为系统级凭证模式：

- 默认由系统运营者提供一个或多个 GitHub PAT
- 采集链路使用统一 credential provider 抽象，不把 token 直接散落在业务代码里
- 不做 workspace 级 token 隔离
- `rate_limit_bucket` 以 `provider + credential_key + bucket_key` 跟踪配额

这意味着：

- 单用户和早期开发环境优先跑通主链路
- 多 workspace 隔离和 GitHub App 安装留到后续 ADR

### 5. 采集状态管理

所有可增量采集源必须使用 `source_cursor` 管理状态，至少包括：

- `source_type`
- `source_key`
- `etag`
- `last_seen_external_id`
- `last_polled_at`
- `next_poll_after`

原则：

- 没有 cursor 的采集源，不进入常态轮询
- 采集必须先写 Raw Layer，再进入 normalize
- 不允许从外部 API 结果直接跳过 Raw Layer 写 canonical/intelligence

### 6. 限流与失败处理

GitHub 请求统一经过 access governor，至少遵守：

- 429 或 rate limit 命中时按 `reset_at` 或 backoff 延后
- 外部 5xx、网络错误允许指数退避重试
- 4xx 中除临时授权异常外默认不重试
- 解析失败或映射失败进入失败记录与告警，不丢失原始响应

### 7. 未来兼容性要求

虽然阶段 1-3 不做 webhook-first，但必须预留后续接入空间：

- GitHub credential provider 不能假定只有 PAT
- `source_type` 命名需要容纳 webhook / app installation 来源
- Raw Layer 需要接受“轮询信号”和“Webhook 信号”两种来源

## 结果与影响

### 正面影响

- 与系统架构文档保持一致
- 阶段 2 可以先把采集、限流、重试、幂等链路做实
- 减少过早为私有仓库和 App 安装设计复杂度

### 代价

- 公开源轮询的时效性不如 webhook
- 单系统级 PAT 在数据量变大时会先遇到配额瓶颈
- 多 workspace 隔离能力暂时不成立

## 不在本 ADR 内解决的问题

- 是否使用单个 PAT 还是 PAT 池
- GraphQL 查询模板的具体集合
- GitHub App 的安装与回调流程
- 私有仓库与组织权限模型

## 后续执行要求

- 阶段 2 开始实现 `infra-github` 时，必须先定义 credential provider 和 access governor
- 所有 GitHub 采集任务都必须显式声明其 `source_type` 和 `source_key`
- 如后续引入 webhook-first 主链路，必须新增 ADR 说明与现有 poll-first 的兼容方式
