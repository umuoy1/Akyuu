# ADR-007｜TopicWatch v1 规则模型：人工规则优先，证据可追溯

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 2 到阶段 3 的 TopicWatch v1 数据模型、匹配规则与证据策略
- 关联文档：
  - `docs/prd.md`
  - `docs/roadmap.md`
  - `docs/architecture/data-model-draft.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

PRD 和路线图都强调，TopicWatch 是产品差异化能力，但 MVP 明确要求：

- TopicWatch 先用规则配置
- 不做复杂自动学习
- 输出必须可追溯到证据

如果不先冻结 v1 规则模型，阶段 2 的 `topic.match` 容易一开始就做成黑盒匹配，后面既难调试，也难解释给用户。

## 决策

### 1. Topic 的来源与作用域

Topic 的主数据来源固定为：

- `topic`
- `topic_alias`
- `topic_rule`

支持两类作用域：

- 系统模板 Topic：`workspace_id` 为空
- Workspace 自定义 Topic：`workspace_id` 为对应空间

### 2. v1 采用规则优先，不做学习型 Resolver

阶段 2 到阶段 3 的 TopicWatch 固定为规则驱动：

- 不使用 embedding 检索
- 不使用自动聚类生成 Topic
- 不使用反馈学习自动改写 Topic 规则

判断一个事件是否属于某个 Topic，必须来自显式规则与显式证据。

### 3. v1 支持的匹配原语

TopicWatch v1 支持以下匹配原语：

- `repo_binding`
- `keyword`
- `phrase`
- `path_binding`
- `label_binding`
- `reference_binding`
- `person_binding`

其中：

- `topic_alias` 承载别名和短语
- `topic_rule` 承载显式包含/排除规则及权重
- `repo_binding` 作为最高优先级证据

### 4. 匹配输入范围

阶段 2 到阶段 3 的匹配输入限制为已有结构化字段：

- repo full name
- 标题
- 正文摘要
- labels
- actor / participant
- linked references
- changed files 路径

说明：

- `changed files` 仅在 enrichment 已存在时参与匹配
- 没有 enrichment 的事件，不会为了 TopicWatch 额外同步重资产详情

### 5. Evidence 写入规则

每一次命中都必须写一条 `topic_evidence`，至少包含：

- `topic_id`
- `canonical_event_id`
- `evidence_type`
- `score`
- `explanation`

v1 evidence type 固定为：

- `repo_binding`
- `alias_hit`
- `keyword_hit`
- `path_hit`
- `label_hit`
- `reference_hit`
- `person_hit`

### 6. 规则计算模型

v1 采用可解释的加权规则：

- include 规则累加分数
- exclude 规则直接阻断或显著降权
- `repo_binding` 权重大于一般关键字命中
- 多条 evidence 可以叠加，但必须分别落库

是否形成最终 topic match，由阈值决定。  
阈值策略可以配置，但不做模型学习。

### 7. Topic Update 聚合边界

`aggregate_topic_window` 只做窗口级聚合，不做事实创造。

v1 `update_type` 冻结为：

- `discussion`
- `spec`
- `testing`
- `stage_candidate`

生成 `topic_update` 的依据必须来自：

- 同窗口内的 `topic_evidence`
- 上游 `canonical_event`
- 规则化聚合逻辑

### 8. 明确不做的事情

阶段 2 到阶段 3 不做：

- Topic 自动发现
- Topic 之间的自动 merge / split
- 基于大模型的主题归因
- 无证据的“推进判断”

## 结果与影响

### 正面影响

- 与 PRD 的“简化 TopicWatch”一致
- 便于调试、回放和人工修正规则
- 为后续 Topic Timeline 和 Ask 提供干净证据链

### 代价

- 规则维护成本较高
- Topic 覆盖率和召回率在早期不会很高
- 复杂跨仓库语义需要后续版本再增强

## 不在本 ADR 内解决的问题

- Topic 模板由产品还是工程维护
- 是否提供规则编辑 UI
- Topic 规则版本化的持久化方案

## 后续执行要求

- 阶段 2 实现 `topic.match` 前，先给出至少一组可回放的 Topic fixture
- 每次 Topic 命中都必须能在 UI 或日志中解释“为什么命中”
- 如未来引入学习型 Topic Resolver，必须新增 ADR 说明其与规则模型的关系
