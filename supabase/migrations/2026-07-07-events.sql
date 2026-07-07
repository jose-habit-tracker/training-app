-- Eventos del calendario: carreras (kind='race') y eventos personales (kind='event').
-- Los entrenamientos NO viven aquí; solo lo que el usuario añade a mano.
create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  date date not null,
  end_date date,
  kind text not null check (kind in ('race', 'event')),
  icon text,
  notes text,
  race jsonb,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Users can view own events"
  on public.events for select
  using (auth.uid() = user_id);

create policy "Users can insert own events"
  on public.events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own events"
  on public.events for update
  using (auth.uid() = user_id);

create policy "Users can delete own events"
  on public.events for delete
  using (auth.uid() = user_id);
