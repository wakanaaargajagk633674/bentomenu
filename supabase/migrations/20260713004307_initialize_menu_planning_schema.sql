-- Reset the user-owned public schema. Supabase-managed schemas such as auth,
-- storage, realtime, and extensions are intentionally preserved.
drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;

create extension if not exists pgcrypto with schema extensions;

create type public.menu_kind as enum ('bento', 'izakaya');
create type public.idea_status as enum ('draft', 'testing', 'adopted', 'archived');
create type public.meal_role as enum ('staple', 'main', 'side', 'soup', 'dessert', 'drink', 'snack');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  default_unit text,
  allergen_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind public.menu_kind not null,
  name text not null,
  concept text,
  cuisine text,
  role public.meal_role not null default 'side',
  status public.idea_status not null default 'draft',
  servings numeric(8,2) not null default 1 check (servings > 0),
  prep_minutes integer check (prep_minutes >= 0),
  cook_minutes integer check (cook_minutes >= 0),
  instructions text,
  flavor_design jsonb not null default '{}'::jsonb,
  presentation_design jsonb not null default '{}'::jsonb,
  food_safety_notes text,
  cost_yen numeric(10,2) check (cost_yen >= 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  ingredient_name text not null,
  amount numeric(12,3) check (amount >= 0),
  unit text,
  preparation text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.menu_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind public.menu_kind not null,
  name text not null,
  concept text,
  season text,
  target_price_yen integer check (target_price_yen >= 0),
  status public.idea_status not null default 'draft',
  evaluation jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_plan_items (
  id uuid primary key default gen_random_uuid(),
  menu_plan_id uuid not null references public.menu_plans(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  role public.meal_role not null,
  portion_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (menu_plan_id, recipe_id)
);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  publisher text,
  url text,
  source_type text,
  cuisine text,
  key_evidence text,
  application_notes text,
  confidence text,
  accessed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_owner_kind_idx on public.recipes(owner_id, kind);
create index recipes_status_idx on public.recipes(owner_id, status);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id, sort_order);
create index menu_plans_owner_kind_idx on public.menu_plans(owner_id, kind);
create index menu_plan_items_plan_idx on public.menu_plan_items(menu_plan_id, sort_order);
create index research_sources_owner_idx on public.research_sources(owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger ingredients_updated_at before update on public.ingredients for each row execute procedure public.set_updated_at();
create trigger recipes_updated_at before update on public.recipes for each row execute procedure public.set_updated_at();
create trigger menu_plans_updated_at before update on public.menu_plans for each row execute procedure public.set_updated_at();
create trigger research_sources_updated_at before update on public.research_sources for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.menu_plans enable row level security;
alter table public.menu_plan_items enable row level security;
alter table public.research_sources enable row level security;

create policy "users manage own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "users manage own ingredients" on public.ingredients for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "users manage own recipes" on public.recipes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "users manage own recipe ingredients" on public.recipe_ingredients for all
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = auth.uid()));
create policy "users manage own menu plans" on public.menu_plans for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "users manage own menu plan items" on public.menu_plan_items for all
  using (exists (select 1 from public.menu_plans m where m.id = menu_plan_id and m.owner_id = auth.uid()))
  with check (exists (select 1 from public.menu_plans m where m.id = menu_plan_id and m.owner_id = auth.uid()));
create policy "users manage own research sources" on public.research_sources for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
