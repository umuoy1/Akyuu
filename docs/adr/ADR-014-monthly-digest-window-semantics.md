# ADR-014｜多周期 Digest 窗口语义：Monthly 按 Workspace 自然月落地

- 状态：Accepted
- 日期：2026-04-16
- 决策范围：`monthly digest` 的时间窗口语义与阶段性实现边界
- 关联文档：
  - `docs/prd.md`
  - `docs/architecture/data-model-draft.md`
  - `docs/architecture/queue-task-catalog.md`
  - `docs/adr/ADR-009-digest-generation-strategy.md`
  - `docs/adr/ADR-013-multi-period-digest-window-semantics.md`

## 背景

当前系统已经落地 `daily` 与 `weekly` digest，产品文档中还要求支持 `monthly digest`。

如果不先冻结 monthly 的窗口语义，后续会在下面几个点上重复摇摆：

- 月窗口是自然月还是滚动 30 天
- `date` 参数表示月初、月末，还是月内任意锚点日
- History 中 monthly 与 daily / weekly 是否共享同一套闭开区间表达

## 决策

### 1. Monthly 采用 workspace 时区下的自然月

- 以 `workspace.timezone` 为准
- 月起点固定为当月 1 日 `00:00`
- 月终点固定为次月 1 日 `00:00`
- 窗口表达采用闭开区间 `[window_start, window_end)`

### 2. API 中的 `date` 表示“该月内任意本地日期”

对于 `digest_type = monthly`：

- `date` 表示“该月内的某个本地日期”
- 系统根据该日期反推出所属自然月的 `window_start` 与 `window_end`

这样可以保持与 `daily / weekly` 一致的 API 形态，不增加新的 `month` 或 `month_start` 参数。

### 3. Monthly 先复用现有事实层，不引入独立月聚合表

阶段性 monthly digest 允许直接聚合：

- `canonical_event`
- `topic_update`
- `trend_diff`
- `event_score`

不额外引入 `monthly_topic_update`、`monthly_trend_summary` 等中间表。

### 4. Monthly 与 History / Delivery 使用同一份 digest 记录

- `digest.digest_type = monthly`
- `window_start / window_end` 作为唯一时间窗口
- History、Ask、Delivery 不建立 monthly 专用表

## 结果与影响

### 正面影响

- `monthly digest` 可以在现有数据底座上快速接入
- 三种周期统一为“锚点日期 -> 时区窗口 -> digest 记录”的处理方式
- History 与 Delivery 不需要为 monthly 单独分叉

### 代价

- monthly 的 topic / trend 仍是窗口聚合，不是专门月级 intelligence
- 在数据量增大后，monthly 聚合可能需要额外缓存或预计算

## 不在本 ADR 内解决的问题

- 月报专属 section 排版与 narrative 模板
- 月报与 weekly rank 的专用融合策略
- 面向团队周会 / 月会的定向模板
