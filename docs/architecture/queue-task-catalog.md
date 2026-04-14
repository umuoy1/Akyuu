# GitHub 监控聚合 Agent｜队列任务目录文档

## 1. 文档目的

本文档用于定义系统的异步任务体系。  
目标不是列技术名词，而是把产品能力翻译成清晰的 queue / job catalog：

- 哪些队列存在
- 各队列处理什么
- 任务输入输出是什么
- 如何设计幂等、重试、优先级和失败处理

默认任务基础设施：**Redis + BullMQ**

---

## 2. 总体原则

## 2.1 Async-first
采集、归一、主题匹配、趋势 diff、摘要生成、通知发送都优先走异步队列。

## 2.2 幂等优先
每个 job 都必须有稳定的 `idempotency_key`，避免重复执行导致脏数据。

## 2.3 任务短而明确
不要把“抓取 + 归一 + 打分 + 摘要”塞进一个超大任务。  
任务要可观察、可重试、可局部修复。

## 2.4 允许重放
raw 层与 canonical/intelligence 层解耦后，允许对某个时间窗口或对象重跑 normalize / topic / digest。

## 2.5 优先级分层
- P0：日常采集与日报
- P1：topic / trend intelligence
- P2：追问、回填、维护

---

## 3. 队列拓扑总览

```text
scheduler
  -> ingest.poll
  -> ingest.snapshot
  -> normalize.event
  -> enrich.detail
  -> topic.match
  -> trend.diff
  -> score.rank
  -> digest.build
  -> ask.retrieve
  -> notify.send
  -> maintenance.rebuild
```

也可以按部署视角理解为：

- Scheduler queue：负责“发起”
- Ingest queues：负责“拿数据”
- Intel queues：负责“算结果”
- Product queues：负责“生产品输出”
- Maintenance queues：负责“修复与回放”

---

## 4. 队列与任务明细

## 4.1 `scheduler`

### 作用
统一生成周期性任务，不做重活。

### 任务一：`schedule_watch_poll`
| 项目 | 内容 |
|---|---|
| 触发方式 | cron |
| 输入 | 无，由 scheduler 扫描 watch_schedule |
| 输出 | 向 `ingest.poll` 投递任务 |
| 幂等键 | `watch:{watch_id}:poll:{time_bucket}` |
| 失败策略 | 重试 3 次，之后告警 |
| 备注 | 只负责生成，不直接抓取 |

### 任务二：`schedule_daily_digest`
| 项目 | 内容 |
|---|---|
| 触发方式 | cron |
| 输入 | workspace_id, date |
| 输出 | 向 `digest.build` 投递日报任务 |
| 幂等键 | `digest:daily:{workspace_id}:{date}` |
| 失败策略 | 重试 3 次 |

### 任务三：`schedule_weekly_digest`
类似日报，但窗口为 week。

### 任务四：`schedule_trend_snapshot`
| 项目 | 内容 |
|---|---|
| 触发方式 | cron |
| 输出 | 向 `ingest.snapshot` 投递 trending / weekly rank 抓取任务 |
| 幂等键 | `snapshot:{source}:{scope}:{date}` |

---

## 4.2 `ingest.poll`

### 作用
处理 GitHub repo / org 等增量轮询。

### 任务一：`poll_repo_events`
| 项目 | 内容 |
|---|---|
| 输入 | watch_target_id, repo_full_name |
| 行为 | 调 GitHub API 拉取 events / relevant lists |
| 输出 | `raw_signal`，并更新 `source_cursor` |
| 幂等键 | `poll_repo:{repo}:{cursor_version}` |
| 重试 | 网络错误指数退避；4xx 非授权类谨慎重试 |
| 失败去向 | DLQ + 任务告警 |

### 任务二：`poll_repo_releases`
用于低频检查 release 变化。

### 任务三：`poll_repo_metadata`
用于定期刷新 repo 静态信息，如 stars/forks/basic metadata。

---

## 4.3 `ingest.snapshot`

### 作用
抓取页面型快照源。

### 任务一：`fetch_trending_snapshot`
| 项目 | 内容 |
|---|---|
| 输入 | source=`github_trending`, scope, date |
| 输出 | `raw_snapshot` |
| 幂等键 | `trending:{scope}:{date}` |
| 重试 | 解析失败可重试 2 次 |

### 任务二：`fetch_weekly_rank_snapshot`
| 项目 | 内容 |
|---|---|
| 输入 | source=`github_weekly_rank`, date |
| 输出 | `raw_snapshot` |
| 幂等键 | `weekly_rank:{date}` |

---

## 4.4 `normalize.event`

### 作用
把 raw 层转换成 canonical layer。

### 任务一：`normalize_raw_signal`
| 项目 | 内容 |
|---|---|
| 输入 | raw_signal_id |
| 行为 | payload 解析、实体归一、事件归一、去重 |
| 输出 | `canonical_event`, `canonical_entity`, `event_entity_relation` |
| 幂等键 | `normalize_signal:{raw_signal_id}` |
| 重试 | 解析异常重试 1 次；系统错误重试 3 次 |

### 任务二：`normalize_raw_snapshot`
| 项目 | 内容 |
|---|---|
| 输入 | raw_snapshot_id |
| 行为 | 解析榜单项，写入 `trend_snapshot` 与 `trend_snapshot_item` |
| 输出 | trend snapshot 数据 |
| 幂等键 | `normalize_snapshot:{raw_snapshot_id}` |

### 任务三：`backfill_normalize_window`
| 项目 | 内容 |
|---|---|
| 输入 | 时间窗口、source_type |
| 输出 | 批量 normalize |
| 用途 | 重建或修复 |

---

## 4.5 `enrich.detail`

### 作用
对高价值对象补全详情。

### 任务一：`enrich_pr_detail`
| 项目 | 内容 |
|---|---|
| 输入 | repo, pr_number |
| 行为 | 拉评论、review、changed files、linked refs |
| 输出 | `raw_signal` 或 enrichment record |
| 幂等键 | `enrich_pr:{repo}:{pr}:{detail_version}` |

### 任务二：`enrich_issue_detail`
类似 PR。

### 任务三：`enrich_release_detail`
用于 release notes 和资产补充。

### 投递时机
- 事件评分达到阈值
- 某对象被选入推荐池
- 用户主动查看详情

---

## 4.6 `topic.match`

### 作用
把 canonical event 匹配到 topic。

### 任务一：`match_event_to_topics`
| 项目 | 内容 |
|---|---|
| 输入 | canonical_event_id |
| 行为 | 基于 topic_rule / alias / bindings 计算 evidence |
| 输出 | `topic_evidence` |
| 幂等键 | `topic_match:event:{event_id}:ruleset:{version}` |

### 任务二：`aggregate_topic_window`
| 项目 | 内容 |
|---|---|
| 输入 | topic_id, window_start, window_end |
| 行为 | 汇总 evidence，形成 `topic_update` |
| 输出 | `topic_update` |
| 幂等键 | `topic_update:{topic_id}:{window_start}:{window_end}:{version}` |

### 任务三：`rebuild_topic`
| 项目 | 内容 |
|---|---|
| 输入 | topic_id, optional time window |
| 用途 | 规则变更后的回放 |

---

## 4.7 `trend.diff`

### 作用
处理榜单差分与聚类。

### 任务一：`build_trend_diff`
| 项目 | 内容 |
|---|---|
| 输入 | source, scope, snapshot_date, compared_to_date |
| 行为 | 计算新上榜、掉榜、rank change |
| 输出 | `trend_diff` |
| 幂等键 | `trend_diff:{source}:{scope}:{snapshot_date}:{compared_to_date}` |

### 任务二：`cluster_trend_items`
| 项目 | 内容 |
|---|---|
| 输入 | trend_diff_id |
| 行为 | 聚类主题方向，如 agent / infra / runtime |
| 输出 | `trend_diff.summary_struct` |
| 幂等键 | `trend_cluster:{trend_diff_id}:{version}` |

---

## 4.8 `score.rank`

### 作用
统一评分与推荐候选计算。

### 任务一：`score_canonical_event`
| 项目 | 内容 |
|---|---|
| 输入 | canonical_event_id, workspace_id |
| 行为 | importance scoring |
| 输出 | `event_score` |
| 幂等键 | `score:event:{event_id}:{workspace_id}:{model_version}` |

### 任务二：`score_topic_update`
同上，对 topic_update 打分。

### 任务三：`rank_digest_candidates`
| 项目 | 内容 |
|---|---|
| 输入 | workspace_id, window |
| 行为 | 汇总 repo/topic/trend 候选，做最终排序 |
| 输出 | 候选列表 |
| 幂等键 | `rank_digest:{workspace_id}:{window}:{version}` |

---

## 4.9 `digest.build`

### 作用
生成日报、周报、月报。

### 任务一：`build_digest_skeleton`
| 项目 | 内容 |
|---|---|
| 输入 | workspace_id, digest_type, window |
| 行为 | 从 intelligence 层选条、分段、产出结构化 skeleton |
| 输出 | `digest.summary_struct`, `digest_section` |
| 幂等键 | `digest_skeleton:{workspace_id}:{digest_type}:{window_key}:{version}` |

### 任务二：`render_digest_with_llm`
| 项目 | 内容 |
|---|---|
| 输入 | digest_id |
| 行为 | 调 LLM 把结构化内容渲染成可读 Markdown |
| 输出 | `digest.rendered_markdown`, section rendered markdown |
| 幂等键 | `digest_render:{digest_id}:{prompt_version}:{model_version}` |

### 任务三：`build_recommended_items`
| 项目 | 内容 |
|---|---|
| 输入 | digest_id |
| 行为 | 选 3~10 个推荐对象 |
| 输出 | `recommended_item` |
| 幂等键 | `digest_reco:{digest_id}:{version}` |

---

## 4.10 `ask.retrieve`

### 作用
围绕 digest/history/evidence 做追问检索与回答。

### 任务一：`retrieve_answer_context`
| 项目 | 内容 |
|---|---|
| 输入 | question_session_id |
| 行为 | 检索 digest/history/topic/trend/evidence |
| 输出 | retrieval_context |
| 幂等键 | `ask_ctx:{question_session_id}:{retrieval_version}` |

### 任务二：`compose_answer`
| 项目 | 内容 |
|---|---|
| 输入 | question_session_id |
| 行为 | 调模型或规则生成回答 |
| 输出 | `answer_record` |
| 幂等键 | `ask_answer:{question_session_id}:{prompt_version}:{model_version}` |

---

## 4.11 `notify.send`

### 作用
统一发送站外通知。

### 任务一：`send_email_digest`
| 项目 | 内容 |
|---|---|
| 输入 | digest_id, recipient |
| 行为 | 渲染邮件模板并发送 |
| 输出 | `outbound_notification` |
| 幂等键 | `notify_email:{digest_id}:{recipient}` |

### 任务二：`send_bot_digest`
类似 email，渠道可能为 Slack/Telegram/Discord。

### 任务三：`send_alert`
用于失败恢复或高优先级提醒。

---

## 4.12 `maintenance.rebuild`

### 作用
数据修复、重放、迁移与清理。

### 任务一：`replay_raw_window`
| 项目 | 内容 |
|---|---|
| 输入 | source_type, time_window |
| 行为 | 重放 raw -> normalize |
| 输出 | 修复后的 canonical layer |
| 幂等键 | `replay_raw:{source_type}:{window}:{version}` |

### 任务二：`rebuild_digest_window`
重新生成某时间窗口内摘要。

### 任务三：`cleanup_expired_jobs`
清理旧 job / 临时缓存 / 失效快照。

---

## 5. 队列优先级建议

| 队列 | 优先级 | 原因 |
|---|---|---|
| ingest.poll | 高 | 决定基础事实是否新鲜 |
| normalize.event | 高 | 事实层是后续一切基础 |
| digest.build | 高 | 直接影响用户可见输出 |
| topic.match | 中高 | 差异化能力 |
| trend.diff | 中高 | 趋势输出 |
| enrich.detail | 中 | 成本较高，按需触发 |
| ask.retrieve | 中 | 面向交互，但通常不是硬实时 |
| notify.send | 中 | 重要但可稍后 |
| maintenance.rebuild | 低 | 运维与修复场景 |

---

## 6. 幂等键设计原则

### 6.1 规则
幂等键至少要绑定：
- 对象标识
- 时间窗口或版本
- 计算版本

### 6.2 示例
- `digest:daily:{workspace}:{date}`
- `topic_update:{topic}:{window}:{ruleset_version}`
- `score:event:{event}:{workspace}:{model_version}`

### 6.3 注意
不要把随机 UUID 当幂等键；  
幂等键的目标是“同一任务逻辑输入”只被接受一次。

---

## 7. 重试与失败处理

## 7.1 错误分类
### 可重试
- 网络抖动
- 超时
- 外部 5xx
- 资源竞争

### 有条件重试
- GitHub rate limit
- 次级限流
- 页面结构变化

### 不应重试
- 参数非法
- 规则配置错误
- 数据不满足前置条件

---

## 7.2 重试策略建议
| 类型 | 策略 |
|---|---|
| 网络错误 | 指数退避，最大 5 次 |
| 外部 429 / 限流 | 按 reset_at 或 backoff 延后 |
| 页面解析失败 | 最多 2 次，之后进入人工告警 |
| 业务校验失败 | 不重试，直接失败并记录 |

---

## 7.3 死信队列
建议每个关键队列都有 DLQ，尤其是：
- ingest.poll
- normalize.event
- digest.build
- notify.send

DLQ 里的任务要支持：
- 查看输入
- 查看错误
- 手动重放
- 标记忽略

---

## 8. 并发与扩缩容建议

## 8.1 Worker 分类
第一阶段可一个 worker 程序内多 handler，按 queue 控制 concurrency。  
后续扩展时优先拆为：

- ingest worker
- intel worker
- digest worker
- notify worker

## 8.2 并发策略
| 队列 | 并发建议 |
|---|---|
| ingest.poll | 受 GitHub 配额限制，低到中 |
| ingest.snapshot | 低 |
| normalize.event | 中到高 |
| topic.match | 中 |
| trend.diff | 中 |
| digest.build | 低到中 |
| ask.retrieve | 中 |
| notify.send | 中到高 |

---

## 9. 可观测性与 SLA 建议

## 每个 job 至少记录
- queue_name
- job_name
- idempotency_key
- start/end time
- attempt_count
- input summary
- error summary
- output summary

## 核心指标
- 各队列待处理量
- job 成功率 / 失败率
- 平均耗时 / P95 耗时
- DLQ 数量
- digest 准时产出率
- topic match 成功率
- GitHub API 错误率 / 限流次数

---

## 10. 推荐实施顺序

## 第一批
1. `scheduler`
2. `ingest.poll`
3. `normalize.event`
4. `digest.build`

## 第二批
5. `topic.match`
6. `trend.diff`
7. `score.rank`

## 第三批
8. `ask.retrieve`
9. `notify.send`
10. `maintenance.rebuild`

---

## 11. 最小可行队列集

如果第一阶段只保留最小集合，建议保留：

- `scheduler`
- `ingest.poll`
- `ingest.snapshot`
- `normalize.event`
- `topic.match`
- `trend.diff`
- `score.rank`
- `digest.build`

这些就足以支撑第一版完整主链路。

---

## 12. 下一步建议

本队列文档之后，下一步最适合继续产出：

1. BullMQ queue 定义与 naming convention
2. job payload TypeScript types
3. retry / backoff policy config
4. ingest / digest / topic 三条主链路的时序图
