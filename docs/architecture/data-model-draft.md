# GitHub 监控聚合 Agent｜数据表草案文档

## 1. 文档目的

本文档用于把产品与模块设计，进一步落到数据库层。  
目标不是直接写最终 DDL，而是先给出：

- 数据分层
- 表的职责
- 核心字段
- 唯一键 / 索引建议
- 分区和演进建议

默认数据库：**PostgreSQL**

---

## 2. 数据分层总览

```text
Raw Layer
  - raw_signal
  - raw_snapshot
  - source_cursor

Canonical Layer
  - canonical_entity
  - canonical_event
  - event_entity_relation

Intelligence Layer
  - topic / topic_alias / topic_rule
  - topic_evidence / topic_update
  - trend_snapshot / trend_snapshot_item / trend_diff
  - event_score
  - recommended_item

Product Layer
  - workspace / app_user / membership
  - watch_target / watch_rule / watch_schedule
  - digest / digest_section
  - feedback / preference_profile
  - question_session / answer_record
  - outbound_notification

Ops Layer
  - job_run
  - rate_limit_bucket
  - config_entry
  - audit_log
```

---

## 3. 命名与设计约定

### 3.1 主键约定
建议统一使用：
- `uuid` 或 `ulid`
- 表内主键字段统一命名为 `id`

### 3.2 时间字段
每张表至少考虑：
- `created_at`
- `updated_at`

事件/快照类表建议另有：
- `occurred_at`
- `captured_at`
- `window_start`
- `window_end`

### 3.3 JSON 使用策略
以下场景使用 `jsonb`：
- 原始 payload
- 半结构化 metadata
- LLM debug context
- 扩展字段

避免把核心查询字段埋进 `jsonb`。

### 3.4 软删除
产品配置类表建议使用：
- `deleted_at`

事实表不建议软删除，尽量 append-only。

---

## 4. Product Layer：用户与配置

## 4.1 `workspace`

### 用途
表示个人空间或团队空间。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| name | text | 空间名称 |
| slug | text | 唯一标识 |
| plan_tier | text | free/pro/team 等 |
| timezone | text | 默认时区 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 索引建议
- unique(slug)

---

## 4.2 `app_user`

### 用途
系统用户。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| email | citext | 唯一邮箱 |
| display_name | text | 展示名 |
| avatar_url | text | 头像 |
| last_login_at | timestamptz | 最近登录 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 索引建议
- unique(email)

---

## 4.3 `workspace_member`

### 用途
用户与空间关系。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | FK |
| user_id | uuid | FK |
| role | text | owner/admin/member |
| created_at | timestamptz | 创建时间 |

### 索引建议
- unique(workspace_id, user_id)

---

## 4.4 `watch_target`

### 用途
统一的关注对象定义。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | 所属空间 |
| type | text | repo/topic/trend/rank_feed |
| name | text | 用户可见名称 |
| status | text | active/paused/archived |
| priority | smallint | 1~5 |
| config | jsonb | 各类型配置 |
| created_by | uuid | 创建者 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |
| deleted_at | timestamptz | 软删除 |

### 典型 config
- repo：`{ owner, repo, branches?, labels?, rules? }`
- topic：`{ aliases, keywords, repo_bindings, people_bindings }`
- trend：`{ source, language?, since=daily }`
- rank_feed：`{ source, cadence=weekly }`

### 索引建议
- index(workspace_id, type, status)
- gin(config)

---

## 4.5 `watch_rule`

### 用途
把复杂规则从 `watch_target.config` 中拆出来，便于查询和演进。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| watch_target_id | uuid | FK |
| rule_type | text | keyword/repo_binding/path_binding/label_binding/person_binding |
| operator | text | include/exclude/regex/exact |
| value | text | 规则内容 |
| weight | numeric | 规则权重 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- index(watch_target_id, rule_type)

---

## 4.6 `watch_schedule`

### 用途
定义摘要与采集节奏。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| watch_target_id | uuid | FK |
| cadence | text | realtime/daily/weekly/monthly |
| cron_expr | text | cron 表达式 |
| enabled | boolean | 是否启用 |
| last_run_at | timestamptz | 最近触发 |
| next_run_at | timestamptz | 下次触发 |

### 索引建议
- index(enabled, next_run_at)

---

## 5. Raw Layer：原始信号与快照

## 5.1 `source_cursor`

### 用途
记录采集进度、ETag、last seen 等。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| source_type | text | github_repo_events/trending/weekly_rank/... |
| source_key | text | 唯一源键 |
| etag | text | 条件请求缓存 |
| last_seen_external_id | text | 最近外部事件 ID |
| last_polled_at | timestamptz | 最近轮询 |
| next_poll_after | timestamptz | 下一次建议轮询 |
| state | jsonb | 额外状态 |
| updated_at | timestamptz | 更新时间 |

### 索引建议
- unique(source_type, source_key)

---

## 5.2 `raw_signal`

### 用途
存 GitHub 事件、PR/issue/release 详情等原始信号。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| source_type | text | github_event/github_pr_detail/... |
| source_key | text | 来源标识 |
| external_id | text | 外部对象唯一 ID |
| occurred_at | timestamptz | 外部发生时间 |
| captured_at | timestamptz | 系统采集时间 |
| payload | jsonb | 原始 payload |
| payload_hash | text | 去重 hash |
| ingest_job_id | uuid | 产生它的 job_run |
| created_at | timestamptz | 入库时间 |

### 索引建议
- unique(source_type, source_key, external_id)
- index(captured_at)
- index(occurred_at)
- gin(payload)

### 分区建议
按 `captured_at` 月分区。

---

## 5.3 `raw_snapshot`

### 用途
存趋势榜单等页面快照。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| source_type | text | trending/weekly_rank/... |
| source_key | text | 如 `trending:global:daily` |
| snapshot_date | date | 快照日期 |
| captured_at | timestamptz | 采集时间 |
| content_format | text | html/json/markdown |
| content | text | 原始快照内容 |
| content_hash | text | 去重 hash |
| meta | jsonb | 额外信息 |

### 索引建议
- unique(source_type, source_key, snapshot_date)

---

## 6. Canonical Layer：统一事实层

## 6.1 `canonical_entity`

### 用途
统一实体表，用于抽象 repo / pr / issue / release / person / topic_candidate 等。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| entity_type | text | repo/pr/issue/release/person/topic_candidate/... |
| external_source | text | github/trending/internal |
| external_key | text | 外部主键，如 `nodejs/node#123` |
| display_name | text | 展示名 |
| normalized_name | text | 归一化名称 |
| metadata | jsonb | 半结构化元数据 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 索引建议
- unique(entity_type, external_source, external_key)
- index(entity_type, normalized_name)

---

## 6.2 `canonical_event`

### 用途
系统内部统一事件事实层。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| event_type | text | pr_opened/pr_merged/... |
| occurred_at | timestamptz | 事件发生时间 |
| window_start | timestamptz | 聚合窗口起点，可空 |
| window_end | timestamptz | 聚合窗口终点，可空 |
| source_signal_id | uuid | 对应 raw_signal，可空 |
| source_snapshot_id | uuid | 对应 raw_snapshot，可空 |
| subject_entity_id | uuid | 主体实体 |
| actor_entity_id | uuid | 行为实体，可空 |
| repo_entity_id | uuid | 所属 repo，可空 |
| confidence | numeric | 0~1 |
| metadata | jsonb | 附加事件信息 |
| dedupe_key | text | 幂等去重键 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- unique(dedupe_key)
- index(event_type, occurred_at desc)
- index(repo_entity_id, occurred_at desc)
- index(subject_entity_id, occurred_at desc)

### 分区建议
按 `occurred_at` 月分区。

---

## 6.3 `event_entity_relation`

### 用途
补充事件与多个实体之间的关系。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| canonical_event_id | uuid | FK |
| entity_id | uuid | FK |
| relation_type | text | repo/actor/reviewer/linked_issue/linked_pr/topic_candidate/... |
| weight | numeric | 关系权重 |
| metadata | jsonb | 附加信息 |

### 索引建议
- index(canonical_event_id)
- index(entity_id, relation_type)

---

## 7. Intelligence Layer：主题、趋势、评分、推荐

## 7.1 `topic`

### 用途
显式主题定义。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | 所属空间，可为空表示系统模板 |
| name | text | 主题名 |
| slug | text | 主题唯一键 |
| description | text | 描述 |
| status | text | active/paused/archived |
| metadata | jsonb | 额外元信息 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 索引建议
- unique(workspace_id, slug)

---

## 7.2 `topic_alias`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| topic_id | uuid | FK |
| alias | text | 别名 |
| alias_type | text | keyword/repo/path/person/phrase |
| weight | numeric | 匹配权重 |

### 索引建议
- index(topic_id)
- index(alias_type, alias)

---

## 7.3 `topic_rule`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| topic_id | uuid | FK |
| rule_type | text | keyword/repo_binding/label_binding/path_binding/reference_binding |
| operator | text | include/exclude/regex/exact |
| value | text | 值 |
| weight | numeric | 权重 |
| enabled | boolean | 是否启用 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- index(topic_id, rule_type, enabled)

---

## 7.4 `topic_evidence`

### 用途
记录 topic 与 canonical event 的证据关系。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| topic_id | uuid | FK |
| canonical_event_id | uuid | FK |
| evidence_type | text | title_hit/body_hit/repo_binding/linked_reference/... |
| score | numeric | 证据分 |
| explanation | text | 证据解释 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- unique(topic_id, canonical_event_id, evidence_type)
- index(topic_id, score desc)

---

## 7.5 `topic_update`

### 用途
topic 在某时间窗口内的聚合结论。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| topic_id | uuid | FK |
| window_start | timestamptz | 窗口起点 |
| window_end | timestamptz | 窗口终点 |
| update_type | text | discussion/spec/testing/stage_candidate/... |
| importance_score | numeric | 重要性 |
| summary_struct | jsonb | 结构化摘要 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- index(topic_id, window_end desc)
- index(update_type, importance_score desc)

---

## 7.6 `trend_snapshot`

### 用途
某个榜单的一次逻辑快照。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| source | text | github_trending/github_weekly_rank |
| scope | text | global/javascript/ai/... |
| snapshot_date | date | 日期 |
| raw_snapshot_id | uuid | FK |
| captured_at | timestamptz | 采集时间 |
| metadata | jsonb | 额外信息 |

### 索引建议
- unique(source, scope, snapshot_date)

---

## 7.7 `trend_snapshot_item`

### 用途
某次快照中的具体仓库项。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| trend_snapshot_id | uuid | FK |
| rank | integer | 当前排名 |
| repo_full_name | text | owner/repo |
| language | text | 语言 |
| description | text | 简述 |
| metric_primary | numeric | 如 stars_today / weekly_growth |
| metric_secondary | numeric | 备用指标 |
| metadata | jsonb | 额外信息 |

### 索引建议
- unique(trend_snapshot_id, repo_full_name)
- index(repo_full_name)
- index(trend_snapshot_id, rank)

---

## 7.8 `trend_diff`

### 用途
相邻两个快照的差异结果。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| source | text | 榜单源 |
| scope | text | 范围 |
| snapshot_date | date | 当前日期 |
| compared_to_date | date | 对比日期 |
| diff_struct | jsonb | 新上榜、掉榜、排名变化等 |
| summary_struct | jsonb | 聚类后的高层摘要 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- unique(source, scope, snapshot_date, compared_to_date)

---

## 7.9 `event_score`

### 用途
记录事件/主题/趋势项的评分结果。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| target_type | text | canonical_event/topic_update/trend_diff_item |
| target_id | uuid | 目标 ID |
| workspace_id | uuid | 可按空间个性化 |
| score_type | text | importance/recommendation/personalized_rank |
| score | numeric | 分值 |
| feature_breakdown | jsonb | 特征拆解 |
| model_version | text | 打分版本 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- unique(target_type, target_id, workspace_id, score_type, model_version)
- index(workspace_id, score_type, score desc)

---

## 7.10 `recommended_item`

### 用途
存日报/周报中的推荐阅读结果。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | 所属空间 |
| digest_id | uuid | FK，可空（预计算场景） |
| item_type | text | pr/issue/repo/topic/release |
| item_entity_id | uuid | 对应实体 |
| source_target_type | text | canonical_event/topic_update/trend_diff |
| source_target_id | uuid | 上游来源 |
| rank | integer | 排名 |
| score | numeric | 推荐分 |
| reason_struct | jsonb | 推荐理由 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- index(digest_id, rank)
- index(workspace_id, created_at desc)

---

## 8. Product Layer：摘要、追问、反馈、通知

## 8.1 `digest`

### 用途
日报/周报/月报主表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | 所属空间 |
| digest_type | text | daily/weekly/monthly |
| window_start | timestamptz | 时间窗口开始 |
| window_end | timestamptz | 时间窗口结束 |
| status | text | building/ready/failed |
| title | text | 标题 |
| summary_struct | jsonb | 结构化总摘要 |
| rendered_markdown | text | 渲染版 Markdown |
| llm_version | text | 生成版本 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 索引建议
- unique(workspace_id, digest_type, window_start, window_end)
- index(status, created_at desc)

---

## 8.2 `digest_section`

### 用途
日报分区块。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| digest_id | uuid | FK |
| section_type | text | top_stories/repo/topic/trend/recommended/... |
| title | text | 区块标题 |
| rank | integer | 顺序 |
| summary_struct | jsonb | 结构化内容 |
| rendered_markdown | text | Markdown |
| created_at | timestamptz | 创建时间 |

### 索引建议
- index(digest_id, rank)

---

## 8.3 `question_session`

### 用途
追问会话。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | 所属空间 |
| user_id | uuid | 提问者 |
| anchor_type | text | digest/topic/history/search |
| anchor_id | uuid | 锚点对象，可空 |
| question | text | 提问内容 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- index(workspace_id, created_at desc)
- index(user_id, created_at desc)

---

## 8.4 `answer_record`

### 用途
保存追问回答及其检索上下文。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| question_session_id | uuid | FK |
| answer_markdown | text | 回答 |
| retrieval_context | jsonb | 检索片段与证据 |
| llm_version | text | 模型版本 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- unique(question_session_id)

---

## 8.5 `feedback`

### 用途
用户对条目/推荐/摘要的显式反馈。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | 所属空间 |
| user_id | uuid | 用户 |
| target_type | text | digest/recommended_item/topic_update/... |
| target_id | uuid | 目标 |
| feedback_type | text | worthwhile/not_worthwhile/more_like_this/less_like_this/opened/clicked |
| value | numeric | 可选权重 |
| metadata | jsonb | 额外信息 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- index(user_id, created_at desc)
- index(target_type, target_id)

---

## 8.6 `preference_profile`

### 用途
用户/空间偏好画像。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | 所属空间 |
| subject_type | text | workspace/user |
| subject_id | uuid | 用户或空间 |
| profile_json | jsonb | 画像内容 |
| version | text | 画像版本 |
| updated_at | timestamptz | 更新时间 |

### 索引建议
- unique(workspace_id, subject_type, subject_id)

---

## 8.7 `outbound_notification`

### 用途
统一通知发送记录。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | 所属空间 |
| channel | text | email/slack/telegram/webhook |
| target_address | text | 接收端 |
| content_ref_type | text | digest/alert |
| content_ref_id | uuid | 对应内容 |
| status | text | pending/sent/failed |
| attempt_count | integer | 尝试次数 |
| last_error | text | 最近错误 |
| created_at | timestamptz | 创建时间 |
| sent_at | timestamptz | 发送时间 |

### 索引建议
- index(status, created_at)
- index(channel, sent_at desc)

---

## 9. Ops Layer：任务与治理

## 9.1 `job_run`

### 用途
记录各类异步任务运行情况。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| queue_name | text | 队列名 |
| job_name | text | 任务名 |
| idempotency_key | text | 幂等键 |
| status | text | queued/running/succeeded/failed/dead |
| input_json | jsonb | 输入 |
| output_json | jsonb | 输出 |
| error_text | text | 错误信息 |
| attempt_count | integer | 重试次数 |
| started_at | timestamptz | 开始时间 |
| finished_at | timestamptz | 完成时间 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- unique(queue_name, idempotency_key)
- index(status, created_at desc)
- index(job_name, created_at desc)

---

## 9.2 `rate_limit_bucket`

### 用途
保存外部 API 配额状态。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| provider | text | github_rest/github_graphql/... |
| credential_key | text | token/app installation 等 |
| bucket_key | text | 资源桶 |
| remaining | integer | 剩余配额 |
| reset_at | timestamptz | 重置时间 |
| metadata | jsonb | 附加信息 |
| updated_at | timestamptz | 更新时间 |

### 索引建议
- unique(provider, credential_key, bucket_key)

---

## 9.3 `config_entry`

### 用途
系统级配置与 feature flag。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| scope | text | global/workspace |
| scope_id | uuid | 作用域 ID，可空 |
| config_key | text | 配置键 |
| config_value | jsonb | 配置值 |
| updated_at | timestamptz | 更新时间 |

### 索引建议
- unique(scope, scope_id, config_key)

---

## 9.4 `audit_log`

### 用途
关键配置和动作审计。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| workspace_id | uuid | 所属空间 |
| actor_user_id | uuid | 操作者 |
| action_type | text | create_watch/update_rule/send_digest/... |
| target_type | text | 操作对象类型 |
| target_id | uuid | 操作对象 ID |
| payload | jsonb | 审计内容 |
| created_at | timestamptz | 创建时间 |

### 索引建议
- index(workspace_id, created_at desc)
- index(action_type, created_at desc)

---

## 10. 建议优先落地的表

第一阶段最建议优先落地以下表：

1. `workspace`
2. `app_user`
3. `watch_target`
4. `watch_rule`
5. `watch_schedule`
6. `source_cursor`
7. `raw_signal`
8. `raw_snapshot`
9. `canonical_entity`
10. `canonical_event`
11. `topic`
12. `topic_rule`
13. `topic_evidence`
14. `trend_snapshot`
15. `trend_snapshot_item`
16. `trend_diff`
17. `event_score`
18. `digest`
19. `digest_section`
20. `recommended_item`
21. `feedback`
22. `job_run`

---

## 11. 分区与归档建议

### 高增长表
- `raw_signal`
- `canonical_event`
- `job_run`

### 分区策略
- 按月分区优先
- 超过一定体量再考虑冷热分层

### 归档建议
- raw 层保留最久
- intelligence 可重算的内容按版本重建
- digest 与 feedback 作为产品资产长期保留

---

## 12. 约束与一致性建议

### 唯一性
- 所有 ingest 类表必须有外部唯一性或 hash 去重
- 所有计算任务需要可追踪到输入版本

### 幂等
- `canonical_event.dedupe_key`
- `job_run.idempotency_key`

### 可追溯
- `digest_section` 与 `recommended_item` 要能回指上游 intelligence / canonical event

---

## 13. 下一步建议

本数据草案之后，下一步通常继续产出：

1. SQL DDL 初稿
2. Prisma/Drizzle schema 初稿
3. Internal event schema
4. 队列任务目录与 job contract
