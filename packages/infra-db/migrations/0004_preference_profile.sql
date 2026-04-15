create table if not exists preference_profile (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  profile_json jsonb not null default '{}'::jsonb,
  version text not null default 'v1',
  updated_at timestamptz not null default now()
);

create unique index if not exists preference_profile_subject_unique
  on preference_profile (workspace_id, subject_type, subject_id);

create index if not exists preference_profile_updated_idx
  on preference_profile (workspace_id, updated_at desc);
