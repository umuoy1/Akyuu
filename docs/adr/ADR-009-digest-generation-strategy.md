# ADR-009｜Digest 生成策略：Deterministic Skeleton First，LLM Second

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 3 的 digest 生成链路、时间窗口语义和降级策略
- 关联文档：
  - `docs/prd.md`
  - `docs/architecture/system-module-design.md`
  - `docs/architecture/queue-task-catalog.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

系统模块文档和队列目录都已经明确：

- `build_digest_skeleton`
- `render_digest_with_llm`
- `build_recommended_items`
- LLM 只做表达层

如果不先冻结 digest 策略，阶段 3 很容易出现两个问题：

- 把事实抽取和文案生成混在一起，导致不可追溯
- 一旦 LLM 不可用，整条日报链路直接失效

## 决策

### 1. 生成链路固定为两段式

阶段 3 的 digest 生成固定为：

1. 先生成 deterministic skeleton
2. 再可选调用 LLM 进行结构化润色

deterministic skeleton 负责：

- 候选项筛选
- section 分组
- 推荐阅读排序
- 结构化摘要
- 证据回指

LLM 只负责：

- 压缩表达
- 组织 Markdown
- 提升可读性

### 2. Digest 只消费内部事实层

`digest.build` 不允许直接访问外部源。  
它只允许读取：

- `canonical_event`
- `topic_update`
- `trend_diff`
- `event_score`
- `recommended_item` 的上游候选

这保证 digest 永远建立在内部已落库的事实和 intelligence 上。

### 3. 阶段 3 的最小 section 集合

阶段 3 的 daily digest 至少包含：

- `top_stories`
- `repo`
- `trend`
- `recommended`

`topic` section 在 TopicWatch 主链路足够稳定时可加入，但不是阶段 3 的必过项。

### 4. 时间窗口语义

daily digest 的窗口语义冻结为：

- 以 `workspace.timezone` 为准
- `digest_type = daily` 时，`window_start` 与 `window_end` 表示该 workspace 本地日历日的闭开区间
- 对于某个目标日期 `D`，窗口为 `[D 00:00, D+1 00:00)`

补充规则：

- queue 中的 `date` 指“被总结的本地日期”，不是发送时间
- digest 展示时必须显示绝对日期范围，避免只写“今天/昨天”造成歧义

### 5. 降级策略

- `build_digest_skeleton` 成功是 digest 可交付的最低条件
- 即使 `render_digest_with_llm` 失败，也必须产出 deterministic Markdown
- 只有 skeleton 构建失败时，digest 才应进入 `failed`

### 6. 推荐阅读与证据链

每个 `recommended_item` 必须具备：

- 上游来源类型
- 上游来源 ID
- 推荐分
- 推荐理由结构

这意味着：

- 推荐项不能只保存最终 Markdown 文案
- 用户看到的结论必须能回指到 canonical 或 intelligence 依据

### 7. 版本记录

digest 生成至少要在 `job_run` 中记录：

- skeleton version
- prompt version
- model version

如果 schema 能承载，则额外保存到 `digest` 或 `digest_section`；  
如果当前 schema 不足，允许先记在 `job_run.output_json`，但不能完全不记版本。

## 结果与影响

### 正面影响

- 与“LLM 只做表达层”的原则一致
- digest 可降级、可追溯、可重放
- 后续 Topic / Ask 接入时不会破坏已有事实链

### 代价

- 需要维护 deterministic 摘要逻辑
- 生成链路比“直接让 LLM 写全文”更啰嗦

## 不在本 ADR 内解决的问题

- 日报的具体排版与视觉设计
- 周报 / 月报的 section 结构
- LLM provider 与模型选型

## 后续执行要求

- 阶段 3 开发 `digest.build` 时，先实现 skeleton，再接 LLM
- 没有 LLM key 的本地环境也必须能生成可读 digest
- 每次 digest 渲染都必须能追到其上游版本与输入窗口
