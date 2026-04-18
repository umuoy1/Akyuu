alter table workspace
  add column if not exists locale text not null default 'en-US';
