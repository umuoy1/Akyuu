# ADR-006｜Canonical Event 与 Entity 命名规范：稳定、可追溯、语义化

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 2 起的 canonical entity / event 命名、主语语义与 dedupe 规则
- 关联文档：
  - `docs/prd.md`
  - `docs/architecture/data-model-draft.md`
  - `docs/roadmap.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

路线图和 PRD 已经明确，后续所有摘要、推荐、TopicWatch 和 Ask 都建立在统一事件与实体层上。  
如果 canonical 命名不先冻结，后续会出现：

- 同一语义被多个 event name 表示
- entity key 不稳定，难以去重和关联
- `topic_evidence`、`recommended_item`、`digest_section` 回指路径混乱

## 决策

### 1. 命名风格

统一采用：

- `entity_type`：单数、`snake_case`
- `event_type`：`snake_case`
- `relation_type`：单数或短语、`snake_case`

禁止：

- 驼峰
- 复数 entity type
- 过于实现导向的内部缩写

### 2. 初始 Canonical Entity 集合

阶段 2 到阶段 3 冻结以下最小实体集合：

- `repo`
- `org`
- `pr`
- `issue`
- `release`
- `person`
- `commit`
- `topic_candidate`

说明：

- `topic` 本身属于 Intelligence / Product 语义，不直接作为 Raw-to-Canonical 的默认实体类型
- `trend_snapshot_item` 默认保留在 Intelligence Layer，不单独提升为 canonical entity

### 3. `external_source` 与 `external_key` 规则

- `external_source` 表示来源，如 `github`、`trending`、`internal`
- `external_key` 表示该来源下的稳定主键

推荐写法：

- repo：`nodejs/node`
- pr：`nodejs/node#12345`
- issue：`nodejs/node#45678`
- release：`nodejs/node@release:v22.0.0`
- commit：`nodejs/node@commit:abcdef1`
- person：`octocat`

原则：

- 优先使用人类可读且跨环境稳定的键
- 不把展示标题当作唯一键
- 外部系统的数值 ID 可保存在 `metadata`，但不作为唯一主键策略的唯一依赖

### 4. Canonical Event 语义边界

canonical event 只描述“发生了什么事实”，不描述“产品结论”。

允许的事件类型示例：

- `pr_opened`
- `pr_merged`
- `issue_opened`
- `issue_hot`
- `release_published`
- `repo_entered_trending`
- `repo_left_trending`
- `rank_moved_up`
- `proposal_discussed`

不属于 canonical event 的内容：

- `topic_update`
- `trend_diff`
- `event_score`
- `recommended_item`
- `digest_section`

这些属于 Intelligence 或 Product Layer。

### 5. 主语语义固定

`canonical_event` 中字段语义固定为：

- `subject_entity_id`：这次事件真正描述的主体
- `actor_entity_id`：触发动作的人或系统，可空
- `repo_entity_id`：所属 repo 上下文，可空

补充关系统一进入 `event_entity_relation`，例如：

- `reviewer`
- `linked_issue`
- `linked_pr`
- `topic_candidate`

### 6. Dedupe Key 规则

`canonical_event.dedupe_key` 必须描述“同一事实”而不是“同一原始 payload”。

优先顺序：

1. 外部系统已提供稳定事件 ID 时，基于该 ID 组装语义键
2. 没有稳定事件 ID 时，使用 `event_type + subject + occurred_at + discriminator`
3. 只有在完全没有稳定主语字段时，才允许退化为 payload hash 辅助去重

可接受示例：

- `github:pr_opened:nodejs/node#12345`
- `github:pr_merged:nodejs/node#12345:2026-04-15T09:10:00Z`
- `trending:repo_entered_trending:global:nodejs/node:2026-04-15`

禁止：

- 用随机 UUID 充当 dedupe key
- 直接把整段 JSON 序列化为 dedupe key

### 7. 元数据边界

`metadata` 只承载：

- 调试上下文
- 非主查询字段
- 来源补充字段

以下字段不得只存在于 `metadata`：

- subject 唯一标识
- repo 唯一标识
- 事件类型
- 去重判定所需核心字段

## 结果与影响

### 正面影响

- 为 normalize、topic match、digest traceability 提供稳定基础
- 有利于后续引入 replay、backfill 与 Ask
- 减少“同一事实多种命名”的长期污染

### 代价

- 早期需要更认真地定义实体与事件边界
- 某些边缘 GitHub 事件需要先做映射裁剪，而不是全量照搬

## 不在本 ADR 内解决的问题

- 低价值 GitHub 事件是否全部归一
- `confidence` 分值的具体计算方式
- 多 source 合并为同一 canonical event 的复杂策略

## 后续执行要求

- 阶段 2 实现 normalize 时，先定义 event/entity 常量集，再写映射逻辑
- 新增 event type 前，必须先判断它是否属于 canonical 事实还是 intelligence 结果
- 如实体集合需要扩容，先更新本 ADR 或新增补充 ADR
