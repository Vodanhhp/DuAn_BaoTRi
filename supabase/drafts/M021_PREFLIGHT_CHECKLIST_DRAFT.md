# M021 — Preflight review checklist (DRAFT)

**Target:** BAOTRI-Mini-Test only. **No migration applied.** Production out of scope.
**Baseline:** Migration 020 P0 payload validation fix is confirmed applied on Test.

## Promotion blockers / decisions

- [ ] Re-fetch Test migration history and confirm the proposed M021 version is unused; choose final version timestamp.
- [ ] Decide legacy RPC EXECUTE policy for `update_asset_with_lock` and `set_asset_archived_with_lock`.
  - Repository source audit found no runtime callers; active linked-Asset writer uses `apply_asset_mutation_with_lock`.
  - These legacy full-snapshot writers do not carry expected-version/receipt conflict protection. Asset-anchor serialization is not stale-write detection.
  - **Recommendation:** revoke EXECUTE from `authenticated` and `service_role` for these two RPCs if no external client compatibility requirement exists. Keep owner-level maintenance access; do not grant PUBLIC/anon.
  - If revocation is selected, adjust the M021 sequential regression and mark the historical lease test pre-M021 / update its expected-denied assertions. If retained, test stale-write ordering and explicitly accept documented lost-update risk.
- [ ] Verify allocator `create_asset_with_code` is revoked from authenticated/service_role; test confirms denied and import counter reconciliation remains valid.
- [ ] Confirm direct Asset INSERT/UPDATE/DELETE denied to service_role and direct DELETE denied to authenticated, including column ACLs.
- [ ] Confirm Settings DELETE denied to service_role; authenticated INSERT/UPDATE compatibility retained only as required by live Settings writer and statement trigger.
- [ ] Confirm no runtime Settings DELETE caller; direct service_role DELETE privilege is currently present on Test baseline (read-only preflight), and M021 draft revokes it.
- [ ] Confirm private schema/helper privileges, function owners, SECURITY DEFINER/INVOKER, empty search_path, row_security attributes and trigger timing.
- [ ] Confirm advisory lock namespace and known vector, lock order (Asset anchor -> mutation-ID bigint lock -> Settings shared/exclusive -> row/ledger/counter), and no unplanned lock inversion.
- [ ] Review payload key/type validation, Receipt idempotency/replay ownership, Import ledger identity, and test fixtures for current schema.

## Sequential Test regression gate

- [ ] Run M021 sequential rollback test against Test only after migration is applied there.
- [ ] Run allocator test (branch aware).
- [ ] Run import-preserving-identity test (branch aware; verify counter last_value after RESET ROLE).
- [ ] Run business modules RLS integration test.
- [ ] Run lease test only if legacy RPC EXECUTE retained; otherwise run updated compatibility/denial version.
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
2. Finalize the legacy EXECUTE policy and update tests/docs accordingly.
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
