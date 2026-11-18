-- BAOTRI Mini — Migration 019: use a real wall-clock version for Asset updates.
-- Apply to BAOTRI-Mini-Test after Migration 018.
-- This migration changes only the assets.updated_at trigger behavior.
-- It does not rewrite existing Asset rows or alter other tables.

begin;

create or replace function public.set_asset_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists assets_set_updated_at on public.assets;

create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_asset_updated_at();

comment on function public.set_asset_updated_at() is
  'Set Asset updated_at using wall-clock time so optimistic Cloud versions change even within a long transaction.';

commit;
