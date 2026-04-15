create table if not exists outbound_notification (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  channel text not null,
  target_address text not null,
  content_ref_type text not null,
  content_ref_id uuid not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists outbound_notification_target_unique
  on outbound_notification (channel, target_address, content_ref_type, content_ref_id);

create index if not exists outbound_notification_status_created_idx
  on outbound_notification (status, created_at desc);

create index if not exists outbound_notification_channel_sent_idx
  on outbound_notification (channel, sent_at desc);
