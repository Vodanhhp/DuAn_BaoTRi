# M022 — Browser verification protocol (Local PC → Cloud)

Date: 20/11/2026  
Target: **BAOTRI-Mini-Test only** (`oyzhxgzltpdebpymuicb`)  
Purpose: verify the real application flow after M022, without importing the user's existing Local database or touching Production.

## Important safety boundary

- Use a separate Chrome profile (or a browser profile that has never opened this app) so its IndexedDB is empty. Do not clear or overwrite the user's normal BAOTRI Local data.
- Start the app from the working copy with `npm run dev`.
- Before signing in, verify the app's Supabase environment points to project `oyzhxgzltpdebpymuicb`. If it points anywhere else or cannot be verified, stop.
- Sign in using a Test account that has an active membership in the Test organization.
- Create exactly one disposable Asset in this isolated profile. The import panel imports/links **all** Local Assets in that browser profile, so do not proceed if it contains anything except the disposable test Asset.
- Do not change Supabase schema, organization settings, or Production data during this protocol.

## Procedure

1. Open the isolated browser profile and run the local Vite app.
2. Sign in to the Test organization. Confirm the app loads the Cloud area without permission errors.
3. In Local Assets, create one clearly disposable Asset:
   - Name: `M022 TEST — creator metadata — YYYYMMDD-HHMM`
   - Category: a valid category offered by the app
   - Location: `TEST ONLY`
   - Notes: `Disposable M022 browser verification; safe to remove after verification`
   - Save it and record its generated UUID, management code, `createdByUserId`, and `createdByLabel` from the UI/Local record if available.
4. Open **Thiết bị trên Cloud** and run the Local PC → Cloud pre-check.
5. Confirm the preview reports exactly one Local Asset, one new Cloud Asset, and one link to create. If the counts differ, stop; do not confirm.
6. Confirm the import once. Expected result: one Cloud Asset created and one Local Cloud link saved. No Inventory, maintenance, or other records should be imported.
7. Reload the Cloud Asset list and verify:
   - Cloud Asset UUID equals the Local UUID.
   - Management code equals the Local code.
   - Creator UUID and creator label equal the Local values (NULL remains NULL; no synthetic identity).
   - Name, category, brand, model, serial, location, commissioned date, power, cycle, status, notes, and timestamps are consistent with the Local snapshot.
8. Reload the page/browser and verify the Local Cloud link remains present and the Asset is still linked.
9. Edit a harmless text field (e.g. Notes) through the supported Local edit path. Verify the existing Cloud-linked edit/lock flow applies the change to Cloud, retains UUID/code/creator metadata, and releases its lease.
10. Capture the result and record the disposable Asset UUID/code. Remove the disposable test Asset and Cloud link using the supported application lifecycle only after confirming the test is complete; if deletion is unavailable or would violate policy, leave it clearly marked as disposable and report that cleanup is pending.

## Pass criteria

- Preview is read-only and shows exactly 1/1/1 before confirmation.
- One and only one Asset is inserted on Test.
- Local UUID and management code remain unchanged.
- Creator metadata survives the Local → Cloud mapping exactly.
- Reload retains the link; a subsequent supported edit preserves creator metadata and completes the lock/mutation lifecycle.
- No unrelated tables or Production project are modified.

## Current code-level evidence

- `CloudAssetsPanel.tsx`: preview validates every Local Asset, checks Cloud conflicts, then requires explicit browser confirmation before import/link writes.
- `assetsCloud.ts`: import RPC payload includes `created_by_user_id` and `created_by_label`.
- `syncMapping.ts`: Asset row mapping is bidirectional for both creator fields.
- GitHub Actions CI run `44727331485` passed regression tests, template validation, and TypeScript/Vite build.
- This protocol has **not** been executed yet. A real browser session on the user's isolated profile is required; do not mark browser verification PASS until observed.

## Separate outstanding verification

The physical two-session M021 concurrency test remains pending and must use two independent database sessions. Sequential SQL calls are not an acceptable substitute.
