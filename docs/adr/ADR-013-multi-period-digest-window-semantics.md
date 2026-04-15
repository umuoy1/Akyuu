# ADR-013｜多周期 Digest 窗口语义：Weekly 先按 Workspace ISO Week 落地

- 状态：Accepted
- 日期：2026-04-16
- 决策范围：`weekly digest` 的时间窗口语义与阶段性实现边界
- 关联文档：
  - `docs/prd.md`
  - `docs/architecture/data-model-draft.md`
  - `docs/architecture/queue-task-catalog.md`
  - `docs/adr/ADR-009-digest-generation-strategy.md`

## 背景

当前系统已经有 `digest.digest_type = daily/weekly/monthly` 的模型位，但真正落地的只有 daily。

如果不先冻结 weekly 的窗口语义，后续会在下面几个点上反复摇摆：

- 周窗口是滚动 7 天，还是自然周
- 周起点是周一还是周日
- `date` 参数表示窗口结束日还是窗口内任意日

## 决策

### 1. 阶段性只冻结 weekly，不同时冻结 monthly

本 ADR 只解决 `weekly digest`。

`monthly digest` 暂不进入实现，避免一次同时引入两个窗口语义。

### 2. Weekly 采用 workspace 时区下的 ISO week

- 以 `workspace.timezone` 为准
- 周起点固定为周一 `00:00`
- 周终点固定为下周一 `00:00`
- 窗口表达仍采用闭开区间 `[window_start, window_end)`

### 3. API 中的 `date` 表示“锚点日期”

对于 `digest_type = weekly`：

- `date` 表示“该周内的某个本地日期”
- 系统根据该日期反推出所属 ISO week 的 `window_start` 与 `window_end`

这样可以保持和 daily 一致的调用方式，不额外增加 `week_start` 参数。

### 4. Weekly digest 先复用现有事实层，不新增独立周聚合表

阶段性 weekly digest 允许直接聚合：

- `canonical_event`
- `topic_update`
- `trend_diff`
- `event_score`

不额外引入 `weekly_topic_update` 等新表。

## 结果与影响

### 正面影响

- weekly 可在现有数据底座上快速落地
- 窗口语义和 daily 一致，便于后续 History 展示
- 避免“滚动 7 天”和“自然周”混用

### 代价

- weekly 的 topic/trend 仍是对现有日级结果的窗口聚合，不是专门的周级 intelligence

## 不在本 ADR 内解决的问题

- monthly digest 的窗口语义
- weekly rank 外部源如何并入 weekly digest
- 周报专属 section 结构与排版
