# ADR-002｜Monorepo 策略：pnpm workspace + 领域优先包边界

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 1 的仓库结构、包边界与依赖方向
- 关联文档：
  - `docs/architecture/system-module-design.md`
  - `docs/roadmap.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

系统模块文档已经给出推荐结构：

- `apps/web`
- `apps/api`
- `apps/scheduler`
- `apps/worker`
- 多个 `packages/domain-*`
- 多个 `packages/infra-*`
- 多个 `packages/shared-*`

当前仓库仍是空白状态。  
如果不先冻结 monorepo 策略，阶段 1 很容易把应用逻辑、基础设施逻辑和领域逻辑混写在一起，导致后续难以演进到 Raw / Canonical / Intelligence / Product 分层。

## 决策

### 1. Monorepo 组织方式

阶段 1 采用：

- `pnpm workspace` 作为唯一 monorepo 管理方式
- 不在阶段 1 额外引入 Turbo/Nx 等编排层
- 根目录通过 `pnpm --filter` 与少量共享脚本管理开发、测试、类型检查和构建

理由：

- 当前仓库规模还不足以支撑额外编排复杂度
- 先把边界做对，比先把缓存和任务图做复杂更重要

### 2. 顶层结构冻结

仓库按以下顶层结构组织：

- `apps/`：可部署单元
- `packages/`：内部复用模块
- `docs/`：架构、ADR、implementation notes
- `scripts/`：开发与运维脚本

### 3. 包分类与职责

#### `apps/*`

只负责组合，不沉淀核心业务规则：

- `apps/web`：UI 与页面路由
- `apps/api`：HTTP 接口与鉴权入口
- `apps/scheduler`：定时派发 job
- `apps/worker`：消费队列并执行任务

#### `packages/domain-*`

只承载领域模型、用例、契约、类型和纯业务规则：

- 不直接依赖 Fastify、Next.js、BullMQ、Drizzle、Octokit 等具体实现
- 允许通过接口/port 描述外部依赖

#### `packages/infra-*`

负责具体适配器与集成：

- DB
- Queue
- GitHub
- Scraper
- LLM
- Observability

`infra-*` 可以依赖 `domain-*` 中定义的契约，但不应反向驱动领域边界。

#### `packages/shared-*`

只放跨域通用内容：

- `shared-types`
- `shared-config`
- `shared-utils`
- `shared-testing`

禁止把领域逻辑塞进 `shared-*`。

### 4. 依赖方向约束

依赖方向固定为：

`apps -> domain / infra / shared`

`infra -> domain / shared`

`domain -> shared`

`shared -> 无内部业务依赖`

附加规则：

- `apps/web` 不直接访问数据库
- `apps/scheduler` 不内嵌业务计算逻辑
- `apps/worker` 不直接实现 UI/API 契约
- `domain-*` 不直接 import `infra-*`

### 5. 发布与可见性

- 当前阶段所有内部 package 默认私有
- 不以对外 npm 发布为目标设计包结构
- 包边界服务于仓内演进，不做过早抽象

## 结果与影响

### 正面影响

- 与领域边界和部署单元保持一致
- 有利于后续把 worker 按 ingest/intel/digest/notify 拆实例
- 避免把 Next.js/Fastify/BullMQ 细节污染到领域逻辑

### 代价

- 早期需要主动维护包边界，文件可能比单体目录更多
- 一些简单功能需要跨包改动，初期开发速度会略慢

## 不在本 ADR 内解决的问题

- 是否在阶段 2 或 3 引入 Turbo/Nx
- 是否拆出更多 deployable units
- 是否需要把某些 `domain-*` 合并或进一步细分

## 后续执行要求

- 阶段 1 建仓时，按本 ADR 创建 `apps/` 与 `packages/` 目录
- 每新增一个 package，都必须说明其归属是 `domain`、`infra` 还是 `shared`
- 如果后续出现 `shared` 膨胀或循环依赖，优先回收边界，而不是继续加例外
