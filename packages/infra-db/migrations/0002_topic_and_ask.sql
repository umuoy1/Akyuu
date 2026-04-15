create unique index if not exists topic_update_window_unique
  on topic_update (topic_id, window_start, window_end, update_type);

create table if not exists question_session (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  anchor_type text not null,
  anchor_id uuid,
  question text not null,
  created_at timestamptz not null default now()
);

create index if not exists question_session_workspace_created_idx
  on question_session (workspace_id, created_at desc);

create index if not exists question_session_user_created_idx
  on question_session (user_id, created_at desc);

create table if not exists answer_record (
  id uuid primary key default gen_random_uuid(),
  question_session_id uuid not null references question_session(id) on delete cascade,
  answer_markdown text not null,
  retrieval_context jsonb not null default '{}'::jsonb,
  llm_version text not null default 'deterministic-v1',
  created_at timestamptz not null default now()
);

create unique index if not exists answer_record_question_unique
  on answer_record (question_session_id);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  feedback_type text not null,
  value numeric(10, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_created_idx
  on feedback (user_id, created_at desc);

create index if not exists feedback_target_idx
  on feedback (target_type, target_id);
