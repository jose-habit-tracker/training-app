-- Training App Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- TABLE: training_plans
-- ─────────────────────────────────────────────
create table if not exists public.training_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  phase text not null check (phase in ('base', 'build', 'peak', 'taper', 'race', 'hyrox_prep')),
  current_week integer not null default 1,
  start_date date not null,
  goal_race_date date not null,
  plan_data jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.training_plans enable row level security;

create policy "Users can view own training plans"
  on public.training_plans for select
  using (auth.uid() = user_id);

create policy "Users can insert own training plans"
  on public.training_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own training plans"
  on public.training_plans for update
  using (auth.uid() = user_id);

create policy "Users can delete own training plans"
  on public.training_plans for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- TABLE: training_sessions
-- ─────────────────────────────────────────────
create table if not exists public.training_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_id uuid references public.training_plans(id) on delete set null,
  session_date date not null,
  day_name text not null,
  week_number integer not null default 1,
  session_type text not null,
  duration_min integer,
  rpe_perceived integer check (rpe_perceived between 1 and 10),
  fatigue integer check (fatigue between 1 and 10),
  notes text,
  ai_feedback text,
  completed_at timestamptz
);

alter table public.training_sessions enable row level security;

create policy "Users can view own sessions"
  on public.training_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.training_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.training_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.training_sessions for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- TABLE: exercise_logs
-- ─────────────────────────────────────────────
create table if not exists public.exercise_logs (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.training_sessions(id) on delete cascade not null,
  exercise_id text not null,
  exercise_name text not null,
  completed boolean not null default false,
  sets_actual integer,
  load_actual text,
  notes text
);

alter table public.exercise_logs enable row level security;

create policy "Users can view exercise logs via session"
  on public.exercise_logs for select
  using (
    exists (
      select 1 from public.training_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users can insert exercise logs via session"
  on public.exercise_logs for insert
  with check (
    exists (
      select 1 from public.training_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users can update exercise logs via session"
  on public.exercise_logs for update
  using (
    exists (
      select 1 from public.training_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users can delete exercise logs via session"
  on public.exercise_logs for delete
  using (
    exists (
      select 1 from public.training_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- TABLE: ai_conversations
-- ─────────────────────────────────────────────
create table if not exists public.ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  context_snapshot jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

create policy "Users can view own conversations"
  on public.ai_conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert own conversations"
  on public.ai_conversations for insert
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- TABLE: user_invites
-- ─────────────────────────────────────────────
create table if not exists public.user_invites (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  role text not null default 'athlete',
  invited_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);

alter table public.user_invites enable row level security;

create policy "Admins can view all invites"
  on public.user_invites for select
  using (auth.uid() = invited_by);

create policy "Anyone can check their own invite"
  on public.user_invites for select
  using (email = (select email from auth.users where id = auth.uid()));

create policy "Admins can insert invites"
  on public.user_invites for insert
  with check (auth.uid() = invited_by);

create policy "System can update invite status"
  on public.user_invites for update
  using (email = (select email from auth.users where id = auth.uid()));

-- ─────────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────────
create index if not exists idx_training_sessions_user_date
  on public.training_sessions(user_id, session_date);

create index if not exists idx_training_sessions_user_week
  on public.training_sessions(user_id, week_number);

create index if not exists idx_ai_conversations_user
  on public.ai_conversations(user_id, created_at desc);

create index if not exists idx_exercise_logs_session
  on public.exercise_logs(session_id);
