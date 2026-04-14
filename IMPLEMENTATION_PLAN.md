# IMPLEMENTATION_PLAN

## 1. 项目理解摘要

### 1.1 产品定位

本项目不是 GitHub 客户端，也不是事件通知器。  
它的目标是把分散的 GitHub 弱信号压缩成可读、可追问、可回溯的技术情报，核心消费形态是：

`Watch Target -> Signals -> Canonical Events -> Intelligence -> Digest / History / Ask`

### 1.2 当前范围基线

`docs/prd.md` 明确了 MVP 必做范围：

- `RepoWatch`
- `TopicWatch`（简化版，规则优先）
- GitHub Trending 日榜采集与昨日 diff
- 每日日报
- 推荐阅读
- 历史报告保存
- 简单追问能力

第一阶段到第三阶段不追求一次把 MVP 全做完，而是先完成：

1. 工程骨架与运行基线
2. Raw/Canonical/Intelligence 数据主链路
3. 第一条可消费的端到端垂直链路

### 1.3 非目标

阶段 1-3 明确不做：

- GitHub App 安装模式
- 私有仓库支持
- 团队协作与权限细化
- 高级个性化学习
- 通用插件市场
- 深度代码语义分析
- 企业治理能力

### 1.4 架构原则

以下原则直接继承 `docs/architecture/system-module-design.md` 与 `docs/architecture/queue-task-catalog.md`：

- 先按领域拆边界，再决定部署单元
- 严格采用 `Raw / Canonical / Intelligence / Product / Ops` 分层
- 核心处理链路 `async-first`
- LLM 只做表达层，不做事实源
- 所有关键任务必须可幂等、可重放、可追溯
- 每个阶段都必须可本地启动、可验证、可提交

### 1.5 路线图映射

本实施计划聚焦长期路线图中的前三个跨越：

- 阶段 1：落地 `M1 情报数据底座` 的工程起点
- 阶段 2：完成 `M1 -> M2` 的统一事件与知识模型主链路
- 阶段 3：完成 `M2 -> M3` 的第一条 `Repo Intelligence` 产品化垂直链路

`Topic Intelligence`、`Askable Analyst`、通知多渠道等能力保留到后续阶段，不在本次前三阶段内一次性展开。

## 2. 技术架构落地方案

### 2.1 运行时与工程基线

- Node.js `24 LTS`
- TypeScript 全量覆盖
- `pnpm workspace` monorepo
- 统一使用 ESM
- 根目录维护共享 `tsconfig`、`env` 模板、脚本入口
- 本地依赖统一通过 Docker Compose 提供：PostgreSQL、Redis

为了控制复杂度，阶段 1 不额外引入大型 monorepo 编排工具，先使用 `pnpm workspace + 根脚本`。后续如果构建时间成为问题，再通过 ADR 引入额外编排层。

### 2.2 应用与部署单元

与模块设计文档保持一致，物理部署先维持少服务：

- `apps/web`
  - Next.js Web 前端
  - 只承载展示与交互，不承载核心 pipeline
- `apps/api`
  - Fastify API
  - 提供 watch、digest、history、feedback、ask 入口
- `apps/scheduler`
  - 负责 cron 与 `watch_schedule` 扫描
  - 只负责派发 job
- `apps/worker`
  - 统一 BullMQ Worker
  - 先通过多 queue handler 运行，后续再按 ingest/intel/digest/notify 拆实例

### 2.3 包边界

领域包与基础设施包直接映射文档边界：

- 领域包负责业务规则、类型、契约、用例
- 基础设施包负责 DB、Queue、GitHub、Scraper、LLM、Observability
- 共享包只放通用配置、类型和少量工具，不放领域逻辑

推荐边界如下：

- `packages/domain-watch`
- `packages/domain-source`
- `packages/domain-canonical`
- `packages/domain-topic`
- `packages/domain-trend`
- `packages/domain-score`
- `packages/domain-digest`
- `packages/domain-ask`
- `packages/domain-feedback`
- `packages/infra-db`
- `packages/infra-queue`
- `packages/infra-github`
- `packages/infra-scraper`
- `packages/infra-llm`
- `packages/infra-observability`
- `packages/shared-types`
- `packages/shared-config`
- `packages/shared-utils`
- `packages/shared-testing`

### 2.4 数据与任务链路落地

第一版主链路按如下顺序收敛：

1. `watch_target / watch_rule / watch_schedule`
2. `scheduler` 生成任务
3. `ingest.poll` 与 `ingest.snapshot` 写入 `raw_signal / raw_snapshot`
4. `normalize.event` 写入 `canonical_entity / canonical_event / event_entity_relation`
5. `topic.match`、`trend.diff`、`score.rank` 写入 intelligence 层
6. `digest.build` 生成 `digest / digest_section / recommended_item`
7. `apps/api` 与 `apps/web` 消费产品层数据

### 2.5 数据访问与迁移策略

建议在阶段 1 通过 ADR 冻结为：

- PostgreSQL 作为主事实库
- Redis + BullMQ 作为异步任务基础设施
- SQL-first migration
- TypeScript schema 建议采用 `Drizzle ORM + drizzle-kit`

原因：

- 更贴近文档里的表分层与索引设计
- 适合 monorepo 中按包共享 schema 与查询类型
- 便于在早期保留直接 SQL 能力，不把数据模型绑定到重运行时框架

### 2.6 GitHub 与外部源接入

阶段 1-3 采用最小可行接入策略：

- GitHub 公开仓库：`poll-first`
- GitHub 详情拉取：通过 `Octokit REST + GraphQL` 混合
- Trending：抓页面快照并保存原文
- Weekly Rank：只保留接口位和抽象，不强行在前三阶段做完产品化

### 2.7 LLM 使用边界

遵循文档约束：

- deterministic skeleton 先产出结构化 digest
- LLM 只负责润色与 Markdown 组织
- 没有 LLM key 时，系统仍应能输出 deterministic Markdown
- 推荐阅读理由与证据链必须可回指上游 intelligence / canonical event

### 2.8 本地开发与验证模型

每阶段都要求具备以下本地运行能力：

- `pnpm install`
- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm dev:scheduler`
- `pnpm dev:worker`
- `pnpm db:up` / `pnpm db:migrate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

本地测试数据策略：

- 优先提供 fixture 驱动的稳定测试
- 辅助提供少量 live smoke test，避免把 GitHub 配额与外部网页波动变成主测试路径

## 3. Monorepo 目录规划

```text
/
  apps/
    web/
    api/
    scheduler/
    worker/

  packages/
    domain-watch/
    domain-source/
    domain-canonical/
    domain-topic/
    domain-trend/
    domain-score/
    domain-digest/
    domain-ask/
    domain-feedback/

    infra-db/
    infra-queue/
    infra-github/
    infra-scraper/
    infra-llm/
    infra-observability/

    shared-types/
    shared-config/
    shared-utils/
    shared-testing/

  docs/
    adr/
    implementation-notes/
    architecture/
    prd.md
    roadmap.md

  scripts/
    dev/
    db/
    fixtures/

  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  docker-compose.yml
  .env.example
  README.md
  IMPLEMENTATION_PLAN.md
```

目录规划说明：

- `apps/*` 只放应用入口与组合层
- `packages/domain-*` 不直接依赖 Web/Fastify/BullMQ 实现
- `packages/infra-*` 向领域层提供适配器
- `docs/adr` 用于冻结关键架构决策
- `docs/implementation-notes` 用于记录实现期补充说明、第三方源适配说明、数据修复说明
- `scripts/fixtures` 用于保存队列和 ingest 的本地回放数据

## 4. 第一阶段到第三阶段的实施顺序

### 阶段 1：工程骨架与运行基线

对应目标：为 `M1 情报数据底座` 建立可运行工程框架，不进入复杂业务逻辑。

本阶段只做：

- 建立 `pnpm workspace` monorepo
- 建立 `apps/web`、`apps/api`、`apps/scheduler`、`apps/worker` 启动骨架
- 建立共享 TypeScript 配置、环境变量模板、根脚本
- 建立 PostgreSQL / Redis 本地运行方式
- 建立 `infra-db`、`infra-queue`、`infra-observability` 基础包
- 落第一批核心表迁移：
  - `workspace`
  - `app_user`
  - `workspace_member`
  - `watch_target`
  - `watch_rule`
  - `watch_schedule`
  - `job_run`
  - `source_cursor`
- 产出第一批 ADR：
  - 运行时基线
  - monorepo 策略
  - 数据访问与迁移策略
  - 队列命名与 job contract 规范

本阶段不做：

- 实际 GitHub 抓取
- canonical normalize
- topic / trend intelligence
- digest 生成

验收标准：

- 根目录可完成安装、类型检查、测试、启动
- 四个 app 都能本地启动并暴露健康检查
- PostgreSQL / Redis 可通过一条命令拉起
- 第一批数据表可成功迁移
- `scheduler` 与 `worker` 至少能跑通一个示例空任务并记录 `job_run`
- 文档中列出的 ADR 至少完成初稿并入库到 `docs/adr/`

### 阶段 2：数据主链路与统一事件骨架

对应目标：完成 `Raw -> Canonical -> Intelligence` 的最小主链路，支撑后续第一条产品链路。

本阶段只做：

- 落第二批数据表迁移：
  - `raw_signal`
  - `raw_snapshot`
  - `canonical_entity`
  - `canonical_event`
  - `event_entity_relation`
  - `topic`
  - `topic_rule`
  - `topic_evidence`
  - `topic_update`
  - `trend_snapshot`
  - `trend_snapshot_item`
  - `trend_diff`
  - `event_score`
- 实现最小可行队列集中的数据链路：
  - `scheduler`
  - `ingest.poll`
  - `ingest.snapshot`
  - `normalize.event`
  - `topic.match`
  - `trend.diff`
  - `score.rank`
- 为 RepoWatch 和 TrendWatch 建立首批 job payload 类型与幂等键
- 实现基于规则的 `TopicWatch v1`：
  - repo binding
  - keyword / alias matching
  - evidence 记录
- 提供 fixture 回放能力和 replay 命令
- 记录最小观测指标：
  - job 成功率
  - 失败率
  - 重试次数
  - 队列堆积量

本阶段不做：

- 用户可见的完整 Today 页面
- LLM 渲染
- 多渠道通知
- 真正的问答体验

验收标准：

- 可通过 fixture 或 live smoke test 拉取至少一个 repo 与一个 trending scope 的数据
- `raw_signal / raw_snapshot` 能稳定落库，并具备去重能力
- `normalize_raw_signal` 能产生 `canonical_entity / canonical_event`
- `match_event_to_topics` 能为规则命中的事件写入 `topic_evidence`
- `build_trend_diff` 能生成新上榜、掉榜、排名变化结果
- `score_canonical_event` 能写出可解释的 `feature_breakdown`
- 同一输入重复执行时，不产生重复 canonical/intelligence 记录

### 阶段 3：第一条端到端垂直链路

对应目标：完成 `M2 -> M3` 的第一条可消费产品链路，让用户能不刷 GitHub 而直接消费一份最小日报。

本阶段只做：

- 落产品输出相关表迁移：
  - `digest`
  - `digest_section`
  - `recommended_item`
  - 如需最小历史能力，可同时落 `feedback`
- 实现 `digest.build`
  - `build_digest_skeleton`
  - `build_recommended_items`
  - `render_digest_with_llm`（可选，有 deterministic fallback）
- 打通第一条用户链路：
  - API: watch CRUD、digest 查询、history 列表
  - Web: `Today`、`Watches`、`History` 最小页面
  - 产出一份包含 repo/trend/recommended section 的日报
- 推荐阅读先基于规则打分与 evidence 回指，不做个性化学习
- 保存历史 digest，支撑最小回看能力

本阶段仍不做：

- 深度 Ask 能力
- Email / Slack / Telegram / Discord 通知
- 团队协作
- 周报 / 月报
- 个性化反馈学习闭环

验收标准：

- 用户可创建至少一个 RepoWatch 和一个 TrendWatch
- 定时或手动触发后，可生成一份 workspace 级日报
- 日报至少包含：
  - Top stories
  - Repo summary
  - Trend summary
  - Recommended items
- 每条推荐对象都能回指上游 canonical/intelligence 依据
- Web 端可以查看当天 digest 和历史 digest 列表
- 无 LLM key 时仍能输出可读摘要；有 LLM key 时可覆盖为润色版本

## 5. 每阶段验收总表

| 阶段 | 核心结果 | 可运行性 | 可验证性 |
|---|---|---|---|
| 阶段 1 | monorepo 骨架、基础表、基础 app、ADR | 四个 app 可启动 | `lint/typecheck/test/migrate` 可通过 |
| 阶段 2 | Raw/Canonical/Intelligence 主链路 | scheduler + worker 可实际跑数据 | fixture/live smoke test 可验证落库与幂等 |
| 阶段 3 | 第一条日报垂直链路 | Web/API/Worker 可联动产出 digest | 可生成、查看、回溯日报并追踪证据 |

## 6. 关键 ADR 列表

建议在正式编码前，至少补齐以下 ADR：

### 阶段 1 前必须冻结

1. `ADR-001` 运行时基线
   - Node.js 24 LTS
   - TypeScript
   - ESM
   - 包导出规范
2. `ADR-002` Monorepo 策略
   - `pnpm workspace` 作为初期唯一编排层
   - 包间依赖边界与发布策略
3. `ADR-003` 数据访问与迁移方案
   - Drizzle + SQL-first migration
   - schema 组织方式
4. `ADR-004` 队列命名、job payload、幂等键规范
   - BullMQ queue naming
   - `job_run` 记录规范

### 阶段 2 前必须冻结

5. `ADR-005` GitHub 接入策略
   - public repo poll-first
   - REST/GraphQL 组合边界
   - token / rate limit 策略
6. `ADR-006` Canonical Event 与 Entity 命名规范
   - event type 集合
   - dedupe key 生成规则
7. `ADR-007` TopicWatch v1 规则模型
   - alias、binding、evidence 类型
   - 手工规则优先，学习后置
8. `ADR-008` Trending / Weekly Rank 抓取适配策略
   - 抓快照还是解析 API
   - 页面结构变化应对策略

### 阶段 3 前必须冻结

9. `ADR-009` Digest 生成策略
   - deterministic skeleton first
   - LLM second
   - fallback 与版本字段
10. `ADR-010` 前后端契约策略
    - API schema 共用方式
    - Zod 校验边界
11. `ADR-011` 本地开发与测试数据策略
    - fixture、smoke test、live test 的边界
12. `ADR-012` 初始鉴权与 workspace 模型
    - 阶段 1-3 是否先采用单用户 dev 模式
    - 后续如何平滑升级到真实登录体系

## 7. 风险与待确认项

### 7.1 GitHub 认证与配额

待确认：

- 阶段 1-3 使用单个 PAT、多个 PAT，还是 GitHub App 凭证预留接口
- 是否需要为不同 workspace 隔离 token

风险：

- 如果不先冻结 token/rate limit 策略，`ingest.poll` 很容易在早期就遇到配额瓶颈

### 7.2 Trending 与 Weekly Rank 源稳定性

待确认：

- Weekly Rank 采用哪一个稳定源
- 是否允许先只做 Trending，保留 Weekly Rank 抽象位

风险：

- 页面结构或第三方源变化会直接影响 `raw_snapshot` 与 `trend_diff`

### 7.3 TopicWatch 初始规则来源

待确认：

- 第一批 Topic 模板由谁维护
- 是放在数据库中管理，还是先以 seed/fixture 固化

风险：

- 如果 Topic 规则没有可维护来源，阶段 2 的 `topic.match` 很难验证质量

### 7.4 Digest 时间窗口与时区语义

待确认：

- digest 以 workspace 时区还是 source 时区计算
- daily digest 的截断点和延迟容忍度是多少

风险：

- 若窗口语义不明确，会导致重复摘要、漏摘要或趋势 diff 时间错位

### 7.5 LLM 供应商与成本边界

待确认：

- 阶段 3 是否接入真实 LLM
- 使用哪个 provider、模型与超时/降级策略

风险：

- 如果没有 deterministic fallback，摘要链路会被模型可用性直接卡死

### 7.6 初始鉴权方案

待确认：

- 阶段 1-3 是否允许先采用单用户 workspace 默认登录模式
- 何时引入正式登录提供方

风险：

- 如果过早引入完整鉴权，容易挤占前三阶段的主链路开发时间

### 7.7 测试策略

待确认：

- 哪些链路必须依赖真实 GitHub 数据
- 哪些链路可以用 fixture 固化

风险：

- 如果过度依赖 live API，CI 与本地验证会不稳定

## 8. 建议的下一步

在进入编码前，建议按以下顺序推进：

1. 新建 `docs/adr/` 并先补 `ADR-001` 到 `ADR-004`
2. 建立 `pnpm workspace` 骨架与根脚本
3. 落阶段 1 的基础迁移与本地运行环境
4. 再开始阶段 2 的 queue contract 与数据主链路实现

