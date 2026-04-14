# ADR-003｜数据访问与迁移策略：PostgreSQL + Redis + SQL-first Migration

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 1 到阶段 3 的数据访问与迁移基线
- 关联文档：
  - `docs/architecture/data-model-draft.md`
  - `docs/architecture/system-module-design.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

数据模型文档已经明确：

- PostgreSQL 是主数据库
- Redis + BullMQ 是任务基础设施
- 数据严格分为 Raw / Canonical / Intelligence / Product / Ops
- 需要支持唯一约束、幂等、可追溯、高增长表分区

当前仍未确定：

- TypeScript 侧如何组织 schema
- 迁移文件如何生成与审查
- 复杂查询是依赖 ORM 还是保留 SQL 能力

如果不先冻结这部分，阶段 1 很容易出现 schema 写在应用里、迁移不可审查、索引与约束遗漏的问题。

## 决策

### 1. 主数据与队列数据分工

- PostgreSQL 作为系统主事实库
- Redis 只承担队列、缓存与短生命周期状态
- 任何需要长期追溯、重放、审计、历史查询的数据，必须进入 PostgreSQL

这意味着以下数据必须落 PostgreSQL：

- watch 配置
- raw signal / raw snapshot
- canonical entity / event
- topic / trend / score / digest
- feedback / history
- `job_run`

### 2. 数据访问层实现方式

阶段 1 冻结为：

- 使用 `Drizzle ORM` 维护 TypeScript schema
- 使用 `drizzle-kit` 生成和管理迁移
- 迁移文件以 SQL 为审查单位提交到仓库

采用这个组合的原因：

- 更贴近现有数据模型文档里的表、索引、约束设计
- 允许在复杂查询场景保留 SQL 表达能力
- 适合 monorepo 内复用类型，而不把所有访问都困在重型 ORM 生命周期里

### 3. Schema 与迁移组织方式

建议目录：

- `packages/infra-db/src/schema/`
- `packages/infra-db/src/client/`
- `packages/infra-db/migrations/`

组织原则：

- schema 按数据层或业务域拆分文件
- migration 是唯一可信的结构变更记录
- 不允许应用在启动时自动隐式修改数据库结构

### 4. 查询策略

默认策略：

- 简单 CRUD、基础关联查询：优先使用 Drizzle
- 报表型、聚合型、窗口函数查询：允许直接写参数化 SQL
- 不为“所有查询都必须 ORM 化”而牺牲可读性和执行计划

### 5. 数据约定

为避免后续再分叉，阶段 1 起统一采用：

- 主键类型：`uuid`
- 时间字段：统一使用 `timestamptz`
- 半结构化扩展字段：使用 `jsonb`
- 配置类表允许 `deleted_at`
- 事实类表默认 append-only，不做软删除

### 6. 迁移审查规则

每次 schema 变更必须显式审查：

- 主键与唯一键
- 外键
- 索引
- 默认值
- 是否影响幂等和重放

禁止做法：

- 把 migration 结果只保存在本地、不提交仓库
- 在应用启动逻辑里偷偷补表或补字段
- 把关键查询字段埋进 `jsonb`

## 结果与影响

### 正面影响

- 与数据草案文档保持一致
- 迁移变更可审查、可回放、可追踪
- 复杂查询不会被 ORM 抽象强行限制

### 代价

- 需要维护 schema 与 migration 双层资产
- 团队需要具备直接阅读 SQL 的能力
- 表设计前期需要更谨慎，不适合“边写边猜”

## 不在本 ADR 内解决的问题

- 分区在阶段 1 是否立即落地
- UUID 的具体生成位置是应用侧还是数据库侧
- 连接池和只读副本策略
- CI 中数据库容器的具体编排方式

## 后续执行要求

- 阶段 1 先落 `workspace`、`watch_*`、`job_run`、`source_cursor`
- 阶段 2 再落 Raw / Canonical / Intelligence 相关表
- 所有 digest、score、topic、trend 结果都必须能回指上游事实记录
- 如后续需要替换 ORM 或新增分析型存储，必须通过新 ADR 说明迁移成本
