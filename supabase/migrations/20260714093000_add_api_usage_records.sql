create table public.api_usage_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  menu_kind public.menu_kind not null,
  operation text not null check (operation in ('candidate', 'detail', 'image')),
  model text not null,
  service_tier text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(14,8) not null check (estimated_cost_usd >= 0),
  usd_jpy_rate numeric(10,4) not null check (usd_jpy_rate > 0),
  estimated_cost_jpy numeric(14,4) not null check (estimated_cost_jpy >= 0),
  is_estimate boolean not null default true,
  pricing_basis text not null,
  pricing_source text not null,
  created_at timestamptz not null default now()
);

create index api_usage_records_owner_created_idx
  on public.api_usage_records(owner_id, created_at desc);

alter table public.api_usage_records enable row level security;

create policy "users read own api usage"
  on public.api_usage_records for select
  using (owner_id = auth.uid());

create policy "users create own api usage"
  on public.api_usage_records for insert
  with check (owner_id = auth.uid());

grant select, insert on public.api_usage_records to authenticated;
