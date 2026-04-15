# ADR Index

当前仓库的架构决策记录如下。

## 阶段 1 基线

1. [ADR-001 运行时基线：Node.js 24 LTS + TypeScript + ESM](./ADR-001-runtime-baseline.md) `Accepted`
2. [ADR-002 Monorepo 策略：pnpm workspace + 领域优先包边界](./ADR-002-monorepo-strategy.md) `Accepted`
3. [ADR-003 数据访问与迁移策略：PostgreSQL + Redis + SQL-first Migration](./ADR-003-data-access-and-migration-strategy.md) `Accepted`
4. [ADR-004 队列命名与 Job Contract：BullMQ 命名冻结与幂等约束](./ADR-004-queue-naming-and-job-contract.md) `Accepted`

## 阶段 2 基线

5. [ADR-005 GitHub 接入策略：公开源 Poll-first，私有/安装源为后续预留](./ADR-005-github-acquisition-strategy.md) `Accepted`
6. [ADR-006 Canonical Event 与 Entity 命名规范：稳定、可追溯、语义化](./ADR-006-canonical-naming-conventions.md) `Accepted`
7. [ADR-007 TopicWatch v1 规则模型：人工规则优先，证据可追溯](./ADR-007-topicwatch-v1-rule-model.md) `Accepted`
8. [ADR-008 Trending / Weekly Rank 抓取适配策略：Snapshot-first，解析与差分解耦](./ADR-008-trend-source-adaptation.md) `Accepted`

## 阶段 3 基线

9. [ADR-009 Digest 生成策略：Deterministic Skeleton First，LLM Second](./ADR-009-digest-generation-strategy.md) `Accepted`
10. [ADR-010 前后端契约策略：Zod Source of Truth，传输模型与领域模型分离](./ADR-010-api-contract-strategy.md) `Accepted`
11. [ADR-011 本地开发与测试数据策略：Fixture-first，Live Smoke 可选](./ADR-011-local-dev-and-test-data-strategy.md) `Accepted`
12. [ADR-012 初始鉴权与 Workspace 模型：先单用户 Personal Workspace，再预留升级点](./ADR-012-initial-auth-and-workspace-model.md) `Accepted`

## 多周期扩展

13. [ADR-013 多周期 Digest 窗口语义：Weekly 先按 Workspace ISO Week 落地](./ADR-013-multi-period-digest-window-semantics.md) `Accepted`
14. [ADR-014 多周期 Digest 窗口语义：Monthly 按 Workspace 自然月落地](./ADR-014-monthly-digest-window-semantics.md) `Accepted`
15. [ADR-015 Feedback Personalization v1：先做 Workspace 级显式反馈画像](./ADR-015-feedback-personalization-v1.md) `Accepted`

## 说明

- 本索引对应 `IMPLEMENTATION_PLAN.md` 中定义的完整 ADR 清单。
- 当前 ADR 以阶段 1-3 可执行为目标，不等于最终平台态的全部长期决策。
- 如果后续引入 GitHub App、真实多用户协作、个性化学习、外部开放 API 等能力，应继续新增 ADR，而不是改写已有阶段性结论。
