-- BAOTRI Mini — P0 forward-fix DRAFT: Asset mutation payload validation
-- STATUS: DRAFT ONLY. Not an approved migration. Do NOT run.
-- Target: BAOTRI-Mini-Test only, after explicit user approval.
-- Replaces the complete apply_asset_mutation_with_lock function definition.
-- Does not modify Migration 017, Migration 018, or the Asset lock retrofit.
-- Version/timestamp intentionally not assigned: the Test database has no
-- discoverable migration ledger, so applied-history reconciliation is required.
--
-- Required payload contract: exactly 13 keys; rejects SQL NULL, JSON null,
-- scalar, array, missing keys, and unsupported extra keys with SQLSTATE 22023.
--
-- Review source:
-- supabase/docs/ASSET_MUTATION_PAYLOAD_VALIDATION_FIX_DESIGN.md

if jsonb_typeof(p_payload) is distinct from 'object'
   or not (p_payload ?& v_required_keys)
   or (p_payload - v_required_keys) <> '{}'::jsonb then
  raise exception 'Asset mutation payload has missing or unsupported fields'
    using errcode = '22023';
end if;
