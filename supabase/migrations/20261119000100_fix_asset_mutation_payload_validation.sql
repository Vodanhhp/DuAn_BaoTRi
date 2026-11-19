-- BAOTRI Mini — Migration 018: fix Migration 017 payload validation.
-- Apply to BAOTRI-Mini-Test after Migration 017.
-- This migration only replaces the existing RPC definition; it does not
-- create or alter tables, receipts, leases, permissions, or business data.

begin;

do $hotfix$
declare
  v_definition text;
  v_old_check constant text :=
    'or jsonb_object_length(p_payload) <> cardinality(v_required_keys)';
begin
  v_definition := pg_get_functiondef(
    'public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb)'::regprocedure
  );

  if position(v_old_check in v_definition) = 0 then
    raise exception 'Expected Migration 017 payload check was not found; refusing to modify the function.';
  end if;

  v_definition := replace(
    v_definition,
    'jsonb_typeof(p_payload) <> ''object''',
    'jsonb_typeof(p_payload) is distinct from ''object'''
  );
  v_definition := replace(v_definition, v_old_check, 'false');

  execute v_definition;
end
$hotfix$;

commit;
