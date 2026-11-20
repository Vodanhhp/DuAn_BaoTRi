# M021 — Two-physical-session concurrency protocol (DRAFT)

**Target:** BAOTRI-Mini-Test only.  
**Prerequisite:** M021 lock-anchor draft has been reviewed and applied to Test.  
**Status:** M021 has been applied to BAOTRI-Mini-Test and the rollback-only sequential regression completed without SQL error. Protocol prepared; no physical two-session concurrency test has been run yet.

## Harness rules

- Open two independent SQL Editor tabs/connections to the same BAOTRI-Mini-Test project. A third observer connection is recommended.
- Never share credentials or connection strings in this file.
- Use the dedicated Test organization and Asset fixture below only.
- Do not use `pg_sleep` to create ordering. Session A is the explicit READY barrier: it starts a transaction and acquires the lock, then waits for the operator to start Session B.
- Set `lock_timeout` in Session B only as a safety bound. A timeout is not a PASS; capture SQLSTATE, blocker graph and current query.
- Do not run hard DELETE. M021 revokes authenticated DELETE and does not introduce a delete RPC.
- Roll back every test transaction unless the test explicitly requires Session A to commit to release the lock.

Fixture:
- Organization: `dfb443ec-a1ee-496b-842c-0bef3f50b8ce`
- Asset A: `872077a8-9b75-402d-908a-93fa5bcd9749`
- Asset B: `11111111-2222-4333-8444-555555555555` (key vector only; must exist only if a separate fixture is provisioned)

## 1. Same Asset anchor — exclusive/exclusive

**Session A**
```sql
begin;
set local application_name = 'M021-A-asset-anchor';
select private.lock_asset_anchor(
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce'::uuid,
  '872077a8-9b75-402d-908a-93fa5bcd9749'::uuid
);
select pg_backend_pid() as pid, txid_current() as txid;
-- READY: leave transaction open.
```

**Session B** (start only after A reports READY)
```sql
begin;
set local application_name = 'M021-B-asset-anchor';
set local lock_timeout = '20s';
select private.lock_asset_anchor(
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce'::uuid,
  '872077a8-9b75-402d-908a-93fa5bcd9749'::uuid
);
commit;
```

**Observer connection**
```sql
select pid, application_name, wait_event_type, wait_event,
       pg_blocking_pids(pid) as blockers, left(query, 240) as query
from pg_stat_activity
where application_name in ('M021-A-asset-anchor','M021-B-asset-anchor')
order by application_name;
```

Expected: B waits on A and `pg_blocking_pids(B)` contains A's PID. Commit A; B must then complete. No SQLSTATE 40P01.

## 2. Different Asset keys — independent progress

Repeat with Session A locking Asset A and Session B locking Asset B using the same organization. B must complete while A remains open. This is evidence for the selected test vectors only, not a mathematical proof that 64-bit hash collisions are impossible.

## 3. Settings shared/shared and shared/exclusive

**Shared/shared:** A and B each run `private.lock_settings_global_shared()` in open transactions. Both must complete without blocking.

**Shared/exclusive:** A holds shared; B calls `private.lock_settings_global_exclusive()`. B must block on A. Commit A; B completes.

**Exclusive/shared:** A holds exclusive; B calls shared. B must block until A commits.

For each case, use distinct `application_name` values and the Observer query above. Record PID, txid, blocker list, wait event and SQLSTATE.

## 4. Direct Settings statement trigger — zero-row UPDATE

This checks the compatibility bridge for the live PostgREST writer.

**Session A** (use the active Admin fixture; set JWT claims before SET ROLE)
```sql
begin;
set local application_name = 'M021-A-settings-direct';
select set_config('request.jwt.claim.sub','<ADMIN_USER_UUID>',true);
select set_config('request.jwt.claims',
  jsonb_build_object('sub','<ADMIN_USER_UUID>','role','authenticated')::text,true);
set local role authenticated;
update public.organization_settings
set asset_code_config = asset_code_config
where organization_id = '00000000-0000-0000-0000-000000000000'::uuid;
-- Must affect zero rows, but BEFORE STATEMENT trigger still holds global exclusive.
```

**Session B**
```sql
begin;
set local application_name = 'M021-B-settings-reader';
set local lock_timeout = '20s';
select private.lock_settings_global_shared();
commit;
```

Expected: B blocks on A even though A's UPDATE affected zero rows. Observer must show B blocked by A. Commit A; B completes. Roll back/close any still-open transaction if the lock timeout fires.

Repeat in reverse: A holds shared, B executes a real Settings UPDATE as authenticated and must wait before row-level processing. The Settings row value must remain unchanged after rollback.

## 5. Mutation-ID bigint vs two-int namespace

In A, acquire an Asset two-int anchor and keep the transaction open. In B, acquire the existing bigint mutation key:

```sql
begin;
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'dfb443ec-a1ee-496b-842c-0bef3f50b8ce:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0
  )
);
commit;
```

Expected: B is not blocked by A's two-int key. In `pg_locks`, two-int entries use `objsubid=2`; bigint entries use `objsubid=1`.

## 6. Transaction release

A acquires an Asset anchor and commits. A second session must then acquire the same key. Repeat with A rolling back. After transaction end, Observer must show no granted advisory transaction lock for A's completed transaction/PID.

## 7. Search-path poisoning and helper privilege

In a rollback-only transaction, create an attacker-controlled schema/function with the same unqualified name as a lock primitive, set a hostile `search_path`, and call the private helper. It must still resolve `pg_catalog.hashtextextended` and `pg_catalog.pg_advisory_xact_lock` because helper functions set an empty path and qualify all objects.

Under `SET ROLE authenticated`, direct invocation of `private.lock_asset_anchor` must fail because the client has no `private` schema USAGE/EXECUTE. For the trigger wrapper, do not invoke it as an ordinary SQL function (PostgreSQL trigger functions are only callable by triggers); instead assert `has_function_privilege('authenticated', 'private.guard_settings_global_write()', 'EXECUTE') = false` and the same for `anon`/`service_role`. A permitted direct Settings INSERT/UPDATE still invokes the trigger indirectly and acquires the lock.

## Evidence required for each test

- Test ID, start/end timestamp, Session A/B/C PID and transaction ID.
- SQL statement and SQLSTATE for each session.
- `pg_stat_activity.wait_event_type`, `wait_event`, `pg_blocking_pids(pid)` while blocked.
- `pg_locks` rows including `classid`, `objid`, `objsubid`, `mode`, `granted`.
- Post-commit/rollback verification of Asset, Lease, Receipt, import ledger, Settings and Counter snapshots.
- No credentials, JWTs, API keys or connection strings in logs.


## 8. Actual RPC integration interleavings (additional gate)

The helper-only scenarios above prove lock primitive behavior but are not sufficient to prove each business RPC acquires the anchor in the correct position. Before promotion, use dedicated disposable Asset fixtures with valid Admin JWT claims and record the following interleavings. Do not use hard DELETE: M021 closes that path.

### 8.1 Acquire/heartbeat/release against same Asset
- A calls `acquire_asset_edit_lock` for the fixture and keeps the transaction open after receiving the token.
- B calls `heartbeat_asset_edit_lock` for the same Asset/token, same holder, in a separate transaction; B must block at the Asset anchor while A is open.
- Commit A; B proceeds and renews the lease. Repeat with A rollback; B must proceed after rollback. Record token ownership and expiry.
- Release test: A calls `release_asset_edit_lock` and holds transaction open; B attempts acquire same Asset and waits, then proceeds after A ends.

### 8.2 Mutation vs import on same Asset
- Provision a disposable Asset and a valid lease. A executes `apply_asset_mutation_with_lock` with valid payload/expected version and holds the transaction open after obtaining the receipt.
- B executes `import_asset_preserving_identity` with the same UUID/code and canonical payload in a separate session. B must wait at the Asset anchor; after A commit, if import payload matches the now-current Asset, expect already-present; if stale/different, expect documented payload conflict. In either case it must not overwrite committed mutation or create duplicate Asset/receipt/import rows.
- Reverse order (A import, B apply mutation) and record expected winner semantics; verify version/payload/receipt/import ledger after rollback/commit.

### 8.3 Same mutation ID, different Asset anchors
- A applies mutation ID M to Asset A and holds transaction open; B applies same organization + mutation ID M to Asset B with valid lease/payload. B is expected to wait on the bigint mutation-ID lock, then reject/replay according to receipt identity contract; it must not apply M to a second Asset.
- Verify lock order (Asset anchor first, bigint mutation ID second), no deadlock, and exactly one receipt.

### 8.4 Legacy update/archive writers
- Source audit found the legacy `update_asset_with_lock` and `set_asset_archived_with_lock` wrappers have no runtime callers in the current repository; App's active linked-Asset writer uses `apply_asset_mutation_with_lock`.
- M021 policy decision in this draft: revoke EXECUTE on `update_asset_with_lock` from PUBLIC/anon/authenticated/service_role because it writes a full snapshot without expected-version/receipt protection; an Asset anchor serializes it but cannot prevent a stale overwrite. Keep the function definition for owner-level compatibility/rollback only. The sequential test verifies client/service EXECUTE is denied.
- Retain `set_asset_archived_with_lock` for now: it changes only the archive state, checks the current lease token and does not accept a stale full Asset snapshot. Test both archive and restore through this RPC. This is a narrower compatibility surface, not a general Asset update path. Revisit when the Cloud lifecycle UI has a dedicated versioned mutation route.

### 8.5 Hard-delete/FK cases superseded
- Do not test delete-vs-anchor, FK insert-vs-delete, or legacy writer-vs-delete as executable concurrency cases: M021 contract revokes direct DELETE from authenticated and service_role and adds no delete RPC. Verify effective DELETE privileges denied instead. Owner-level maintenance deletion is outside this application protocol and is not covered.

For each integration case, use explicit READY checkpoints (A has already invoked the RPC and is still inside the transaction), Observer evidence, lock_timeout as a safety bound only, and post-state verification. These are not PASS until performed with two physical sessions.

**Pass criteria:** intended blocker is observed; the waiting transaction proceeds only after the blocker ends; no 40P01; no unexpected 55P03; state invariants hold after rollback; transaction locks are released. This document is a protocol, not a test result.
