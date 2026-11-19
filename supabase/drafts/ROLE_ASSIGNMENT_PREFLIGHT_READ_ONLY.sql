-- BAOTRI Mini - Role assignment preflight (READ ONLY)
-- Mục đích: kiểm tra dữ liệu trước khi chuyển member_roles thành nguồn vai trò duy nhất.
-- Chỉ chứa SELECT/CTE. Không chạy tự động; người vận hành xem xét và chạy thủ công
-- trên Supabase TEST trước. Không dùng kết quả TEST để suy luận dữ liệu Production.
-- Schema tham chiếu: migrations 001, 005, 013, 014.
--
-- LƯU Ý:
-- 1) Không tự sửa các trường hợp thiếu/trùng/mismatch.
-- 2) Legacy role chỉ có 'admin'/'user'; 'user' không đủ thông tin để suy ra
--    Technician hay Viewer khi assignment thiếu.
-- 3) Custom Role hợp lệ cần được đối chiếu chính sách tổ chức; query không tự coi
--    mọi role code lạ là lỗi nếu hệ thống đã cho phép Custom Role.
-- 4) Chạy từng SELECT độc lập trong SQL Editor. Không có INSERT/UPDATE/DELETE/DDL.

-- Q1. Tổng quan membership theo organization và trạng thái.
select
  m.organization_id,
  o.name as organization_name,
  m.status as membership_status,
  count(*) as membership_count
from public.organization_members m
join public.organizations o on o.id = m.organization_id
group by m.organization_id, o.name, m.status
order by o.name, m.status;

-- Q2. Phân bố số assignment trên mỗi membership (0 / 1 / nhiều).
with assignment_counts as (
  select
    m.organization_id,
    m.id as member_id,
    m.user_id,
    m.role as legacy_role,
    m.status,
    count(mr.role_id) as assignment_count
  from public.organization_members m
  left join public.member_roles mr
    on mr.organization_id = m.organization_id
   and mr.member_id = m.id
  group by m.organization_id, m.id, m.user_id, m.role, m.status
)
select
  organization_id,
  status,
  case
    when assignment_count = 0 then 'missing_0'
    when assignment_count = 1 then 'exactly_one'
    else 'multiple_more_than_one'
  end as assignment_state,
  count(*) as membership_count
from assignment_counts
group by organization_id, status, assignment_state
order by organization_id, status, assignment_state;

-- Q3. Membership thiếu assignment hoặc có nhiều assignment.
select
  m.organization_id,
  m.id as member_id,
  m.user_id,
  m.role as legacy_role,
  m.status,
  count(mr.role_id) as assignment_count,
  coalesce(
    string_agg(r.code, ', ' order by r.code) filter (where r.code is not null),
    '(none)'
  ) as assigned_role_codes
from public.organization_members m
left join public.member_roles mr
  on mr.organization_id = m.organization_id
 and mr.member_id = m.id
left join public.roles r
  on r.organization_id = mr.organization_id
 and r.id = mr.role_id
group by m.organization_id, m.id, m.user_id, m.role, m.status
having count(mr.role_id) <> 1
order by m.organization_id, m.status, m.id;

-- Q4. Assignment trỏ tới role không hoạt động hoặc không tồn tại.
-- FK thường ngăn role không tồn tại; LEFT JOIN vẫn giúp phát hiện constraint
-- không hợp lệ/NOT VALID hoặc dữ liệu bất thường.
select
  mr.organization_id,
  mr.member_id,
  mr.role_id,
  r.code as role_code,
  r.is_active,
  mr.assigned_by_user_id,
  mr.assigned_at
from public.member_roles mr
left join public.roles r
  on r.organization_id = mr.organization_id
 and r.id = mr.role_id
where r.id is null or r.is_active is distinct from true
order by mr.organization_id, mr.member_id;

-- Q5. So sánh legacy role với assignment.
-- Mapping mirror dự kiến: Admin ↔ legacy admin; mọi role không-Admin
-- (Technician/Viewer/Custom không có quyền Admin) ↔ legacy user.
-- Đây là danh sách cần xem xét, không phải lệnh sửa dữ liệu.
with assigned as (
  select
    m.organization_id,
    m.id as member_id,
    m.user_id,
    m.role as legacy_role,
    m.status,
    count(mr.role_id) as assignment_count,
    max(r.code) as sole_role_code,
    bool_or(coalesce(r.code = 'admin', false)) as has_admin_assignment
  from public.organization_members m
  left join public.member_roles mr
    on mr.organization_id = m.organization_id
   and mr.member_id = m.id
  left join public.roles r
    on r.organization_id = mr.organization_id
   and r.id = mr.role_id
  group by m.organization_id, m.id, m.user_id, m.role, m.status
)
select *
from assigned
where
  assignment_count <> 1
  or (legacy_role = 'admin' and sole_role_code is distinct from 'admin')
  or (legacy_role = 'user' and has_admin_assignment)
order by organization_id, status, member_id;

-- Q6. Role code đang được sử dụng, để đối chiếu built-in và Custom Role.
select
  r.organization_id,
  r.code as role_code,
  r.name as role_name,
  r.is_system,
  r.is_active,
  count(mr.member_id) as assigned_memberships
from public.roles r
left join public.member_roles mr
  on mr.organization_id = r.organization_id
 and mr.role_id = r.id
group by r.organization_id, r.code, r.name, r.is_system, r.is_active
order by r.organization_id, r.is_system desc, r.code;

-- Q7. Kiểm tra assignment có membership/org scope tương ứng.
-- FK kép trong migration 005 được thiết kế để ngăn sai scope; query này là
-- kiểm tra hậu điều kiện độc lập.
select
  mr.organization_id as assignment_organization_id,
  mr.member_id,
  mr.role_id,
  m.organization_id as membership_organization_id,
  r.organization_id as role_organization_id
from public.member_roles mr
left join public.organization_members m
  on m.organization_id = mr.organization_id
 and m.id = mr.member_id
left join public.roles r
  on r.organization_id = mr.organization_id
 and r.id = mr.role_id
where m.id is null or r.id is null;

-- Q8. Kiểm tra các membership đang hoạt động trong organization đang hoạt động
-- nhưng không có đúng một role assignment active.
with assignment_state as (
  select
    m.organization_id,
    m.id as member_id,
    m.user_id,
    m.status,
    count(mr.role_id) as assignment_count,
    count(*) filter (where r.is_active is true) as active_role_count
  from public.organization_members m
  left join public.member_roles mr
    on mr.organization_id = m.organization_id
   and mr.member_id = m.id
  left join public.roles r
    on r.organization_id = mr.organization_id
   and r.id = mr.role_id
  join public.organizations o on o.id = m.organization_id
  where m.status = 'active' and o.status = 'active'
  group by m.organization_id, m.id, m.user_id, m.status
)
select *
from assignment_state
where assignment_count <> 1 or active_role_count <> 1
order by organization_id, member_id;

-- KẾT THÚC: chỉ tổng hợp kết quả. Không có câu lệnh ghi dữ liệu.
