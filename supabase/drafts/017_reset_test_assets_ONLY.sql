-- BAOTRI Mini - reset 4 test assets only
-- Target: BAOTRI-Mini-Test
-- Organization: dfb443ec-a1ee-496b-842c-0bef3f50b8ce
-- This script deletes ONLY rows from public.assets.
-- It preserves organization_settings, organization, Auth users and memberships.
-- Run in Supabase SQL Editor for BAOTRI-Mini-Test only.

BEGIN;

DO $$
DECLARE
  v_org_id uuid := 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';
  v_count bigint;
BEGIN
  -- Guard: exactly four assets must still exist for this organization.
  SELECT count(*) INTO v_count
  FROM public.assets
  WHERE organization_id = v_org_id;

  IF v_count <> 4 THEN
    RAISE EXCEPTION
      'ABORT: expected 4 assets for organization %, found %',
      v_org_id, v_count;
  END IF;

  -- Guard: no dependent/business rows may have appeared since preflight.
  SELECT count(*) INTO v_count FROM public.maintenance_logs WHERE organization_id = v_org_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ABORT: maintenance_logs is not empty (%)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.checklist_results WHERE organization_id = v_org_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ABORT: checklist_results is not empty (%)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.checklist_template_versions WHERE organization_id = v_org_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ABORT: checklist_template_versions is not empty (%)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.checklist_templates WHERE organization_id = v_org_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ABORT: checklist_templates is not empty (%)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.maintenance_tasks WHERE organization_id = v_org_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ABORT: maintenance_tasks is not empty (%)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.maintenance_plans WHERE organization_id = v_org_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ABORT: maintenance_plans is not empty (%)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.inventory_movements WHERE organization_id = v_org_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ABORT: inventory_movements is not empty (%)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.asset_images WHERE organization_id = v_org_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ABORT: asset_images is not empty (%)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.inventory_items WHERE organization_id = v_org_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ABORT: inventory_items is not empty (%)', v_count; END IF;
END
$$;

DELETE FROM public.assets
WHERE organization_id = 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';

DO $$
DECLARE
  v_remaining bigint;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM public.assets
  WHERE organization_id = 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'ABORT: expected 0 remaining assets, found %', v_remaining;
  END IF;
END
$$;

-- If every guard passes, commit the deletion.
COMMIT;

-- Expected result after commit:
-- assets = 0; inventory_items = 0; organization_settings remains 1.
