# M021 — Preflight review checklist (DRAFT)

**Target:** BAOTRI-Mini-Test only. **No migration applied.** Production out of scope.
**Baseline:** Migration 020 P0 payload validation fix is confirmed applied on Test.

## Promotion blockers / decisions

- [x] Re-fetch Test migration tracker read-only: it reports only version `20261120042433` (Migration 020 P0); candidate M021 version `20261120050000` is absent. Tracker completeness is not assumed; recheck before apply.
- [x] Resolve legacy RPC EXECUTE policy.
  - Revoke EXECUTE on `update_asset_with_lock` from PUBLIC, anon, authenticated and service_role. The full-snapshot RPC has no expected-version/Receipt guard; an Asset anchor only serializes and cannot prevent stale overwrite. Keep its definition for owner-level rollback/maintenance only.
  - Retain `set_asset_archived_with_lock` for authenticated/service_role during the compatibility window. It is a narrow archive/restore operation that validates the current lease token and does not accept a full stale Asset snapshot. Revisit when Cloud lifecycle UI has a dedicated versioned mutation route.
  - Current repository writer uses `apply_asset_mutation_with_lock`; no runtime call sites were found for the two legacy helper wrappers. External/old clients cannot be ruled out.
  - Sequential test expects update RPC denied and archive/restore available. Historical lease SQL test is pre-M021 only because it calls the revoked update RPC.
- [ ] Verify allocator `create_asset_with_code` is revoked from authenticated/service_role; test confirms denied and import counter reconciliation remains valid.
- [ ] Confirm direct Asset INSERT/UPDATE/DELETE denied to service_role and direct DELETE denied to authenticated, including column ACLs.
- [ ] Confirm Settings DELETE denied to service_role; authenticated INSERT/UPDATE compatibility retained only as required by live Settings writer and statement trigger.
- [ ] Confirm no runtime Settings DELETE caller; direct service_role DELETE privilege is currently present on Test baseline (read-only preflight), and M021 draft revokes it.
- [ ] Confirm private schema/helper privileges, function owners, SECURITY DEFINER/INVOKER, empty search_path, row_security attributes and trigger timing.
- [ ] Confirm advisory lock namespace and known vector, lock order (Asset anchor -> mutation-ID bigint lock -> Settings shared/exclusive -> row/ledger/counter), and no unplanned lock inversion.
- [ ] Review payload key/type validation, Receipt idempotency/replay ownership, Import ledger identity, and test fixtures for current schema.
- [x] Corrected the sequential test's Settings lock observation: it verifies the exclusive lock already held by the statement trigger without requiring a second simultaneous ShareLock row. Clean shared-only acquisition remains a separate physical two-session gate.

## Sequential Test regression gate

- [ ] Run M021 sequential rollback test against Test only after migration is applied there.
- [ ] Run allocator test (branch aware).
- [ ] Run import-preserving-identity test (branch aware; verify counter last_value after RESET ROLE).
- [ ] Run business modules RLS integration test.
- [ ] Run the updated M021 lease/compatibility test: archive/restore remains executable; full-snapshot update must be denied. Historical lease SQL test is pre-M021 only.
- [ ] Do not treat the historical direct Asset CRUD test as post-M021; it is pre-M021 only.
- [ ] Record exact SQLSTATE, PASS/FAIL and before/after state snapshots; no claim of pass without execution.

## Physical two-session gate

- [ ] Execute Sections 1–8 in `M021_TWO_SESSION_TEST_PROTOCOL_DRAFT.md` using two independent sessions plus observer.
- [ ] Record blockers, PID/txid, wait events, pg_blocking_pids, pg_locks and state invariants.
- [ ] Include rollback and commit variants; no pg_sleep-based ordering.
- [ ] Confirm no deadlock (40P01), no unexpected lock timeout (55P03), and all transaction locks released.
- [ ] Confirm actual RPC interleavings, not just helper primitives.

## Safe execution order

1. Re-read all current draft SQL and tests; run parser/structural checks outside database if available.
2. Legacy EXECUTE policy is resolved in M021: revoke full-snapshot update; retain token-validated archive/restore. Reconfirm draft/test/checklist consistency.
3. Confirm Test-only target and explicit approval for applying M021.
4. Apply migration to Test only; verify function definitions, effective privileges, triggers, and migration history read-only.
5. Run sequential regression suite.
6. Run two-session concurrency protocol.
7. Review evidence and rollback/repair strategy before any further decision. Production remains excluded.

## Read-only baseline facts checked during this review

- Test `organization_settings` fixture row exists.
- Test effective privileges: authenticated INSERT=true, UPDATE=true, DELETE=false; service_role DELETE=true.
- `organization_settings` columns: organization_id (NOT NULL), asset_categories (NOT NULL, default []), created_at/updated_at (NOT NULL, default now()), asset_code_config nullable. This supports the draft INSERT/UPSERT compatibility exercise.
- These are catalog observations only; no data was modified.


## Static signature/grant cross-check (20/11/2026)

- Read-only BAOTRI-Mini-Test `pg_proc` inspection confirms all nine function identity signatures in the sequential test match the currently deployed function signatures: acquire, heartbeat, release, apply mutation, import, update legacy, archive legacy, list locks, allocator.
- Current baseline: all listed functions are SECURITY DEFINER, owned by postgres, `search_path=''`, `row_security=off`; authenticated and service_role EXECUTE=true; anon=false. This is the pre-M021 baseline, not a post-M021 PASS.
- GitHub caller audit nuance: `updateAssetWithEditLock` and `setAssetArchivedWithEditLock` are exported helper definitions in `src/lib/assetEditLocks.ts`, but repository search found no import/call sites beyond those definitions. Same for `createCloudAsset()` in `src/lib/assetsCloud.ts`. This is stronger than saying the helpers do not exist; it does not rule out external/old clients.
- M021 policy is finalized: `update_asset_with_lock` is denied to all application roles; `set_asset_archived_with_lock` remains available to authenticated/service_role and is exercised for archive + restore. The sequential test checks this matrix.

- [ ] Verify no EXECUTE for authenticated/anon/service_role on every private helper, including `lock_two_int`, both Settings lock helpers, and the Settings trigger wrapper; trigger wrapper ACL must be inspected via `has_function_privilege`, not invoked as a normal function.
- [x] Draft contract: `update_asset_with_lock` EXECUTE revoked from PUBLIC/anon/authenticated/service_role; `set_asset_archived_with_lock` retained for authenticated/service_role and denied to anon. Runtime verification remains pending until M021 is applied to Test.
- [x] Historical lease test is labeled pre-M021 only because it calls revoked `update_asset_with_lock`; use the M021 sequential draft for post-M021 coverage. Runtime regression execution remains pending.
