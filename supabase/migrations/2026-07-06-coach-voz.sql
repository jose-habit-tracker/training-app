-- Coach con voz: subtipo + métricas por deporte en training_sessions.
-- Idempotente: ejecutable en el SQL editor de Supabase sin peligro.

alter table public.training_sessions
  add column if not exists subtype text
    check (subtype in ('easy','long_run','intervals','threshold','race',
                       'swim_technique','swim_sets','strength','hyrox_circuit','recovery'));

alter table public.training_sessions
  add column if not exists metrics jsonb;
