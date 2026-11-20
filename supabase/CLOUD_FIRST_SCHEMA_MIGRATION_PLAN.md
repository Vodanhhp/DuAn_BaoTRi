# BAOTRI Mini — Cloud-first schema migration plan

Ngày: 19/11/2026  
Trạng thái: **Thiết kế đã đối chiếu mã nguồn/migration; chưa tạo migration áp dụng, chưa chạy SQL.**

## 1. Phạm vi và thứ tự triển khai

Không gộp tất cả nghiệp vụ vào một migration lớn. Tách thành các lát cắt có thể review/test độc lập:

1. **Foundation prerequisite:** shared `organization_mutations` Receipt + canonical request comparison + replay contract; review pgcrypto/hash availability trước khi chọn fingerprint. Draft `015_row_version_foundation_DRAFT.sql` vẫn là draft, cần review và test riêng.
2. **Inventory schema + RPC cutover:** thêm audit fields cho movement; sau đó trong cùng release/cutover có RPC tạo item + opening stock, metadata update, Nhập/Xuất, kiểm kê actual; thu hồi direct INSERT/UPDATE tương ứng khi RPC đã sẵn sàng.
3. **Maintenance Log schema + RPC cutover:** thêm `created_by_user_id`, revision table, backfill revision 1 cho legacy rows; thêm `logs.revise` Admin-only; RPC create/revise/complete Task; thu hồi direct INSERT vào root Log khi RPC create đã sẵn sàng.
4. **Change feed:** mỗi transaction phát event cho đúng các record đã đổi; pull quyền đọc theo `*.view`; chỉ triển khai sau khi Receipt và row_version contract ổn định.
5. **Client cutover:** Local draft only; Cloud response canonical; Dexie snapshot/mapping cập nhật sau Cloud commit; queue cũ được reconcile, không auto replay.

Không apply schema-only migration trong lúc client vẫn còn write path có thể bỏ qua revision/Receipt. Schema và RPC cutover phải được release đồng bộ hoặc có giai đoạn tương thích được kiểm soát.

## 2. Inventory movement schema contract

Bảng hiện tại `inventory_movements` có `quantity > 0`, type Nhập/Xuất/Điều chỉnh; `inventory_items.quantity` không âm. Giữ nguyên semantics cũ.

### Field bổ sung đề xuất
- `quantity_delta numeric(18,4)`: signed delta chuẩn.
- `balance_before numeric(18,4)`, `balance_after numeric(18,4)`: tồn trước/sau.
- `counted_quantity numeric(18,4)`: chỉ có ở Điều chỉnh kiểm kê actual.
- `created_by_user_id uuid references auth.users(id)`: actor Cloud; nullable cho legacy.
- `mutation_id uuid`: truy vết mutation; nullable cho legacy.
- `expected_item_version bigint`: version client đã đọc khi thay đổi item; nullable với opening movement và legacy.\n- `performed_by_label text`: tên hiển thị snapshot tương thích Local `Movement.performedBy`; không dùng để xác thực actor. Local `note` hiện trùng nội dung `reason`, nên không thêm cột note thứ hai.

### Constraints cho movement mới
- Legacy rows giữ các field mới NULL; không suy đoán số dư cũ từ movement history.
- Với movement mới, bắt buộc actor + mutation + quantity_delta + balance_before/after; expected_item_version bắt buộc với movement trên item đã tồn tại, nhưng không áp cho opening movement của item vừa tạo.
- `balance_before >= 0`, `balance_after >= 0`, `quantity_delta <> 0`, `balance_after = balance_before + quantity_delta`.
- Nhập: delta dương; Xuất: delta âm; Điều chỉnh: counted_quantity = balance_after và delta = counted - before.
- Cột `quantity` hiện hữu tiếp tục dương và bằng `abs(quantity_delta)` cho movement mới.
- Lý do không rỗng với movement mới. Adjustment delta 0 không insert movement.
- Unique partial index trên (organization_id, mutation_id) cho movement mới; shared ledger vẫn là nguồn idempotency chính.
- Không thay đổi/backfill quantity hoặc balance lịch sử.

## 3. Inventory cutover và permissions

- `create_inventory_item`: `inventory.create`; Admin/Technician; tạo item và nếu initial_quantity > 0 thì tạo opening movement Nhập cùng transaction. initial_quantity = 0 thì không movement.
- `update_inventory_item_metadata`: `inventory.update`; payload allowlist không có quantity.
- `post_inventory_movement`: `inventory.adjust`; Nhập/Xuất, lượng tuyệt đối dương; server lock item, check expected row_version, tính balance; xuất không âm.
- `adjust_inventory_count`: `inventory.adjust`; nhận actual counted_quantity >= 0, reason; lock item và tính delta. Delta = 0 trả no_change, không movement/version/change event.
- `inventory_items.quantity` không được client update trực tiếp. Không direct insert item hoặc movement khi RPC cutover hoàn tất.
- Inventory item code chưa có unique (organization_id, code) do development data từng có duplicate VT-001. Trước khi thêm unique constraint phải có read-only duplicate preflight và kế hoạch xử lý; không thêm constraint trong draft này.

## 4. Maintenance Log schema contract

### Root
- Giữ `maintenance_logs.id` và FK hiện có để không phá Task/Checklist/Asset references.
- Thêm `created_by_user_id uuid references auth.users(id)`, nullable để giữ nguyên legacy rows không có actor đáng tin cậy.
- Không xóa các cột payload cũ trong root ở giai đoạn đầu. Sau khi cutover, root là identity/relationship anchor; canonical nội dung hiển thị lấy từ revision mới nhất.
- Không backfill actor từ `performed_by` hoặc tên hiển thị; đây không phải Auth identity.

### `maintenance_log_revisions` đề xuất
- Identity: `id`, `organization_id`, `log_id`, `revision_no`.
- Snapshot đầy đủ: `log_date`, `due_date`, `kind`, `description`, `parts`, `readings`, `requested_by`, `result`, `completed_at`, `performed_by`.
- Audit: `action` (created / edited / legacy_baseline), `reason`, `actor_user_id`, `mutation_id`, `created_at`.
- Unique (organization_id, log_id, revision_no); FK (organization_id, log_id) → root.
- Legacy backfill: revision 1 lấy đúng dữ liệu hiện có trong root; due_date/requested_by NULL vì schema cũ không lưu; action = legacy_baseline; actor/reason/mutation_id NULL. Không bịa lịch sử.
- Revision mới: actor lấy auth.uid(); revision 1 do create RPC; revision >=2 do Admin-only revise RPC và reason bắt buộc.
- Revision table append-only; không UPDATE/DELETE. Root không hard-delete.

## 5. Permission và RLS/grants

- Thêm catalog permission `logs.revise` với mô tả sửa nhật ký đã lưu bằng revision.
- Gán permission này cho role Admin ở mọi organization; không gán Technician/Viewer. Migration phải insert permission trước rồi mới insert role_permissions cho các role Admin; không dựa vào seed cũ tự cập nhật grant.
- RLS SELECT revision dùng `has_org_permission(organization_id, 'logs.view')`.
- Không tạo INSERT/UPDATE/DELETE policy trực tiếp cho revisions; không cấp direct write grants. SECURITY DEFINER RPC là write path duy nhất, với `search_path = ''`, `row_security = off`, Auth + active membership + permission + org boundary checks.
- Khi RPC create Log đã sẵn sàng, thu hồi direct INSERT trên `maintenance_logs`; không thu hồi trước khi RPC được deploy cùng release để tránh mất khả năng tạo Log Cloud.
- Khi Inventory RPC cutover sẵn sàng, thu hồi direct INSERT item và direct UPDATE metadata columns; quantity hiện đã bị loại khỏi column grant. Direct movement INSERT vẫn không được cấp.
- UI gating là UX; RLS/RPC phải là enforcement cuối cùng.

## 6. Transaction boundaries

- Create Item + optional opening movement + shared Receipt + change events: một transaction.
- Nhập/Xuất/Điều chỉnh actual + Item balance/version + Movement + Receipt + events: một transaction.
- Create Log + root + revision 1 + Receipt + event: một transaction.
- Revise Log + revision mới + Receipt + event: một transaction.
- Complete Task + Task state/version + Log root + revision 1 + một Receipt + events cho Task/Log: một transaction.
- Receipt replay cùng actor/operation/resource/payload trả canonical result cũ; key reuse khác request bị reject. Không tạo mutation ID mới khi response outcome chưa rõ.

## 7. Migration rollout và kiểm thử bắt buộc

1. Read-only preflight trên BAOTRI-Mini-Test: migration hiện đã apply đến đâu; duplicate inventory codes; legacy movement rows; legacy Log count/FK integrity; role rows và permission assignments; extension/hash capability.
2. Backup và xác nhận restore/recovery trước khi ghi schema.
3. Apply draft riêng trên Test, xác minh row counts, constraints, indexes, RLS/grants.
4. RPC tests: Admin/Technician/Viewer; permission revoked; inactive membership; cross-org; expected-version conflict; same mutation replay; same ID different payload; rollback giữa transaction; concurrent inventory adjustments; concurrent Log revisions.
5. Data tests: adjustment to zero, positive/negative delta, no-change count; opening quantity 0/nonzero; legacy movement remains readable with new fields NULL; legacy Log revision 1 snapshot correct.
6. Client tests: Cloud fail leaves Local business data unchanged; timeout replay same mutation ID; Cloud commit then Dexie failure recovers from receipt; old queue never blindly replayed.
7. Chỉ sau PASS và phê duyệt mới promote migration/RPC/client release; Production là bước riêng.

## 8. Những việc không được làm trong đợt này

- Không sửa migration đã tồn tại; chỉ tạo draft mới.
- Không apply SQL trên Test/Production.
- Không thay đổi code UI/Local Dexie, queue, worker hoặc dữ liệu.
- Không bật full sync.
- Không thêm unique inventory code trước preflight.
- Không dùng performed_by/name label làm actor.
- Không suy đoán historical balances hoặc edit history.


## 9. SQL drafts được tạo để review (19/11/2026)

- `supabase/drafts/018_inventory_movement_audit_fields_DRAFT.sql`: chỉ bổ sung audit fields/constraints/index cho Movement; legacy fields NULL; không backfill balance; không thay grants; không chứa RPC.
- `supabase/drafts/019_maintenance_log_revisions_DRAFT.sql`: thêm root creator, tạo revision table, backfill baseline revision 1, seed `logs.revise` cho Admin roles và RLS read-only. Không thu hồi direct root INSERT trước khi RPC create cutover.
- Cả hai file là DRAFT ONLY; chưa chạy SQL. Cần review thêm transaction/permission behavior và đồng bộ với shared Receipt + row_version trước khi promotion.


## 10. Shared Receipt và row_version — kết quả review tiếp theo (19/11/2026)

- Shared Receipt phải đại diện một logical mutation và 1..N affected records; không dùng record_id đơn vì Task completion tạo cả Task + Log.
- Fingerprint do server dựng từ payload chuẩn hóa; không giả định pgcrypto. So sánh canonical JSONB là phương án ban đầu để review; chỉ dùng digest sau khi xác minh SHA-256 extension/hàm thực tế.
- Unique claim (organization_id, mutation_id) phải serialize request đồng thời; business rows + Receipt + row_version + events cùng transaction.
- Đã phát hiện Asset RPC hiện kiểm tra assets.update trước receipt replay; cần thiết kế replay riêng để khôi phục commit sau khi permission write bị thu hồi. Đề xuất replay yêu cầu active membership + cùng actor, không yêu cầu lại write permission; snapshot chỉ trả nếu còn read permission. Chính sách đang chờ xác nhận.
- Asset-specific Receipt/Lease tiếp tục tồn tại trong chuyển tiếp; không dual-write hai ledger và không xóa receipt cũ trước khi có đường replay legacy.
- Draft 015 tăng version theo từng SQL UPDATE, không theo logical transaction; mỗi RPC phải UPDATE mỗi mutable row đúng một lần. Asset hiện vẫn dùng expected_cloud_updated_at + Lease; chưa chuyển sang row_version.
- Chi tiết: mục 8–12 của CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md.
- Chưa tạo shared Receipt SQL draft hoặc sửa draft 015; chưa chạy SQL.


## 11. Chính sách replay Receipt đã được chấp thuận (19/11/2026)

- Người dùng chấp thuận replay read-only cho cùng actor khi Receipt đã commit, Auth hợp lệ, organization active và membership của actor vẫn active; không yêu cầu lại permission ghi của mutation cũ.
- Actor khác/cross-organization bị từ chối. Membership inactive hoặc organization inactive thì deny hoàn toàn.
- Snapshot Receipt chỉ được trả nếu actor hiện có quyền đọc tương ứng; nếu không, chỉ trả acknowledgement tối thiểu và không lộ snapshot nhạy cảm.
- Đây là chính sách thiết kế cho shared Receipt, không phải cho phép ghi mới và không tự thay đổi Asset RPC/Receipt hiện hữu. Asset migration phải có adapter/legacy replay plan riêng.
- Bổ sung test commit → mất response → revoke write → replay cùng ID; revoke read; inactive membership; inactive organization; actor khác.
- Chưa tạo SQL/RPC, chưa sửa code, chưa apply migration hoặc thay đổi dữ liệu/quyền.


## 12. Shared Receipt DDL draft 020 (19/11/2026)

- Đã tạo `supabase/drafts/020_organization_mutations_receipt_DRAFT.sql`; file chỉ định nghĩa bảng Receipt chung, index, RLS deny-by-default, trigger bảo vệ bất biến và deferred guard bắt buộc finalize.
- `organization_mutations` dùng PK `(organization_id, mutation_id)`, actor Auth, operation, canonical JSONB fingerprint, read permission codes, affected refs, result payload và trạng thái cuối `applied/no_change/conflict`. `pending` chỉ là trạng thái tạm trong cùng transaction và không được commit.
- Claim/replay algorithm được ghi trong comment của draft: kiểm tra membership trước; tra Receipt trước write permission; nếu Receipt tồn tại thì replay read-only cùng actor/fingerprint; nếu chưa có mới kiểm tra write permission và claim bằng unique key. Request cạnh tranh đọc Receipt sau khi `ON CONFLICT DO NOTHING` hoàn tất.
- Không giả định pgcrypto; không tạo generic callable claim RPC; không thay đổi Asset-specific Receipt/Lease, không dual-write.
- Draft chưa được áp dụng; chưa có business RPC hoặc read-replay RPC, chưa chạy SQL và chưa thay đổi Supabase.

## 13. Re-review Draft 018 — 20/11/2026

Draft 018 đã được sửa lỗi literal `\\n` trong ALTER TABLE. Bổ sung CHECK từ chối `NaN` ở quantity hiện hữu và các audit numeric fields; reason mới phải có ít nhất một ký tự không-whitespace.

Đã kiểm tra DDL/constraints trên BAOTRI-Mini-Test trong transaction rollback: legacy Movement, Nhập, Xuất và Điều chỉnh về 0 hợp lệ; NaN, delta 0, reason chỉ whitespace, thiếu actor trong audit snapshot và số dư âm bị từ chối. Sau rollback xác nhận schema, dữ liệu và migration history không thay đổi.

Draft vẫn chưa được apply. Trước promotion còn cần duplicate preflight cho `(organization_id, mutation_id)`, bảo đảm RPC enforce expected_item_version và kiểm tra numeric scale/range, đồng bộ với row_version + Shared Receipt, và kiểm thử vertical slice Inventory.

## 14. Re-check Draft 015 — 20/11/2026

Draft 015 đã được chạy thử DDL trong transaction rollback trên BAOTRI-Mini-Test. Trigger function pass các trường hợp INSERT ép version về 1, business UPDATE tăng version, timestamp-only UPDATE không tăng, no-op UPDATE không tăng và client không thể ép row_version. Sau rollback, sáu bảng mục tiêu không có cột row_version; không thay đổi schema/data/migration history.

Draft vẫn chưa apply. Trước promotion cần điều phối timestamp migration sau Migration 020 và phải triển khai RPC expected-version cùng release nghiệp vụ; row_version đơn lẻ không chặn lost update.

## 15. Shared Receipt deferred guard verification — 20/11/2026

Draft Shared Receipt đã được chỉnh theo phương án role NOLOGIN/NOBYPASSRLS/NOINHERIT, chỉ SELECT Receipt qua RLS policy riêng; deferred assertion SECURITY DEFINER do role này sở hữu, `search_path = ''`, không dùng `row_security = off`. DDL và probe RPC đã pass trên BAOTRI-Mini-Test trong transaction rollback: final Receipt pass, pending Receipt bị chặn, authenticated không SELECT được Receipt; role/table không tồn tại sau rollback.

Shared Receipt vẫn chưa apply. Còn phải hoàn tất review lock ordering/replay race và business RPC contracts. Draft mang nhãn 020 cũ phải được gán lại migration version vì Migration 020 P0 đã được áp dụng.

## 16. M021 Asset lock-anchor retrofit — rebase and test status — 20/11/2026

Migration 020 is now occupied by the applied P0 payload fix. The former planned M019 lock primitives/Settings bridge and M020 Asset writer retrofit are combined as one atomic candidate Migration 021 to prevent a mixed committed protocol.

Drafts:
- `supabase/drafts/M021_asset_lock_anchor_retrofit_DRAFT.sql`
- `supabase/drafts/M021_asset_lock_anchor_retrofit_TEST_DRAFT.sql`
- `supabase/drafts/M021_TWO_SESSION_TEST_PROTOCOL_DRAFT.md` (manual two-session barrier protocol; not yet run)

Rollback-only Test execution verified helper/trigger/function DDL, all seven Asset/Lease writer paths sequentially, mutation replay, import with Settings shared lock, and authenticated zero-row Settings UPDATE with global exclusive trigger lock. Effective privileges changed as intended inside the transaction and reverted after ROLLBACK. Key vectors were generated from PostgreSQL 17.12; two-int locks appear with `objsubid=2`, existing mutation bigint locks with `objsubid=1`.

M021 remains DRAFT ONLY. Mandatory remaining gates: external two-physical-session concurrency A1–A11, blocker/wait graph and deadlock regression, search_path poisoning, all existing Asset/Lease/import SQL tests, frontend smoke tests, and final catalog/privilege postflight. Do not promote/apply until these gates pass. Production is out of scope.
