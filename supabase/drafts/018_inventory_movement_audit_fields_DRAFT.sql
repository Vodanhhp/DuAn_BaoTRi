-- BAOTRI Mini — DRAFT ONLY: inventory movement audit fields
-- Proposed sequence: 018 (do not treat this filename as an applied migration).
--
-- Preconditions:
--   * Review supabase/CLOUD_FIRST_SCHEMA_MIGRATION_PLAN.md.
--   * Shared organization_mutations Receipt contract and Inventory RPCs must be
--     designed/reviewed before the client is cut over.
--   * This DDL does NOT grant direct INSERT/UPDATE and does NOT revoke current
--     grants. Grant changes belong in the atomic RPC cutover migration.
--   * Do NOT run on BAOTRI-Mini-Test or Production yet.
--
-- Legacy preservation:
--   * All added audit fields are nullable so existing movements remain valid.
--   * No historical balance is inferred or backfilled.
--   * Existing quantity > 0 semantics are preserved.

begin;

alter table public.inventory_movements
  add column quantity_delta numeric(18,4),
  add column balance_before numeric(18,4),
  add column balance_after numeric(18,4),
  add column counted_quantity numeric(18,4),
  add column created_by_user_id uuid references auth.users(id) on delete restrict,
  add column mutation_id uuid,
  add column expected_item_version bigint,
  add column performed_by_label text;

alter table public.inventory_movements
  -- PostgreSQL numeric treats NaN as greater than ordinary numbers; reject it explicitly.
  add constraint inventory_movements_quantity_not_nan
    check (quantity <> 'NaN'::numeric),
  add constraint inventory_movements_quantity_delta_nonzero
    check (
      quantity_delta is null
      or (quantity_delta <> 0 and quantity_delta <> 'NaN'::numeric)
    ),
  add constraint inventory_movements_balances_nonnegative
    check (
      (balance_before is null or (balance_before >= 0 and balance_before <> 'NaN'::numeric))
      and (balance_after is null or (balance_after >= 0 and balance_after <> 'NaN'::numeric))
      and (counted_quantity is null or (counted_quantity >= 0 and counted_quantity <> 'NaN'::numeric))
    ),
  add constraint inventory_movements_expected_version_positive
    check (expected_item_version is null or expected_item_version > 0),
  add constraint inventory_movements_audit_snapshot_consistent
    check (
      (
        quantity_delta is null
        and balance_before is null
        and balance_after is null
        and counted_quantity is null
        and created_by_user_id is null
        and mutation_id is null
        and expected_item_version is null
        and performed_by_label is null
      )
      or
      (
        quantity_delta is not null
        and balance_before is not null
        and balance_after is not null
        and created_by_user_id is not null
        and mutation_id is not null
        and reason ~ '[^[:space:]]'
        and balance_after = balance_before + quantity_delta
        and quantity = abs(quantity_delta)
        and (
          (
            movement_type = 'Nhập'
            and quantity_delta > 0
            and counted_quantity is null
          )
          or
          (
            movement_type = 'Xuất'
            and quantity_delta < 0
            and counted_quantity is null
          )
          or
          (
            movement_type = 'Điều chỉnh'
            and counted_quantity is not null
            and counted_quantity = balance_after
            and quantity_delta = counted_quantity - balance_before
          )
        )
      )
    );

create unique index inventory_movements_org_mutation_unique
  on public.inventory_movements (organization_id, mutation_id)
  where mutation_id is not null;

create index inventory_movements_org_item_created_idx
  on public.inventory_movements (organization_id, item_id, created_at desc);

comment on column public.inventory_movements.quantity_delta is
  'Signed stock delta for new RPC-created movements; NULL for legacy rows.';
comment on column public.inventory_movements.balance_before is
  'Canonical item balance before a new movement; NULL for legacy rows.';
comment on column public.inventory_movements.balance_after is
  'Canonical item balance after a new movement; NULL for legacy rows.';
comment on column public.inventory_movements.counted_quantity is
  'Actual counted stock for Điều chỉnh only; zero is valid.';
comment on column public.inventory_movements.created_by_user_id is
  'Authenticated actor for new Cloud movements; never infer from performed_by labels.';
comment on column public.inventory_movements.mutation_id is
  'Stable client mutation UUID linked to the shared organization mutation receipt.';
comment on column public.inventory_movements.expected_item_version is
  'Item row_version supplied by client for updates; NULL for opening movement and legacy rows.';

commit;

-- Follow-up RPC requirements (not implemented by this DDL):
-- 1. create_inventory_item: inventory.create; Item + optional opening movement
--    + one shared receipt + change events in one transaction.
-- 2. post_inventory_movement: inventory.adjust; Nhập/Xuất only; lock Item,
--    check expected row_version, compute balance server-side.
-- 3. adjust_inventory_count: inventory.adjust; accept counted_quantity >= 0;
--    lock Item, compute signed delta. Delta 0 creates no movement/version/event.
-- 4. New movements must set actor/mutation/balances/delta and reason.
-- 5. expected_item_version is required by update RPCs, but remains NULL for
--    opening movement because the Item is created in the same transaction.
-- 6. Direct Item insert/metadata update grants are revoked only when all RPCs
--    are deployed and client cutover is ready.
