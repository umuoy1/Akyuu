create extension if not exists pgcrypto;

create table if not exists workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan_tier text not null default 'free',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_member (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists watch_target (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  type text not null,
  name text not null,
  status text not null default 'active',
  priority integer not null default 3,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists watch_target_workspace_type_status_idx
  on watch_target (workspace_id, type, status);

create table if not exists watch_rule (
  id uuid primary key default gen_random_uuid(),
  watch_target_id uuid not null references watch_target(id) on delete cascade,
  rule_type text not null,
  operator text not null,
  value text not null,
  weight numeric(10, 2) not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists watch_rule_watch_target_type_idx
  on watch_rule (watch_target_id, rule_type);

create table if not exists watch_schedule (
  id uuid primary key default gen_random_uuid(),
  watch_target_id uuid not null references watch_target(id) on delete cascade,
  cadence text not null default 'daily',
  cron_expr text not null default '0 9 * * *',
  enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz
);

create index if not exists watch_schedule_enabled_next_run_idx
  on watch_schedule (enabled, next_run_at);

create table if not exists source_cursor (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_key text not null,
  etag text,
  last_seen_external_id text,
  last_polled_at timestamptz,
  next_poll_after timestamptz,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (source_type, source_key)
);

create table if not exists raw_signal (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_key text not null,
  external_id text not null,
  occurred_at timestamptz not null,
  captured_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text not null,
  ingest_job_id uuid,
  created_at timestamptz not null default now(),
  unique (source_type, source_key, external_id)
);

create index if not exists raw_signal_captured_idx on raw_signal (captured_at);
create index if not exists raw_signal_occurred_idx on raw_signal (occurred_at);

create table if not exists raw_snapshot (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_key text not null,
  snapshot_date date not null,
  captured_at timestamptz not null default now(),
  content_format text not null,
  content text not null,
  content_hash text not null,
  meta jsonb not null default '{}'::jsonb,
  unique (source_type, source_key, snapshot_date)
);

create table if not exists canonical_entity (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  external_source text not null,
  external_key text not null,
  display_name text not null,
  normalized_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, external_source, external_key)
);

create index if not exists canonical_entity_type_name_idx
  on canonical_entity (entity_type, normalized_name);

create table if not exists canonical_event (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  occurred_at timestamptz not null,
  window_start timestamptz,
  window_end timestamptz,
  source_signal_id uuid references raw_signal(id) on delete set null,
  source_snapshot_id uuid references raw_snapshot(id) on delete set null,
  subject_entity_id uuid not null references canonical_entity(id) on delete cascade,
  actor_entity_id uuid references canonical_entity(id) on delete set null,
  repo_entity_id uuid references canonical_entity(id) on delete set null,
  confidence numeric(4, 2) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists canonical_event_type_occurred_idx
  on canonical_event (event_type, occurred_at);
create index if not exists canonical_event_repo_occurred_idx
  on canonical_event (repo_entity_id, occurred_at);
create index if not exists canonical_event_subject_occurred_idx
  on canonical_event (subject_entity_id, occurred_at);

create table if not exists event_entity_relation (
  id uuid primary key default gen_random_uuid(),
  canonical_event_id uuid not null references canonical_event(id) on delete cascade,
  entity_id uuid not null references canonical_entity(id) on delete cascade,
  relation_type text not null,
  weight numeric(10, 2) not null default 1,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists event_entity_relation_event_idx
  on event_entity_relation (canonical_event_id);
create index if not exists event_entity_relation_entity_type_idx
  on event_entity_relation (entity_id, relation_type);

create table if not exists topic (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists topic_alias (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topic(id) on delete cascade,
  alias text not null,
  alias_type text not null,
  weight numeric(10, 2) not null default 1
);

create index if not exists topic_alias_type_alias_idx
  on topic_alias (alias_type, alias);

create table if not exists topic_rule (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topic(id) on delete cascade,
  rule_type text not null,
  operator text not null,
  value text not null,
  weight numeric(10, 2) not null default 1,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists topic_rule_topic_type_enabled_idx
  on topic_rule (topic_id, rule_type, enabled);

create table if not exists topic_evidence (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topic(id) on delete cascade,
  canonical_event_id uuid not null references canonical_event(id) on delete cascade,
  evidence_type text not null,
  score numeric(10, 2) not null default 0,
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (topic_id, canonical_event_id, evidence_type)
);

create index if not exists topic_evidence_topic_score_idx
  on topic_evidence (topic_id, score);

create table if not exists topic_update (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topic(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  update_type text not null,
  importance_score numeric(10, 2) not null default 0,
  summary_struct jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists topic_update_topic_window_idx
  on topic_update (topic_id, window_end);
create index if not exists topic_update_type_score_idx
  on topic_update (update_type, importance_score);

create table if not exists trend_snapshot (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  scope text not null,
  snapshot_date date not null,
  raw_snapshot_id uuid references raw_snapshot(id) on delete set null,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (source, scope, snapshot_date)
);

create table if not exists trend_snapshot_item (
  id uuid primary key default gen_random_uuid(),
  trend_snapshot_id uuid not null references trend_snapshot(id) on delete cascade,
  rank integer not null,
  repo_full_name text not null,
  language text,
  description text,
  metric_primary numeric(14, 2),
  metric_secondary numeric(14, 2),
  metadata jsonb not null default '{}'::jsonb,
  unique (trend_snapshot_id, repo_full_name)
);

create index if not exists trend_snapshot_item_repo_idx on trend_snapshot_item (repo_full_name);
create index if not exists trend_snapshot_item_rank_idx on trend_snapshot_item (trend_snapshot_id, rank);

create table if not exists trend_diff (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  scope text not null,
  snapshot_date date not null,
  compared_to_date date not null,
  diff_struct jsonb not null default '{}'::jsonb,
  summary_struct jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source, scope, snapshot_date, compared_to_date)
);

create table if not exists event_score (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  workspace_id uuid references workspace(id) on delete cascade,
  score_type text not null,
  score numeric(10, 2) not null,
  feature_breakdown jsonb not null default '{}'::jsonb,
  model_version text not null default 'v1',
  created_at timestamptz not null default now(),
  unique (target_type, target_id, workspace_id, score_type, model_version)
);

create index if not exists event_score_workspace_type_score_idx
  on event_score (workspace_id, score_type, score);

create table if not exists digest (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  digest_type text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  status text not null default 'building',
  title text,
  summary_struct jsonb not null default '{}'::jsonb,
  rendered_markdown text not null default '',
  llm_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, digest_type, window_start, window_end)
);

create index if not exists digest_status_created_idx on digest (status, created_at);

create table if not exists digest_section (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references digest(id) on delete cascade,
  section_type text not null,
  title text not null,
  rank integer not null,
  summary_struct jsonb not null default '{}'::jsonb,
  rendered_markdown text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists digest_section_digest_rank_idx
  on digest_section (digest_id, rank);

create table if not exists recommended_item (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  digest_id uuid references digest(id) on delete cascade,
  item_type text not null,
  item_entity_id uuid references canonical_entity(id) on delete set null,
  source_target_type text not null,
  source_target_id uuid not null,
  rank integer not null,
  score numeric(10, 2) not null,
  reason_struct jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommended_item_digest_rank_idx
  on recommended_item (digest_id, rank);
create index if not exists recommended_item_workspace_created_idx
  on recommended_item (workspace_id, created_at);

create table if not exists job_run (
  id uuid primary key default gen_random_uuid(),
  queue_name text not null,
  job_name text not null,
  idempotency_key text not null,
  status text not null default 'queued',
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  error_text text,
  attempt_count integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (queue_name, idempotency_key)
);

create index if not exists job_run_status_created_idx on job_run (status, created_at);
create index if not exists job_run_name_created_idx on job_run (job_name, created_at);
