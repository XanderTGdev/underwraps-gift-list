import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface UpdateRoleRequest {
  userId: string;
  groupId: string | null;
  role: 'owner' | 'admin' | 'member' | null;
}

const VALID_ROLES = ['owner', 'admin', 'member'] as const;

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    if (!authHeader) {
      console.error("Missing Authorization header");
      return corsErrorResponse(req, 'Unauthorized', 401);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Authentication error");
      return corsErrorResponse(req, 'Unauthorized', 401);
    }

    const { userId, groupId, role }: UpdateRoleRequest = await req.json();

    if (!userId || typeof userId !== 'string') {
      return corsErrorResponse(req, 'User ID is required and must be a string', 400);
    }

    if (groupId !== null && typeof groupId !== 'string') {
      return corsErrorResponse(req, 'Group ID must be a string or null', 400);
    }

    if (role !== null && !VALID_ROLES.includes(role)) {
      return corsErrorResponse(req, 'Role must be one of: owner, admin, member, or null', 400);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if ((groupId && !uuidRegex.test(groupId)) || !uuidRegex.test(userId)) {
      return corsErrorResponse(req, 'Invalid ID format', 400);
    }

    const { data: isGlobalAdmin, error: globalAdminError } = await supabase
      .rpc('is_global_admin', { _user_id: user.id });

    let isAdmin = false;
    if (groupId) {
      const { data: groupAdmin, error: adminError } = await supabase
        .rpc('is_group_admin', { _user_id: user.id, _group_id: groupId });
      isAdmin = groupAdmin || false;
    }

    if (!isGlobalAdmin && !isAdmin) {
      console.error("Authorization check failed");
      return corsErrorResponse(req, 'You must be an admin to update user roles', 403);
    }

    if (user.id === userId && !isGlobalAdmin) {
      return corsErrorResponse(req, 'You cannot change your own role', 403);
    }

    if (groupId) {
      const { data: group } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      if (group && group.owner_id === userId && !isGlobalAdmin) {
        return corsErrorResponse(req, 'Cannot change the group owner\'s role', 403);
      }
    }

    if (role === null) {
      const deleteQuery = supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (groupId === null) {
        deleteQuery.is('group_id', null);
      } else {
        deleteQuery.eq('group_id', groupId);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        console.error("Role deletion error");
        return corsErrorResponse(req, 'Failed to remove role', 400);
      }

      console.log(`Removed role for user ${userId} in ${groupId ? `group ${groupId}` : 'global scope'}`);
    } else {
      const { error: upsertError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          group_id: groupId,
          role
        }, {
          onConflict: 'user_id,group_id'
        });

      if (upsertError) {
        console.error("Role upsert error");
        return corsErrorResponse(req, 'Failed to update role', 400);
      }

      console.log(`Updated role for user ${userId} in ${groupId ? `group ${groupId}` : 'global scope'} to ${role}`);
    }

    return corsResponse(req, { success: true }, 200);
  } catch (error: any) {
    console.error("Error in update-user-role function");
    return corsErrorResponse(req, 'Failed to update role', 500);
  }
};

serve(handler);
