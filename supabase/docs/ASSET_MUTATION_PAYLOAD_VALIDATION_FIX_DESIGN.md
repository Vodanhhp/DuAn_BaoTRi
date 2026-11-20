# BAOTRI Mini — P0 corrective design: Asset mutation payload validation

**Status:** Corrective migration applied and regression-tested on BAOTRI-Mini-Test.  
**Target:** BAOTRI-Mini-Test only. Production remains untouched and out of scope.  
**Source of truth:** immutable historical Migration 017 at `supabase/migrations/20261118000300_asset_mutation_receipts.sql`.  
**Repository:** `Vodanhhp/DuAn_BaoTRi`, branch `main`.

## 1. Root cause and scope

The active function was malformed by the deployed-history sequence documented in Foundation Review §100: Migration 017 had already been applied in its older form; commit `74a27b4` edited the numbered migration in place; Migration 018 (`6d38f25`) replaced the old fragment including its leading Boolean `or` with `false`. The resulting active body contains the JSONB subtraction predicate followed by a dangling `false then`.

This correction is isolated from the later Asset lock retrofit. Do not modify Migration 017 or 018. Add one forward-only migration that replaces the complete function definition, not a textual fragment.

## 2. Required payload contract

There are **13 required keys** (not 14):

`name, brand, model, serial, location, commissioned_at, power, cycle, cycle_started_at, transferred_from_other_facility, status, notes, archived_at`.

The predicate must remain exactly equivalent to:

```sql
if jsonb_typeof(p_payload) is distinct from 'object'
   or not (p_payload ?& v_required_keys)
   or (p_payload - v_required_keys) <> '{}'::jsonb then
  raise exception 'Asset mutation payload has missing or unsupported fields'
    using errcode = '22023';
end if;
```

This rejects SQL NULL, JSON null, scalar, array, missing keys, and unsupported extra keys. A valid payload must be an object with exactly the 13 required keys. Existing field-level validation (nonblank name and supported status) remains unchanged.

## 3. Canonical forward migration

The following is the complete function definition copied from the current canonical Migration 017 source. The corrective migration must wrap this definition and the grants/comments below in a transaction. Version assignment was checked against the repository migration inventory and the confirmed BAOTRI-Mini-Test sequence through Migration 019. The target has no migration ledger table/tooling; the user confirmed no migration SQL was applied after Migration 019. The applied Migration 020 is recorded by BAOTRI-Mini-Test as version `20261120042433`; the canonical repository filename uses the same version.

```sql
begin;

create or replace function public.apply_asset_mutation_with_lock(
  p_organization_id uuid,
  p_asset_id uuid,
  p_lock_token uuid,
  p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_receipt public.asset_mutation_receipts;
  v_lock public.asset_edit_locks;
  v_asset public.assets;
  v_input public.assets;
  v_snapshot jsonb;
  v_applied_at timestamptz;
  v_required_keys text[] := array[
    'name', 'brand', 'model', 'serial', 'location',
    'commissioned_at', 'power', 'cycle', 'cycle_started_at',
    'transferred_from_other_facility', 'status', 'notes', 'archived_at'
  ];
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_organization_id is null or p_asset_id is null
     or p_lock_token is null or p_mutation_id is null
     or p_expected_cloud_updated_at is null then
    raise exception 'Organization, asset, lease, mutation and expected version are required'
      using errcode = '22023';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or not (p_payload ?& v_required_keys)
     or (p_payload - v_required_keys) <> '{}'::jsonb then
    raise exception 'Asset mutation payload has missing or unsupported fields'
      using errcode = '22023';
  end if;

  -- Fast replay path. A committed mutation can be acknowledged after its
  -- original response was lost, even if the lease has since expired.
  select * into v_receipt
  from public.asset_mutation_receipts r
  where r.organization_id = p_organization_id
    and r.mutation_id = p_mutation_id;

  if found then
    if v_receipt.applied_by_user_id <> auth.uid()
       or v_receipt.asset_id <> p_asset_id then
      raise exception 'Mutation receipt belongs to another user or asset'
        using errcode = '42501';
    end if;
    if v_receipt.expected_cloud_updated_at <> p_expected_cloud_updated_at
       or v_receipt.request_payload <> p_payload then
      raise exception 'Mutation ID was already used with a different request'
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'already_applied', true,
      'asset', v_receipt.result_snapshot,
      'applied_at', v_receipt.applied_at
    );
  end if;

  -- Serialize all mutations for this asset through its lease row.
  select * into v_lock
  from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
  for update;

  -- Recheck receipt after waiting for the lease row. Another identical
  -- request may have committed while this transaction was waiting.
  select * into v_receipt
  from public.asset_mutation_receipts r
  where r.organization_id = p_organization_id
    and r.mutation_id = p_mutation_id;

  if found then
    if v_receipt.applied_by_user_id <> auth.uid()
       or v_receipt.asset_id <> p_asset_id then
      raise exception 'Mutation receipt belongs to another user or asset'
        using errcode = '42501';
    end if;
    if v_receipt.expected_cloud_updated_at <> p_expected_cloud_updated_at
       or v_receipt.request_payload <> p_payload then
      raise exception 'Mutation ID was already used with a different request'
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'already_applied', true,
      'asset', v_receipt.result_snapshot,
      'applied_at', v_receipt.applied_at
    );
  end if;

  if v_lock.organization_id is null then
    raise exception 'Asset edit lease is missing'
      using errcode = '55000';
  end if;
  if v_lock.holder_user_id <> auth.uid()
     or v_lock.lock_token <> p_lock_token
     or v_lock.expires_at <= clock_timestamp() then
    raise exception 'Asset edit lease is not owned or has expired'
      using errcode = '55000';
  end if;

  select * into v_asset
  from public.assets a
  where a.organization_id = p_organization_id
    and a.id = p_asset_id
  for update;

  if not found then
    raise exception 'Asset not found in this organization'
      using errcode = 'P0002';
  end if;
  if v_asset.updated_at is distinct from p_expected_cloud_updated_at then
    raise exception 'Cloud asset version changed; manual conflict resolution is required'
      using errcode = '40001';
  end if;

  v_input := jsonb_populate_record(null::public.assets, p_payload);
  if nullif(btrim(v_input.name), '') is null then
    raise exception 'Asset name is required' using errcode = '22023';
  end if;
  if v_input.status is null or v_input.status not in (
    'Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý'
  ) then
    raise exception 'Unsupported asset status' using errcode = '22023';
  end if;

  update public.assets a
  set name = btrim(v_input.name),
      brand = coalesce(v_input.brand, ''),
      model = coalesce(v_input.model, ''),
      serial = coalesce(v_input.serial, ''),
      location = coalesce(v_input.location, ''),
      commissioned_at = v_input.commissioned_at,
      power = coalesce(v_input.power, ''),
      cycle = coalesce(v_input.cycle, ''),
      cycle_started_at = v_input.cycle_started_at,
      transferred_from_other_facility = coalesce(v_input.transferred_from_other_facility, false),
      status = v_input.status,
      notes = coalesce(v_input.notes, ''),
      archived_at = v_input.archived_at,
      updated_at = clock_timestamp()
  where a.organization_id = p_organization_id
    and a.id = p_asset_id
  returning * into v_asset;

  v_snapshot := to_jsonb(v_asset);
  v_applied_at := clock_timestamp();

  insert into public.asset_mutation_receipts (
    organization_id, mutation_id, asset_id, applied_by_user_id,
    expected_cloud_updated_at, request_payload, result_snapshot, applied_at
  ) values (
    p_organization_id, p_mutation_id, p_asset_id, auth.uid(),
    p_expected_cloud_updated_at, p_payload, v_snapshot, v_applied_at
  );

  return jsonb_build_object(
    'already_applied', false,
    'asset', v_snapshot,
    'applied_at', v_applied_at
  );
end;
$$;

revoke all on function public.apply_asset_mutation_with_lock(uuid, uuid, uuid, uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.apply_asset_mutation_with_lock(uuid, uuid, uuid, uuid, timestamptz, jsonb) to authenticated;

comment on function public.apply_asset_mutation_with_lock(uuid, uuid, uuid, uuid, timestamptz, jsonb) is
  'Apply an asset master mutation only with the current lease and expected Cloud version; safely replay the same committed mutation by its immutable mutation ID.';

commit;
```

**Canonical file:** `supabase/migrations/20261120042433_p0_fix_asset_mutation_payload_validation.sql`.

**Important:** This is a full-definition forward replacement. It is committed to the migrations directory but has NOT been applied. Do not run the historical Migration 017 or 018 again. Do not add unrelated schema, lease, receipt, permission, or lock-order changes to this migration.

## 4. Regression test matrix

All tests must run only on the explicitly approved disposable BAOTRI-Mini-Test fixture. Use an authenticated fixture actor who has active `assets.update` permission, a real fixture Asset, a valid active Lease, and a unique mutation ID for each attempt.

| ID | Input payload | Expected result |
|---|---|---|
| P01 | Exact object containing all 13 keys and no extras; valid name/status | Continues through normal mutation path; expected success |
| P02 | Object missing one required key (repeat once for representative required key) | SQLSTATE `22023`; no Asset/Receipt change |
| P03 | Exact valid object plus one unsupported key | SQLSTATE `22023`; no Asset/Receipt change |
| P04a | JSON `null` | SQLSTATE `22023`; no Asset/Receipt change |
| P04b | JSON string | SQLSTATE `22023`; no Asset/Receipt change |
| P04c | JSON number | SQLSTATE `22023`; no Asset/Receipt change |
| P04d | JSON boolean | SQLSTATE `22023`; no Asset/Receipt change |
| P04e | JSON array | SQLSTATE `22023`; no Asset/Receipt change |
| P04f | SQL NULL argument | SQLSTATE `22023`; no Asset/Receipt change |

For each invalid case:
1. Capture the complete Asset row (or stable JSON snapshot) and receipt count for the exact `organization_id + mutation_id` before the call.
2. Invoke the RPC inside a PL/pgSQL exception sub-block, catch only SQLSTATE `22023`, and fail the test if it returns normally or raises another SQLSTATE.
3. Re-read the Asset and receipt count.
4. Assert the Asset snapshot is byte-for-byte/equality unchanged, including `updated_at`, and no receipt exists for the attempted mutation ID.

A valid P01 test should use a disposable fixture and a unique mutation ID; verify the expected Asset fields and exactly one receipt. The entire fixture test must roll back. Do not infer no-write behavior solely from the exception: explicitly compare before/after state.

## 5. Function and privilege postflight

After applying the approved migration on Test:
- Fetch `pg_get_functiondef('public.apply_asset_mutation_with_lock(uuid, uuid, uuid, uuid, timestamptz, jsonb)'::regprocedure)`.
- Confirm the three-part predicate is present and no dangling `false then` remains.
- Confirm the signature, return type, language, `SECURITY DEFINER`, `search_path = ''`, and `row_security = off` are unchanged.
- Confirm EXECUTE is granted to `authenticated` and denied to `PUBLIC` and `anon`.
- Confirm no table, index, RLS policy, receipt, lease, Asset row, or unrelated function changed.

## 6. Explicit gates

**Preflight gate**
- Confirm the target is BAOTRI-Mini-Test, not Production.
- Inspect migration files and actual migration ledger/tooling to choose the next version.
- Fetch the active catalog definition and current grants read-only.
- Verify fixture actor, membership, permission, Asset and Lease.

**Execution gate**
- Only after explicit user approval: apply the single forward migration to Test.
- Then run the regression tests and postflight checks.
- If any preflight differs from this design, stop and report; do not improvise.

**Acceptance criteria**
- P01 passes.
- P02, P03, and all P04 cases return exactly SQLSTATE `22023`.
- Every invalid case leaves Asset snapshot and Receipt state unchanged.
- Function definition and security/grants match the contract.
- No unrelated database object or data changes.

## 7. Current status

- This document remains a design/review artifact; it is not execution approval.
- The canonical Migration 020 file is `supabase/migrations/20261120042433_p0_fix_asset_mutation_payload_validation.sql`; it is applied and regression-tested on BAOTRI-Mini-Test only.
- The original review snapshot remains at `supabase/drafts/20261120000100_p0_fix_asset_mutation_payload_validation_DRAFT.sql`.
- The regression test draft exists at `supabase/drafts/P0_ASSET_MUTATION_PAYLOAD_VALIDATION_REGRESSION_TEST_DRAFT.sql`. Its helper-call argument count was corrected in commit `8e08dc79b2a2d4cf4b46d18d667047c16d568335`.
- The migration was initially promoted to the migrations folder, then its filename was aligned with the applied Test migration version.
- The P01 valid-payload case and all eight invalid-payload cases passed in a transaction that was rolled back; the test Asset, lock and Receipt state were verified unchanged afterward.
- Migration 020 is recorded in the BAOTRI-Mini-Test migration history as version `20261120042433`. Production has not been modified.
