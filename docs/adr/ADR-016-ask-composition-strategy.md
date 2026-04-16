# ADR-016｜Ask 生成策略：Retrieval First，LLM Composition with Deterministic Fallback

- 状态：Accepted
- 日期：2026-04-17
- 决策范围：当前阶段 `Ask` 的检索、LLM 生成与降级边界
- 关联文档：
  - `docs/prd.md`
  - `docs/architecture/system-module-design.md`
  - `docs/architecture/queue-task-catalog.md`
  - `docs/architecture/data-model-draft.md`

## 背景

产品文档和模块设计都已经明确：

- `Ask` 的职责是基于 `digest/history/evidence` 做 retrieval + composition
- `LLM` 不作为事实源，只负责表达与组织
- `answer_record` 需要保存 `retrieval_context` 和 `llm_version`

当前实现只完成了 deterministic answer 组装，能够提供最小闭环，但还不满足“可追问 Agent”的目标形态。

## 决策

### 1. Ask 固定为两段式

当前阶段的 Ask 生成固定为：

1. 先做 deterministic retrieval，组装 `retrieval_context`
2. 再调用 LLM 基于 `retrieval_context` 组织回答

deterministic retrieval 负责：

- 锚定 digest / topic
- 选取 digest bullets
- 选取 recommended items
- 选取 topic summaries
- 组装 evidence 链

LLM 只负责：

- 组织答案结构
- 压缩表达
- 根据问题选择重点
- 在已有 evidence 上做叙述

### 2. LLM 不得脱离 retrieval context 自由发挥

Ask 的 LLM prompt 必须显式约束：

- 只能使用给定 `retrieval_context`
- 不得补充上下文里不存在的仓库、PR、日期、结论
- 如果上下文不足，必须明确说明“不足以判断”

### 3. 当前阶段先保持同步调用，不引入独立队列

虽然 `queue-task-catalog` 已预留：

- `ask.retrieve.retrieve_answer_context`
- `ask.retrieve.compose_answer`

但当前阶段为了尽快补齐真实可用的 Ask，先保持 API 同步调用：

- API 内完成 retrieval
- API 内调用 LLM compose
- 同步写入 `question_session` / `answer_record`

后续若 Ask 的吞吐、重试、异步 streaming 成为问题，再单独升级为队列化实现。

### 4. 保留 deterministic fallback

如果出现以下任一情况：

- 未配置 `OPENAI_API_KEY`
- provider 调用失败
- 模型返回空内容

则 Ask 必须自动回退到 deterministic answer，而不是让接口失败。

### 5. 版本记录

`answer_record.llm_version` 规则固定为：

- 成功走 LLM 时，记录实际模型名
- 回退 deterministic 时，记录 `deterministic-v1`

## 结果与影响

### 正面影响

- Ask 终于具备真实 LLM 生成能力
- 仍保持 evidence 可追溯
- 没有 key 或 provider 波动时仍可用

### 代价

- API 的 Ask 请求延迟上升
- 当前还没有 streaming 与异步重试能力

## 不在本 ADR 内解决的问题

- Ask 的 streaming 输出
- 多轮会话记忆
- `ask.retrieve` 的独立队列化
- 更细的 prompt/version 持久化字段

## 后续执行要求

- Ask 必须继续先 retrieval，再 LLM composition
- 不得让 LLM 直接读取外部源
- 当未来将 Ask 拆到队列中时，必须保持与当前 `retrieval_context` 数据结构兼容
