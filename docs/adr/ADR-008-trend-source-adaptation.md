# ADR-008｜Trending / Weekly Rank 抓取适配策略：Snapshot-first，解析与差分解耦

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 2 到阶段 3 的趋势榜单源接入、快照解析和差分策略
- 关联文档：
  - `docs/prd.md`
  - `docs/roadmap.md`
  - `docs/architecture/queue-task-catalog.md`
  - `docs/architecture/data-model-draft.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

PRD 已经把趋势能力拆成两类：

- GitHub Trending 日榜 diff
- Weekly Rank 作为中期热度参考

这两类源都不是标准 repo event stream。  
如果不先冻结接入策略，阶段 2 容易把“抓页面”“解析页面”“做 diff”“做聚类”混成一个不可维护的大任务。

## 决策

### 1. 趋势源统一走 Snapshot-first

所有趋势榜单源统一采用两段式处理：

1. 先抓原始快照并写入 `raw_snapshot`
2. 再由 `normalize_raw_snapshot` 或等价任务解析为结构化 `trend_snapshot` / `trend_snapshot_item`

禁止：

- 不落原始快照就直接写结构化榜单结果
- 在抓取阶段顺手直接计算 diff

### 2. Source 命名冻结

阶段 2 到阶段 3 的趋势源命名冻结为：

- `github_trending`
- `github_weekly_rank`

说明：

- `github_weekly_rank` 表示一类外部周榜源的逻辑适配位
- 具体 provider 可以在 implementation note 中说明，但不影响上层 source 命名

### 3. Scope 规则

每个趋势源都必须显式声明 `scope`，例如：

- `global`
- `javascript`
- `typescript`
- `ai`

差分和聚类永远只在相同 `source + scope` 内进行。  
不允许把不同 scope 的榜单直接混算 diff。

### 4. GitHub Trending 是阶段 2 的必做源

阶段 2 到阶段 3：

- `github_trending` 是必做
- 至少支持 `global` 的日榜快照
- 语言分榜或方向分榜可以作为同一 adapter 的扩展 scope

### 5. Weekly Rank 是阶段 2 的预留适配位

阶段 2 到阶段 3 对 `github_weekly_rank` 的要求是：

- 保留 queue、schema、source 命名和 adapter 接口位
- 允许先只通过 fixture 或单一 provider 验证解析链路
- 如果真实外部源不稳定，可以在功能开关下关闭，不阻塞主链路

这意味着：

- Weekly Rank 接入是架构位必须存在
- 但不要求在阶段 2 就把产品体验全部做完

### 6. Diff 与聚类边界

任务边界固定为：

- `fetch_*_snapshot`：抓原始内容
- `normalize_raw_snapshot`：解析单次榜单
- `build_trend_diff`：只比较相邻快照
- `cluster_trend_items`：只基于 diff 或 snapshot item 做方向聚类

阶段 2 到阶段 3 的聚类策略优先使用规则和已有元数据，不以 LLM 为事实来源。

### 7. 源变化与失败处理

如果页面结构或 provider 返回发生变化：

- 先保留原始快照
- 标记解析失败
- 记录 `job_run` 与错误摘要
- 允许人工修 parser 后重放

原则：

- 不因解析失败丢失原始证据
- 原始快照永远是 parser 修复的依据

## 结果与影响

### 正面影响

- 趋势链路可重放、可修复、可比对
- Trending 与 Weekly Rank 可以共用上层差分框架
- 降低外部页面波动对整体系统的破坏性

### 代价

- 多了一层 raw snapshot 存储
- parser 需要长期维护
- Weekly Rank 在早期可能只有架构位，没有完整体验

## 不在本 ADR 内解决的问题

- Weekly Rank 的最终 provider 选型
- 趋势方向聚类的长期 taxonomy
- 是否增加更多榜单源

## 后续执行要求

- 阶段 2 开发趋势链路时，必须先完成 `raw_snapshot -> trend_snapshot` 的单源回放测试
- 新增任何榜单源，都必须先定义 `source` 与 `scope`，再进入 queue
- 如未来趋势聚类引入模型能力，必须新增 ADR 明确事实层与表达层边界
