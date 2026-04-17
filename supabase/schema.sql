create table if not exists raw_scans (
  id bigserial primary key,
  epc text,
  tid text,
  reader_id text,
  ts timestamptz default now(),
  gate_id text,
  direction text,
  plate text,
  mode text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists raw_scans_ts_idx on raw_scans (ts desc);
create index if not exists raw_scans_epc_idx on raw_scans (epc);

create table if not exists access_events (
  event_key text primary key,
  ts timestamptz not null default now(),
  epc text not null,
  tid text,
  reader_id text not null,
  mode text not null,
  gate_id text not null,
  direction text not null,
  status text not null,
  outcome text not null,
  kind text not null,
  subject_name text not null,
  subject_meta text not null,
  plate text,
  rssi numeric,
  location text,
  reason text,
  resolved_at timestamptz,
  resolved_by text,
  notes text[],
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create index if not exists access_events_ts_idx on access_events (ts desc);
create index if not exists access_events_gate_idx on access_events (gate_id);
create index if not exists access_events_status_idx on access_events (status);
create index if not exists access_events_epc_idx on access_events (epc);

create table if not exists event_resolutions (
  id bigserial primary key,
  event_key text not null references access_events(event_key) on delete cascade,
  status text not null,
  outcome text not null,
  note text,
  resolved_by text not null,
  resolved_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists event_resolutions_event_key_idx on event_resolutions (event_key, resolved_at desc);

