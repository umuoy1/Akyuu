# ADR-011｜本地开发与测试数据策略：Fixture-first，Live Smoke 可选

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 1 到阶段 3 的本地开发、测试数据和 CI 验证策略
- 关联文档：
  - `docs/architecture/queue-task-catalog.md`
  - `IMPLEMENTATION_PLAN.md`
  - `docs/adr/ADR-005-github-acquisition-strategy.md`

## 背景

项目早期高度依赖外部源：

- GitHub API
- Trending 页面
- Weekly Rank 外部源

如果默认测试直接依赖实时外部数据，会立刻遇到：

- 配额不稳定
- 页面结构变化导致测试抖动
- CI 不可重复

实现计划已经明确，阶段 1 到阶段 3 要优先建立稳定的本地可验证主链路。

## 决策

### 1. 默认测试策略是 Fixture-first

阶段 1 到阶段 3 的默认测试和开发回放基于 fixture：

- GitHub API 响应 fixture
- Trending / Weekly Rank 原始快照 fixture
- normalize 输入输出 fixture
- digest 输入窗口 fixture

默认 CI 不依赖外网。

### 2. 测试分层

测试分为四层：

1. 单元测试
   - 领域规则
   - 打分函数
   - Topic 规则匹配
2. 解析与回放测试
   - raw fixture -> canonical/intelligence
   - raw snapshot -> trend snapshot / diff
3. 集成测试
   - 本地 PostgreSQL / Redis
   - migration、queue、repository、job handler
4. Live smoke test
   - 真实 GitHub / Trending 请求
   - 仅在显式开启时运行

### 3. Live Smoke 不是默认门禁

Live smoke test 只在以下场景运行：

- 本地手动验证
- 专门的 smoke pipeline
- 修改外部源适配器后需要人工确认

它不作为默认 CI 必过项。

### 4. Fixture 的来源与沉淀

fixture 可以来自：

- 人工整理的最小样例
- 一次性的真实采集结果脱敏后固化
- 历史线上错误样本回灌

原则：

- parser 与 normalizer 的关键 bug 修复，必须补 fixture
- 页面结构变化修复，必须留下失败样本

### 5. 本地开发基线

本地开发环境至少要支持：

- 一键启动 PostgreSQL / Redis
- seed 一个默认 personal workspace
- 回放一组最小 watch / raw / digest fixture
- 在无外网情况下也能生成一条完整的本地链路结果

### 6. CI 最小门禁

阶段 1 到阶段 3 的默认 CI 至少包括：

- `lint`
- `typecheck`
- 单元测试
- migration 测试
- 基于 fixture 的集成测试

### 7. 数据保真原则

fixture 允许裁剪和脱敏，但不应破坏关键结构：

- 事件类型
- 主体对象键
- 时间字段
- label / path / references
- 排名与 diff 所需字段

## 结果与影响

### 正面影响

- 本地和 CI 更稳定
- 外部源波动不会立刻阻塞主链路开发
- 问题修复后可沉淀为长期回归样本

### 代价

- 需要维护 fixture 资产
- fixture 太旧时，可能与真实外部源逐渐偏离

## 不在本 ADR 内解决的问题

- 测试框架的最终选型
- 是否引入录制回放工具
- 线上数据样本脱敏流程

## 后续执行要求

- 阶段 2 每新增一个 source adapter 或 normalize 规则，必须补对应 fixture
- 阶段 3 的 digest 主链路必须至少有一套完整回放 fixture
- 如未来要把 live smoke 纳入强制门禁，必须新增 ADR 说明成本与收益
