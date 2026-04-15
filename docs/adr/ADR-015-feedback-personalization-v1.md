# ADR-015｜Feedback Personalization v1：先做 Workspace 级显式反馈画像

- 状态：Accepted
- 日期：2026-04-16
- 决策范围：`feedback -> preference_profile -> rerank` 的 v1 落地方式
- 关联文档：
  - `docs/roadmap.md`
  - `docs/prd.md`
  - `docs/architecture/system-module-design.md`
  - `docs/architecture/data-model-draft.md`

## 背景

当前系统已经能收集显式 feedback，但还没有把这些反馈真正作用到排序与推荐里。

如果直接做全量个性化学习，会立刻遇到几个问题：

- 反馈目标是 `digest / recommended_item / topic_update`，不是直接的 repo / topic 主体
- 当前仍是单 workspace 的早期形态，没有必要一开始做复杂的 user-level 模型
- 现阶段缺少稳定的隐式行为流，不适合引入复杂在线学习逻辑

## 决策

### 1. v1 只做 workspace 级 preference profile

- 画像主体固定为 `subject_type = workspace`
- `subject_id = workspace_id`
- 不在 v1 引入 user-level profile

### 2. v1 只消费显式 feedback

纳入画像的信号只包括：

- `worthwhile`
- `not_worthwhile`
- `more_like_this`
- `less_like_this`

`opened / clicked` 等隐式行为先记录，不进入 v1 画像计算。

### 3. feedback 通过 metadata 映射到可重排维度

推荐类反馈在写入时补充最小 metadata：

- `itemType`
- `repoFullName`
- `href`
- `title`

`preference_profile.profile_json` 的 v1 只维护两类权重：

- `itemTypeWeights`
- `repoWeights`

### 4. v1 只影响推荐排序，不改事实层

- 不修改 `canonical_event`
- 不修改 `event_score`
- 只在 digest 推荐候选排序时叠加 `preference bonus`

## 结果与影响

### 正面影响

- feedback 不再只是记录，开始真实影响推荐结果
- 保持实现闭环短，可验证性强
- 为后续 user-level profile 和隐式行为学习保留升级路径

### 代价

- v1 的个性化仍是浅层 rerank，不是完整推荐系统
- 若 metadata 缺失，部分旧反馈无法转化成可用画像特征

## 不在本 ADR 内解决的问题

- user-level profile
- 隐式行为学习
- Topic / Trend 的个性化摘要重排
- 多 workspace / 团队共享画像
