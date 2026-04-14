# ADR-004｜队列命名与 Job Contract：BullMQ 命名冻结与幂等约束

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 1 到阶段 3 的队列命名、job envelope 与运行记录规范
- 关联文档：
  - `docs/architecture/queue-task-catalog.md`
  - `docs/architecture/system-module-design.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

队列任务目录已经定义了完整拓扑与 job 名称，但还没有冻结：

- 代码里的 queue naming 是否与文档一一对应
- job payload 至少包含哪些元数据
- `job_run` 应如何记录幂等和执行状态

如果阶段 1 不先定下这些规则，后续非常容易出现：

- 同类任务在不同地方用不同名称
- job payload 无版本号，难以演进
- 重试和重放时无法判定是否重复执行

## 决策

### 1. Queue 名称直接冻结为文档名称

阶段 1 起代码中的 queue name 直接使用文档命名，不再另起别名：

- `scheduler`
- `ingest.poll`
- `ingest.snapshot`
- `normalize.event`
- `enrich.detail`
- `topic.match`
- `trend.diff`
- `score.rank`
- `digest.build`
- `ask.retrieve`
- `notify.send`
- `maintenance.rebuild`

理由：

- 保持文档、监控、代码、运维语言一致
- 避免“文档一套、代码一套、BullMQ 面板又一套”的命名漂移

### 2. Job 名称直接冻结为任务目录名称

示例：

- `schedule_watch_poll`
- `poll_repo_events`
- `fetch_trending_snapshot`
- `normalize_raw_signal`
- `match_event_to_topics`
- `build_trend_diff`
- `score_canonical_event`
- `build_digest_skeleton`

阶段 1 到阶段 3 不对这些 job 名再做二次包装。

### 3. 统一 Job Envelope

所有进入业务队列的 job payload 必须具备统一外层结构：

```ts
type JobEnvelope<TPayload> = {
  payloadVersion: number;
  idempotencyKey: string;
  requestedAt: string;
  trigger: "scheduler" | "api" | "replay" | "manual";
  traceId?: string;
  payload: TPayload;
};
```

说明：

- `payloadVersion`：支持后续 payload 演进
- `idempotencyKey`：稳定去重键，不允许使用随机值代替
- `requestedAt`：统一审计时间
- `trigger`：标识任务来源
- `traceId`：用于日志与链路追踪

### 4. 幂等键规则

幂等键必须绑定以下维度中的必要子集：

- 对象标识
- 时间窗口或快照日期
- 规则/模型/版本

可接受示例：

- `digest:daily:{workspace_id}:{date}`
- `topic_update:{topic_id}:{window_start}:{window_end}:{version}`
- `score:event:{event_id}:{workspace_id}:{model_version}`

不接受：

- 随机 UUID
- 与业务输入无关的自增序号

### 5. `job_run` 记录规范

每个业务 job 至少要把以下字段映射到 `job_run`：

- `queue_name`
- `job_name`
- `idempotency_key`
- `status`
- `attempt_count`
- `started_at`
- `finished_at`
- `input_json`
- `output_json`
- `error_text`

状态语义固定为：

- `queued`
- `running`
- `succeeded`
- `failed`
- `dead`

### 6. 阶段 1 的最小执行策略

- 一个 `apps/worker` 进程可同时注册多个 queue handler
- 一个 `apps/scheduler` 进程只负责扫描与派发，不执行重活
- 阶段 1 至少要实现一个示例 job，用于验证 envelope、幂等键、`job_run` 落库

## 结果与影响

### 正面影响

- 队列语义、日志语义和文档语义保持一致
- 为后续重试、重放、DLQ、SLA 统计打下稳定基础
- 降低新增 job 时的命名歧义

### 代价

- 早期编写 job 时需要显式处理更多元数据
- payload 演进需要维护版本字段

## 不在本 ADR 内解决的问题

- 具体 backoff 参数和重试次数
- 各 queue 的并发数
- DLQ 的物理实现方式和运维面板
- 分布式 trace 系统的最终选型

## 后续执行要求

- 阶段 1 建立 `infra-queue` 时，必须先定义 queue name 常量与 `JobEnvelope` 类型
- 阶段 2 开始实现实际 ingest/intel job 时，不得绕过幂等键规则
- 如未来需要新增 queue 或改名，必须先更新任务目录文档并新增 ADR
