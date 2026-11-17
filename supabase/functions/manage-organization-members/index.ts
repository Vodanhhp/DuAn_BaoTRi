import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function findAuthUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 500) return null;
  }
  throw new Error("Không thể xác định email trong danh sách Auth (đã vượt giới hạn phân trang).");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "server_configuration_missing" }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "unauthorized" }, 401);

  let body: {
    action?: string;
    organizationId?: string;
    email?: string;
    roleCode?: string;
    memberId?: string;
    status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const organizationId = body.organizationId?.trim();
  if (!organizationId) return json({ error: "organization_required" }, 400);

  const { data: canManage, error: permissionError } = await callerClient.rpc(
    "has_org_permission",
    { p_organization_id: organizationId, p_permission_code: "users.manage" },
  );
  if (permissionError) return json({ error: "permission_check_failed" }, 500);
  if (canManage !== true) return json({ error: "forbidden" }, 403);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (body.action === "invite") {
      const email = body.email?.trim().toLowerCase();
      const roleCode = body.roleCode;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "invalid_email" }, 400);
      }
      if (roleCode !== "technician" && roleCode !== "viewer") {
        return json({ error: "unsupported_member_role" }, 400);
      }

      const existingUser = await findAuthUserByEmail(admin, email);
      let targetUserId = existingUser?.id ?? '';
      let createdByInvite = false;
      let memberStatus: "active" | "invited" = "active";

      if (existingUser) {
        if (!existingUser.email_confirmed_at) {
          return json({ error: "email_confirmation_pending" }, 409);
        }
      } else {
        const appBaseUrl = Deno.env.get("APP_BASE_URL");
        const inviteOptions: { data: Record<string, string>; redirectTo?: string } = {
          data: { display_name: email.split("@")[0] },
        };
        if (appBaseUrl) inviteOptions.redirectTo = appBaseUrl;
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
        if (error || !data.user) {
          return json({ error: error?.message ?? "invite_failed" }, 400);
        }
        targetUserId = data.user.id;
        createdByInvite = true;
        memberStatus = "invited";
      }

      if (!targetUserId) return json({ error: 'target_user_not_found' }, 500);

      const { data: memberId, error: membershipError } = await admin.rpc(
        "admin_create_org_membership",
        {
          p_organization_id: organizationId,
          p_user_id: targetUserId,
          p_role_code: roleCode,
          p_invited_by_user_id: authData.user.id,
          p_status: memberStatus,
        },
      );
      if (membershipError) {
        if (createdByInvite) await admin.auth.admin.deleteUser(targetUserId);
        if (membershipError.code === "23505") {
          return json({ error: "already_a_member" }, 409);
        }
        return json({ error: membershipError.message }, 400);
      }

      return json({
        success: true,
        memberId,
        status: memberStatus,
        invitationSent: createdByInvite,
      });
    }

    if (body.action === "update_role") {
      if (!body.memberId || (body.roleCode !== "technician" && body.roleCode !== "viewer")) {
        return json({ error: "invalid_role_change" }, 400);
      }
      const { error } = await admin.rpc("admin_update_org_member_role", {
        p_organization_id: organizationId,
        p_member_id: body.memberId,
        p_role_code: body.roleCode,
        p_actor_user_id: authData.user.id,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (body.action === "update_status") {
      if (!body.memberId || (body.status !== "active" && body.status !== "suspended")) {
        return json({ error: "invalid_member_status" }, 400);
      }
      const { error } = await admin.rpc("admin_update_org_member_status", {
        p_organization_id: organizationId,
        p_member_id: body.memberId,
        p_status: body.status,
        p_actor_user_id: authData.user.id,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
